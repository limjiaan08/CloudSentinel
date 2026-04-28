from flask import Blueprint, request, jsonify
import boto3
from botocore.exceptions import ClientError
from models import db, Scan, Result, ResultItem, AWSConfig  # Added AWSConfig
from datetime import datetime
import pytz

connection_bp = Blueprint('connection', __name__)

def get_my_time():
    # Returns naive datetime for DB compatibility while using KL time
    return datetime.now(pytz.timezone('Asia/Kuala_Lumpur')).replace(tzinfo=None)

# --- Start Scan ---
@connection_bp.route('/verify-aws', methods=['POST'])
def verify_aws_connection():
    # 1. Receive AWS credentials form the frontend
    # 2. Test against AWS STS (Security Token Service)
    # 3. If valid, a "Scan" record will be initialized in the database
    data = request.get_json()
    
    access_key = data.get('accessKey')
    secret_key = data.get('secretKey')
    region = data.get('region')
    user_id = data.get('userId')

    # Ensure all necessary connection parameters are present
    if not all([access_key, secret_key, region, user_id]):
        return jsonify({"error": "All fields including User ID are required"}), 400

    try:
        # Boto3 session (entry point for all AWS SDK actions later)
        session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )

        # Identity check (verify if credentials are active)
        sts = session.client('sts')
        identity = sts.get_caller_identity()

        # Create a placeholder for the scan so progress can be tracked
        new_scan = Scan(
            user_id=user_id,
            scan_status='IN_PROGRESS',
            start_time=get_my_time()
        )
        
        db.session.add(new_scan)
        db.session.commit()

        return jsonify({
            "status": "success",
            "message": "AWS Credentials Verified & Scan Initialized",
            "scan_id": new_scan.scan_id,
            "account_id": identity['Account'] # Returns the AWS Account ID linked to the keys
        }), 200

    except ClientError as e:
        error_code = e.response['Error']['Code']
        # Mapping technical codes to user-friendly messages
        error_map = {
            'InvalidClientTokenId': "The Access Key provided is invalid. Please check and try again.",
            'SignatureDoesNotMatch': "The Secret Key provided is incorrect. Please verify your credentials.",
            'AuthFailure': "AWS could not validate these credentials. Ensure they are active in IAM.",
            'InvalidSignatureException': "Credentials validation failed. Check your Secret Access Key.",
            'ExpiredToken': "The session token has expired. Please provide fresh credentials.",
            'AccessDenied': "These credentials do not have permission to verify identity via STS."
        }

        # Fallback to the code if it's not in our map
        friendly_message = error_map.get(error_code, f"Connection failed: {error_code}")
        
        return jsonify({"error": friendly_message}), 401
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- Cancel/Stop Scan (The Purge) ---
@connection_bp.route('/cancel-scan/<scan_id>', methods=['POST'])
def cancel_scan(scan_id):
    # Terminates an active scan and updates the record
    # Uses row-level locking to ensure no other process
    try:
        # .with_for_update() prevents race condition
        scan = db.session.query(Scan).filter_by(scan_id=scan_id).with_for_update().first()
        
        if not scan:
            return jsonify({"error": "Scan not found"}), 404

        # Resetting the Scan record state
        scan.scan_status = 'CANCELLED'
        scan.end_time = None
        scan.duration = None

        db.session.commit()

        # Ensures local object cache is cleared
        db.session.remove()

        print(f"🛑 Scan {scan_id} marked as CANCELLED in DB")

        return jsonify({"status": "success"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500