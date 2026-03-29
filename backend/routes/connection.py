from flask import Blueprint, request, jsonify
import boto3
from botocore.exceptions import ClientError
from models import db, Scan  # Import your SQLAlchemy db and Scan model
from datetime import datetime
import pytz

connection_bp = Blueprint('connection', __name__)

def get_my_time():
    return datetime.now(pytz.timezone('Asia/Kuala_Lumpur'))

@connection_bp.route('/verify-aws', methods=['POST'])
def verify_aws_connection():
    data = request.get_json()
    
    access_key = data.get('accessKey')
    secret_key = data.get('secretKey')
    region = data.get('region')
    user_id = data.get('userId') # Required to link the scan to a user

    # 1. Validation
    if not all([access_key, secret_key, region, user_id]):
        return jsonify({"error": "All fields including User ID are required"}), 400

    try:
        # 2. Credential Verification (STS)
        session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
        sts = session.client('sts')
        identity = sts.get_caller_identity()

        # 3. DATABASE ENTRY: Create a new Scan record
        # This ensures we have a scan_id before fetching starts
        new_scan = Scan(
            user_id=user_id,
            scan_status='IN_PROGRESS',
            start_time=get_my_time()
        )
        
        db.session.add(new_scan)
        db.session.commit() # Save to database to generate the UUID scan_id

        return jsonify({
            "status": "success",
            "message": "AWS Credentials Verified & Scan Initialized",
            "scan_id": new_scan.scan_id, # Return this for the next step
            "account_id": identity['Account']
        }), 200

    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code in ['InvalidClientTokenId', 'SignatureDoesNotMatch']:
            return jsonify({"error": "Invalid AWS Access Key ID or AWS Secret Access Key"}), 401
        return jsonify({"error": f"AWS Error: {error_code}"}), 400
        
    except Exception as e:
        db.session.rollback() # Important: rollback if the DB entry fails
        return jsonify({"error": "Internal Server Error", "details": str(e)}), 500