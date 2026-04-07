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
    data = request.get_json()
    
    access_key = data.get('accessKey')
    secret_key = data.get('secretKey')
    region = data.get('region')
    user_id = data.get('userId')

    if not all([access_key, secret_key, region, user_id]):
        return jsonify({"error": "All fields including User ID are required"}), 400

    try:
        session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
        sts = session.client('sts')
        identity = sts.get_caller_identity()

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
            "account_id": identity['Account']
        }), 200

    except ClientError as e:
        error_code = e.response['Error']['Code']
        return jsonify({"error": f"AWS Error: {error_code}"}), 401
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

# --- Cancel/Stop Scan (The Purge) ---
@connection_bp.route('/cancel-scan/<scan_id>', methods=['POST'])
def cancel_scan(scan_id):
    try:
        # Use session.get for modern SQLAlchemy
        scan = db.session.get(Scan, scan_id)
        if not scan: 
            return jsonify({"error": "Scan record not found"}), 404

        # 1. Update the Scan Status to CANCELLED
        scan.scan_status = 'CANCELLED'
        scan.end_time = None
        scan.duration = None

        # 2. PURGE RAW CONFIGS: Delete AWSConfig entries 
        # (This ensures no "ghost" resources stay in the DB)
        AWSConfig.query.filter_by(scan_id=scan_id).delete()

        # 3. PURGE RESULTS: Delete the analysis results
        res_header = Result.query.filter_by(scan_id=scan_id).first()
        if res_header:
            # Delete items first due to Foreign Key, then the header
            ResultItem.query.filter_by(result_id=res_header.result_id).delete()
            db.session.delete(res_header)
        
        db.session.commit()
        print(f"🛑 Scan {scan_id} cancelled and data purged.")
        return jsonify({"status": "success", "message": "Scan cancelled and data wiped"}), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ Cancel Error: {str(e)}")
        return jsonify({"error": str(e)}), 500