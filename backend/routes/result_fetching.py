from flask import Blueprint, request, jsonify
from models import db, Result, ResultItem, Scan

result_fetching_bp = Blueprint('result_fetching', __name__)

@result_fetching_bp.route('/scan-results/<scan_id>', methods=['GET'])
def get_scan_results(scan_id):
    try:
        target_scan_id = scan_id
        # Get the user_id from the query parameters
        user_id = request.args.get('user_id')

        if scan_id == "latest":
            # --- FIX: Filter by user_id so users only see THEIR latest scan ---
            query = Scan.query
            if user_id:
                query = query.filter_by(user_id=user_id)
            
            latest_scan = query.order_by(Scan.start_time.desc()).first()
            
            if not latest_scan:
                return jsonify([]), 200
            
            target_scan_id = latest_scan.scan_id

        # 1. Get Result Header
        result_header = Result.query.filter_by(scan_id=target_scan_id).first()
        
        # --- SECURITY CHECK: Ensure this scan actually belongs to the user ---
        # This prevents User A from manually typing User B's scan_id in the URL
        actual_scan = Scan.query.get(target_scan_id)
        if user_id and actual_scan and str(actual_scan.user_id) != str(user_id):
            return jsonify({"error": "Unauthorized access to this scan"}), 403

        if not result_header:
            return jsonify([]), 200

        # 2. Get Items
        findings = ResultItem.query.filter_by(result_id=result_header.result_id).all()
        
        output = []
        for item in findings:
            output.append({
                "id": item.result_item_id,
                "category": item.cnas_category or "N/A",
                "severity": item.severity or "Medium",
                "finding": item.misconfig_name or "Misconfiguration",
                "description": str(item.description) if item.description else "No description available.",
                "service": item.aws_service or "AWS",
                "scan_time": item.detected_at.strftime('%Y-%m-%d %H:%M:%S') if item.detected_at else "N/A"
            })

        return jsonify(output), 200

    except Exception as e:
        print(f"❌ Privacy Error: {str(e)}")
        return jsonify({"error": str(e)}), 500