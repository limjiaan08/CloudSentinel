from flask import Blueprint, request, jsonify
import boto3

connection_bp = Blueprint('connection', __name__)

@connection_bp.route('/test-aws', methods=['POST'])
def test_aws_connection():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data received"}), 400

    access_key = data.get('access_key')
    secret_key = data.get('secret_key')
    region = data.get('region', 'ap-southeast-1')

    if not access_key or not secret_key:
        return jsonify({"message": "Access Key and Secret Key are required"}), 400
    
    try:
        session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )

        sts = session.client('sts')
        identity = sts.get_caller_identity()

        return jsonify({
            "status": "success",
            "message": "Connected to AWS successfully",
            "data": {
                "account_id": identity['Account'],
                "user_arn": identity['Arn']
            }
        }), 200
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "error_type": type(e).__name__,
            "message": str(e)
        }), 401