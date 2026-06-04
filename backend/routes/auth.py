from flask import Blueprint, request, jsonify, current_app
from models import db
from models.auth import User, Session
from flask_bcrypt import Bcrypt
from datetime import datetime, timedelta, timezone
from functools import wraps
import pytz
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature
from flask_mail import Mail
import os
import jwt
import requests

# Define the blueprint (mini-app for authentication)
auth_bp = Blueprint('auth', __name__)

# Password security tool: Modularizes authentication routes to keep the main app entry point clean
bcrypt = Bcrypt()

# Mail tool: Manages SMTP connections for sending system emails
mail = Mail()

SMTP_SERVER = "smtp-relay.brevo.com"
SMTP_PORT = 587
SMTP_LOGIN = os.getenv("BREVO_LOGIN")
SMTP_PASSWORD = os.getenv("BREVO_PASSWORD")

def send_reset_email(to_email, username, reset_link):
    try:
        url = "https://api.brevo.com/v3/smtp/email"

        headers = {
            "accept": "application/json",
            "api-key": os.getenv("BREVO_API_KEY"),
            "content-type": "application/json"
        }

        payload = {
            "sender": {
                "name": "CloudSentinel",
                "email": os.getenv("BREVO_SENDER_EMAIL")  # MUST be verified in Brevo
            },
            "to": [
                {
                    "email": to_email,
                    "name": username
                }
            ],
            "subject": "Reset Your Password",
            "htmlContent": f"""
                <div>
                    <h2>Hello {username}</h2>
                    <p>You requested a password reset.</p>
                    <p>
                        <a href="{reset_link}">
                            Click here to reset your password
                        </a>
                    </p>
                    <p>If you didn't request this, ignore this email.</p>
                </div>
            """
        }

        response = requests.post(url, json=payload, headers=headers, timeout=10)

        print("BREVO STATUS:", response.status_code)
        print("BREVO RESPONSE:", response.text)

        # IMPORTANT: real success check
        return response.status_code == 201

    except Exception as e:
        print("EMAIL ERROR:", str(e))
        return False

MY_TZ = pytz.timezone("Asia/Kuala_Lumpur")

def get_my_time():
    return datetime.now(MY_TZ)

def make_aware(dt):
    # Converts naive datetime from database to timezone-aware datetime in Malaysia timezone
    malaysia_tz = pytz.timezone('Asia/Kuala_Lumpur')

    # If datetime from DB is naive
    if dt and dt.tzinfo is None:
        return malaysia_tz.localize(dt)

    return dt

def normalize(dt):
    malaysia_tz = pytz.timezone("Asia/Kuala_Lumpur")

    if dt is None:
        return None

    # if naive → assume Malaysia time
    if dt.tzinfo is None:
        return malaysia_tz.localize(dt)

    return dt.astimezone(malaysia_tz)

def get_serializer():
    #Helper function to get the serializer with the correct app SECRET_KEY
    return URLSafeTimedSerializer(current_app.config['SECRET_KEY'])

def send_email(app, msg):
    with app.app_context():
        try:
            mail.send(msg)
            print("✅ Email sent")
        except Exception as e:
            print("❌ Email failed:", e)

def generate_jwt_token(user_id, session_id, expiration_hours=24):
    """
    Generate a JWT token with expiration.
    Default expiration: 24 hours
    """
    payload = {
        'user_id': user_id,
        'session_id': session_id,
        'exp': datetime.utcnow() + timedelta(hours=expiration_hours),
        'iat': datetime.utcnow()
    }
    token = jwt.encode(payload, current_app.config['SECRET_KEY'], algorithm='HS256')
    return token

def verify_jwt_token(token):
    """
    Verify JWT token and return payload.
    Returns None if token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, current_app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# --- SIGN UP ---
@auth_bp.route('/signup', methods=['POST'])
def signup():
    # Endpoint: Creates a new user account with email verification and secure password storage
    data = request.get_json()
 
    # Presence validation for required fields
    if not data or not data.get('name') or not data.get('email') or not data.get('password'):
        return jsonify({"error": "Missing name, email or password"}), 400
    
    # Input validation
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    
    # Validate name length (3-100 chars)
    if not name or len(name) < 3 or len(name) > 100:
        return jsonify({"error": "Name must be between 3 and 100 characters"}), 400
    
    # Validate email format
    if '@' not in email or len(email) < 5 or len(email) > 255:
        return jsonify({"error": "Invalid email format"}), 400
    
    # Validate password strength (min 8 chars)
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long"}), 400
    
    # Check for duplicate email
    if User.query.filter_by(user_email=email).first():
        return jsonify({"error": "Email already exists"}), 409
    
    # Hash the password
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')

    # Create user
    new_user = User(
        user_name = name,
        user_email = email,
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

    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = User.query.filter_by(user_email=email).first()

    if not user or not bcrypt.check_password_hash(user.user_password, password):
        return jsonify({"error": "Invalid email or password"}), 401

    try:
        # 🔥 OPTIONAL BUT RECOMMENDED: close old active sessions
        Session.query.filter_by(
            user_id=user.user_id,
            is_active=1
        ).update({
            "is_active": 0,
            "end_time": get_my_time()
        })

        # --- create new session ---
        new_session = Session(
            user_id=user.user_id,
            start_time=get_my_time()
        )

        db.session.add(new_session)
        db.session.flush()

        # --- generate token ---
        token = generate_jwt_token(
            user.user_id,
            new_session.session_id,
            expiration_hours=24
        )

        expiry_time = get_my_time() + timedelta(hours=24)

        new_session.token = token
        new_session.token_expiry = expiry_time
        new_session.is_active = 1

        db.session.commit()

        return jsonify({
            "message": "Login successful",
            "user_id": user.user_id,
            "user_name": user.user_name,
            "session_id": new_session.session_id,
            "token": token,
            "token_expiry": expiry_time.isoformat()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Could not create session", "details": str(e)}), 500

# --- LOGOUT ---
@auth_bp.route('/logout', methods=['POST'])
def logout():

    data = request.get_json()
    token = data.get('token')
    session_id = data.get('session_id')

    if not token and not session_id:
        return jsonify({"error": "Token or Session ID is required"}), 400

    session = None
    if token:
        session = Session.query.filter_by(token=token).first()
    else:
        session = Session.query.filter_by(session_id=session_id).first()

    if not session:
        return jsonify({"error": "Session not found"}), 404

    try:
        # ✅ ALWAYS use Malaysia-aware datetime directly
        end_time = get_my_time()

        start_time = session.start_time

        # ensure start_time is timezone-aware
        if start_time and start_time.tzinfo is None:
            start_time = MY_TZ.localize(start_time)

        # ❌ DO NOT re-localize end_time (this was your bug)
        if end_time.tzinfo is None:
            end_time = MY_TZ.localize(end_time)

        duration_seconds = int((end_time - start_time).total_seconds())

        session.end_time = end_time
        session.duration = duration_seconds
        session.is_active = 0

        print("LOGOUT SESSION ID:", session.session_id)
        print("START:", start_time)
        print("END:", end_time)
        print("DURATION:", duration_seconds)

        db.session.commit()

        return jsonify({
            "message": "Logged out successfully",
            "stayed_for_seconds": duration_seconds
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": "Duration calculation failed",
            "details": str(e)
        }), 500

# --- FORGOT PASSWORD ---
@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')

    if not email:
        return jsonify({"error": "Email is required"}), 400

    user = User.query.filter_by(user_email=email).first()

    success = False
    reset_link = None

    if user:
        try:
            serializer = get_serializer()
            token = serializer.dumps(email, salt='password-reset-salt')

            reset_link = f"{os.getenv('FRONTEND_URL')}/reset-password/{token}"

            success = send_reset_email(
                email,
                user.user_name,
                reset_link
            )

        except Exception as e:
            print("FORGOT PASSWORD ERROR:", str(e))

    print("Email requested for:", email)
    print("Reset link:", reset_link)
    print("Email sent status:", success)

    return jsonify({
        "message": "If an account matches that email, a reset link has been sent."
    }), 200

# --- VERIFY PASSWORD RESET EMAIL TOKEN (GET) ---
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
    
    # Validate password strength (min 8 chars)
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long"}), 400

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

# --- TOKEN VALIDATION DECORATOR ---
from functools import wraps

def token_required(f):
    """
    Decorator to require and validate JWT token for protected API routes.
    Token should be in Authorization header: "Bearer <token>"
    """

    @wraps(f)
    def decorated(*args, **kwargs):

        # ✅ Allow CORS preflight requests without token
        if request.method == 'OPTIONS':
            return '', 200

        token = None

        # Check for token in Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']

            try:
                token = auth_header.split(" ")[1]

            except IndexError:
                return jsonify({
                    "error": "Invalid token format. Use 'Bearer <token>'"
                }), 401

        if not token:
            return jsonify({"error": "Token is required"}), 401

        # Verify token validity
        payload = verify_jwt_token(token)

        if not payload:
            return jsonify({
                "error": "Token is invalid or expired",
                "error_type": "TOKEN_INVALID",
                "message": "Your token is invalid or has expired. Please login again."
            }), 401

        # Check if session is still active
        session = Session.query.filter_by(
            token=token,
            is_active=1
        ).first()

        if not session:
            return jsonify({
                "error": "Session is not active or token has been revoked"
            }), 401

        # Check token expiry time
        if session.token_expiry and make_aware(session.token_expiry) < get_my_time():
            session.is_active = 0  # Mark session as inactive
            db.session.commit()
            return jsonify({
                "error": "Token has expired",
                "error_type": "TOKEN_EXPIRED",
                "message": "Your session has expired. Please login again or renew your token."
            }), 401

        # Store user info in request
        request.user_id = payload.get('user_id')
        request.session_id = payload.get('session_id')
        request.token = token

        return f(*args, **kwargs)

    return decorated

# --- VERIFY TOKEN ENDPOINT ---
@auth_bp.route('/verify-token', methods=['POST'])
def verify_token():
    """
    Validate current token and return expiry information.
    Used by frontend to check if token is still valid before making requests.
    Returns: { "valid": true/false, "token_expiry": "...", "message": "..." }
    """
    token = None
    
    # Check for token in Authorization header
    if 'Authorization' in request.headers:
        auth_header = request.headers['Authorization']
        try:
            token = auth_header.split(" ")[1]
        except IndexError:
            return jsonify({"valid": False, "message": "Invalid token format"}), 401
    
    if not token:
        return jsonify({"valid": False, "message": "Token is required"}), 401
    
    # Verify JWT signature and expiration
    payload = verify_jwt_token(token)
    if not payload:
        return jsonify({"valid": False, "message": "Token is invalid or expired"}), 401
    
    # Check if session is still active in database
    session = Session.query.filter_by(token=token, is_active=1).first()
    
    if not session:
        return jsonify({"valid": False, "message": "Session is not active or token has been revoked"}), 401
    
    # Check if token has expired
    if session.token_expiry and make_aware(session.token_expiry) < get_my_time():
        # Token has expired, mark session as inactive
        session.is_active = 0
        db.session.commit()
        return jsonify({"valid": False, "message": "Token has expired. Please log in again."}), 401
    
    # Token is valid
    return jsonify({
        "valid": True,
        "token_expiry": session.token_expiry.isoformat() if session.token_expiry else None,
        "user_id": payload.get('user_id'),
        "message": "Token is valid"
    }), 200

# --- AUTO LOGOUT ON TOKEN EXPIRY ---
@auth_bp.route('/auto-logout', methods=['POST'])
def auto_logout():
    """
    Automatically logout user when token expires.
    Called by frontend when token expiry time is reached.
    """
    token = None
    
    if 'Authorization' in request.headers:
        auth_header = request.headers['Authorization']
        try:
            token = auth_header.split(" ")[1]
        except IndexError:
            return jsonify({"error": "Invalid token format"}), 401
    
    if not token:
        return jsonify({"error": "Token is required"}), 401
    
    # Find and deactivate the session
    session = Session.query.filter_by(token=token).first()
    if session:
        session.is_active = 0
        session.end_time = get_my_time()
        
        try:
            if session.start_time:
                start = normalize(session.start_time)
                end = normalize(session.end_time)

                session.duration = int((end - start).total_seconds())
            
            db.session.commit()
            return jsonify({
                "message": "Session terminated due to token expiration"
            }), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": str(e)}), 500
    
    return jsonify({"message": "Session already terminated"}), 200

# --- GET USER PROFILE ---
@auth_bp.route('/user/<user_id>', methods=['GET'])
@token_required
def get_user_profile(user_id):

    user = User.query.filter_by(user_id=user_id).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    # --- current session ---
    current_session = Session.query.filter_by(
        token=request.token,
        is_active=1
    ).first()

    # --- last COMPLETED session (IMPORTANT FIX) ---
    last_session = Session.query.filter(
        Session.user_id == user_id,
        Session.end_time.isnot(None)   # 🔥 only finished sessions
    ).order_by(Session.end_time.desc()).first()

    # --- safe duration calculation ---
    last_session_duration = None
    last_login = None

    if last_session:
        last_login = last_session.start_time.isoformat() if last_session.start_time else None
        last_session_duration = last_session.duration

    print("LAST SESSION ID:", last_session.session_id if last_session else None)
    print("START:", last_session.start_time if last_session else None)
    print("DURATION:", last_session_duration)

    return jsonify({
        "user_id": user.user_id,
        "user_name": user.user_name,
        "user_email": user.user_email,
        "created_at": user.created_at.isoformat() if user.created_at else None,

        # ✅ safe last session info
        "last_login": last_login,
        "last_session_duration": last_session_duration,

        # current session info
        "token_expiry": current_session.token_expiry.isoformat()
            if current_session and current_session.token_expiry else None,

        "is_token_valid": (
            current_session is not None and
            (not current_session.token_expiry or make_aware(current_session.token_expiry) > get_my_time())
        )
    }), 200

# --- UPDATE USER PROFILE ---
@auth_bp.route('/user/<user_id>', methods=['PUT'])
@token_required
def update_user_profile(user_id):
    """
    Update user profile information.
    Currently allows updating user_name.
    """
    user = User.query.filter_by(user_id=user_id).first()
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.get_json()
    
    if 'user_name' in data:
        user.user_name = data['user_name']
    
    try:
        db.session.commit()
        return jsonify({
            "message": "Profile updated successfully",
            "user_name": user.user_name
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- RE-AUTHENTICATE (Token Refresh) ---
@auth_bp.route('/user/<user_id>/re-authenticate', methods=['POST'])
@token_required
def re_authenticate(user_id):

    user = User.query.filter_by(user_id=user_id).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    try:
        # --- 1. Close current session ---
        current_session = Session.query.filter_by(token=request.token, is_active=1).first()

        if current_session:
            end_time = get_my_time()
            start_time = current_session.start_time

            # ensure timezone safety
            if start_time.tzinfo is None:
                start_time = MY_TZ.localize(start_time)

            current_session.end_time = end_time
            current_session.is_active = 0
            current_session.duration = int(
                (end_time - start_time).total_seconds()
            )

        db.session.flush()  # 🔥 IMPORTANT: ensure DB state is consistent

        # --- 2. Create new session ---
        new_session = Session(
            user_id=user_id,
            start_time=get_my_time()
        )

        db.session.add(new_session)
        db.session.flush()

        # --- 3. Generate new token ---
        new_token = generate_jwt_token(
            user_id,
            new_session.session_id,
            expiration_hours=24
        )

        new_session.token = new_token
        new_session.token_expiry = get_my_time() + timedelta(hours=24)
        new_session.is_active = 1

        db.session.commit()

        return jsonify({
            "message": "Re-authenticated successfully",
            "token": new_token,
            "token_expiry": new_session.token_expiry.isoformat(),
            "session_id": new_session.session_id
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- RENEW EXPIRED TOKEN ---
@auth_bp.route('/renew-token/<user_id>', methods=['POST'])
def renew_token(user_id):
    """
    Renew an expired token without requiring the old token to be active.
    Frontend calls this when token expires and user clicks 'Renew' on popup.
    Requires user_id in the request.
    Returns: { "token": "...", "token_expiry": "...", "session_id": "..." }
    """
    user = User.query.filter_by(user_id=user_id).first()
    
    if not user:
        return jsonify({
            "error": "User not found",
            "error_type": "USER_NOT_FOUND"
        }), 404
    
    # Create new session
    new_session = Session(
        user_id=user_id,
        start_time=get_my_time()
    )
    
    try:
        db.session.add(new_session)
        db.session.flush()
        
        # Generate new JWT token with 24-hour expiration
        new_token = generate_jwt_token(user_id, new_session.session_id, expiration_hours=24)
        new_token_expiry = get_my_time() + timedelta(hours=24)
        
        new_session.token = new_token
        new_session.token_expiry = new_token_expiry
        new_session.is_active = 1
        
        db.session.commit()
        
        return jsonify({
            "status": "success",
            "message": "Token renewed successfully",
            "token": new_token,
            "token_expiry": new_token_expiry.isoformat(),
            "session_id": new_session.session_id,
            "user_id": user_id
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "error": str(e),
            "error_type": "TOKEN_RENEWAL_FAILED"
        }), 500