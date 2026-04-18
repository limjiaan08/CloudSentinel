from flask import Blueprint, request, jsonify
import boto3
from models import db
from models.core import Scan
from routes.auth import get_my_time

scanner_bp = Blueprint('scanner', __name__)

@scanner_bp.route('/scan-s3', methods=['POST'])
def start_scan():
    data = request.get_json()

    access_key = data.get('access_key')
    secret_key = data.get('secret_key')
    region = data.get('region', 'ap-southeast-1')
    user_id = data.get('user_id')

    if not access_key or not secret_key:
        return jsonify({"error": "AWS credentials are required to start scanning"}), 400
    