from flask import Blueprint, request, jsonify
from sqlalchemy import func
from models import db, Result, ResultItem, Scan

result_fetching_bp = Blueprint('result_fetching', __name__)

@result_fetching_bp.route('/scan-results/<scan_id>', methods=['GET'])
def get_scan_results(scan_id):
    try:
        user_id = request.args.get('user_id')
        target_scan_id = None

        # --- 1. HANDLE "LATEST" LOGIC ---
        if scan_id == "latest":
            if not user_id:
                return jsonify({"error": "user_id is required"}), 400

            # CRITICAL: We skip CANCELLED/FAILED and find the absolute latest SUCCESS
            latest_completed_scan = Scan.query.filter_by(user_id=user_id, scan_status='COMPLETED')\
                                         .order_by(Scan.start_time.desc()).first()
            
            if not latest_completed_scan:
                # Only return 404 if the user has NEVER completed a single scan
                return jsonify({"message": "No historical completed scans found"}), 404
            
            target_scan_id = latest_completed_scan.scan_id
        else:
            # If a specific UUID is passed (from History), we use it directly
            target_scan_id = scan_id

        # --- 2. SECURITY & DATA VALIDATION ---
        # Fetch the scan object to verify ownership and existence
        actual_scan = Scan.query.filter_by(scan_id=target_scan_id).first()
        
        if not actual_scan:
            return jsonify({"error": "Scan record not found"}), 404

        # Security Check: Ensure User A cannot peek at User B's historical UUIDs
        if user_id and str(actual_scan.user_id).lower() != str(user_id).lower():
            return jsonify({"error": "Unauthorized access to this scan"}), 403

        # --- 3. FETCH RESULT HEADERS AND ITEMS ---
        # Get the Result header linked to the scan_id
        result_header = Result.query.filter_by(scan_id=target_scan_id).first()
        
        if not result_header:
            return jsonify([]), 200

        # Get all finding items linked to that Result ID
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
        import traceback
        print(f"❌ Result Fetch Error: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500