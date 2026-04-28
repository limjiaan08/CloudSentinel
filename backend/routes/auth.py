from flask import Blueprint, request, jsonify, current_app
from models import db
from models.auth import User, Session
from flask_bcrypt import Bcrypt
from datetime import datetime
import pytz
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from flask_mail import Message, Mail
import os

# Define the blueprint (mini-app for authentication)
auth_bp = Blueprint('auth', __name__)

# Password security tool: Modularizes authentication routes to keep the main app entry point clean
bcrypt = Bcrypt()

# Mail tool: Manages SMTP connections for sending system emails
mail = Mail()

def get_my_time():
    return datetime.now(pytz.timezone('Asia/Kuala_Lumpur'))

def get_serializer():
    #Helper function to get the serializer with the correct app SECRET_KEY
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'])

# --- SIGN UP ---
@auth_bp.route('/signup', methods=['POST'])
def signup():
    # Creates a new user record after validating input and hashing the password
    data = request.get_json()
    data = request.get_json()

    # Presence validation for required fields
    if not data or not data.get('name') or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Missing name, email or password"}), 400
    
    # Check for duplicate email
    if User.query.filter_by(user_email=data['email']).first():
        return jsonify({"error": "Email already exists"}), 409
    
    # Hash the password
    hashed_password = bcrypt.generate_password_hash(data['password']).decode('utf-8')

    # Create user
    new_user = User(
        user_name = data['name'],
        user_email = data['email'],
        user_password = hashed_password,
        created_at = get_my_time()
    )

    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "User registered successfully", "user_id": new_user.user_id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- SIGN IN ---
@auth_bp.route('/login', methods=['POST'])
def login():
    # Verifies credentials and creates a database-backed session entry
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    # Input field validation
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    
    # Find user in database
    user = User.query.filter_by(user_email=email).first()

    # Verify password
    if user and bcrypt.check_password_hash(user.user_password, password):
        # Create a new session
        new_session = Session(
            user_id = user.user_id,
            start_time = get_my_time()
        )

        try:
            db.session.add(new_session)
            db.session.commit()

            return jsonify({
                "message": "Login successful",
                "user_id": user.user_id,
                "user_name": user.user_name,
                "session_id": new_session.session_id
            }), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "Could not create session"}), 500
    else:
        return jsonify({"error": "Invalid email or password"}), 401

# --- LOGOUT ---
@auth_bp.route('/logout', methods=['POST'])
def logout():
    data = request.get_json()
    session_id = data.get('session_id')

    if not session_id:
        return jsonify({"error": "Session ID is required"}), 400
    
    session = Session.query.filter_by(session_id=session_id).first()

    if session:
        end_time = get_my_time()
        session.end_time = end_time
        
        try:
            start_ts = session.start_time.timestamp()
            end_ts = end_time.timestamp()
            session.duration = int(end_ts - start_ts)
        
            db.session.commit()
            return jsonify({
                "message": "Logged out successfully",
                "stayed for": f"{session.duration} seconds" 
            }), 200
        
        except Exception as e:
            db.session.rollback()
            print(f"Error calculating duration: {e}")
            return jsonify({"error": "Duration calculation failed", "details": str(e)})
    else:
        return jsonify({"error": "Session not found"}), 404

# --- FORGOT PASSWORD ---
@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(user_email=email).first()

    # Prevent email enumeration 
    if user:
        try:
            serializer = get_serializer()
            # Token is signed with a secret key and specific 'salt'
            token = serializer.dumps(email, salt='password-reset-salt')
            
            # React Frontend Link
            reset_link = f"http://localhost:5173/reset-password/{token}"

            msg = Message(
                subject="CloudSentinel - Password Reset Request",
                recipients=[email],
                body=f"Hi {user.user_name},\n\nClick the link below to reset your password:\n{reset_link}\n\nThis link expires in 30 minutes."
            )
            mail.send(msg)
        except Exception as e:
            current_app.logger.error(f"Mail error: {e}")

    return jsonify({
        "message": "If an account matches that email, a reset link has been sent."
    }), 200

# --- VERIFY RESET TOKEN (GET) ---
@auth_bp.route('/verify-reset-token/<token>', methods=['GET'])
def verify_reset_token(token):
    serializer = get_serializer()
    try:
        #30 minutes
        MAX_AGE = 1800
        email = serializer.loads(token, salt='password-reset-salt', max_age=MAX_AGE)
        return jsonify({"valid": True, "email": email}), 200
    except SignatureExpired:
        return jsonify({"valid": False, "error": "The reset link has expired."}), 400
    except BadSignature:
        return jsonify({"valid": False, "error": "Invalid or broken reset link."}), 400

# --- RESET PASSWORD (POST) ---
@auth_bp.route('/reset-password/<token>', methods=['POST'])
def reset_password(token):
    serializer = get_serializer()
    
    try:
        MAX_AGE = 1800 
        email = serializer.loads(token, salt='password-reset-salt', max_age=MAX_AGE)
    except SignatureExpired:
        return jsonify({"error": "The reset link has expired. Please request a new one."}), 400
    except BadSignature:
        return jsonify({"error": "Invalid reset link."}), 400

    data = request.get_json()
    new_password = data.get('password')

    if not new_password:
        return jsonify({"error": "New password is required"}), 400

    user = User.query.filter_by(user_email=email).first()
    if user:
        hashed_password = bcrypt.generate_password_hash(new_password).decode('utf-8')
        user.user_password = hashed_password
        try:
            db.session.commit()
            return jsonify({"message": "Password updated successfully!"}), 200
        except Exception:
            db.session.rollback()
            return jsonify({"error": "Database error"}), 500
    
    return jsonify({"error": "User not found."}), 404