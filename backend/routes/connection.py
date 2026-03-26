from flask import Blueprint, request, jsonify
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

# Name the blueprint 'connection' to match your file name
connection_bp = Blueprint('connection', __name__)

@connection_bp.route('/verify-aws', methods=['POST'])
def verify_aws_connection():
    data = request.get_json()
    
    access_key = data.get('accessKey')
    secret_key = data.get('secretKey')
    region = data.get('region')

    # 1. Validation: Ensure no fields are empty (Backend safety net)
    if not all([access_key, secret_key, region]):
        return jsonify({"error": "Access Key, Secret Key, and Region are required"}), 400

    try:
        # 2. Initialize a session
        session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
        
        # 3. Use STS to "Test" the keys safely
        # sts.get_caller_identity() is the industry standard for testing credentials
        sts = session.client('sts')
        identity = sts.get_caller_identity()

        return jsonify({
            "status": "success",
            "message": "AWS Credentials Verified",
            "account_id": identity['Account'],
            "arn": identity['Arn']
        }), 200

    except ClientError as e:
        # Specifically catch Authentication errors (Invalid Keys)
        error_code = e.response['Error']['Code']
        if error_code == 'InvalidClientTokenId' or error_code == 'SignatureDoesNotMatch':
            return jsonify({"error": "Invalid AWS Access Key or Secret Key"}), 401
        return jsonify({"error": f"AWS Error: {error_code}"}), 400
        
    except Exception as e:
        return jsonify({"error": "Internal Server Error", "details": str(e)}), 500