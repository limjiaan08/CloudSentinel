from flask import Blueprint, jsonify
from sqlalchemy import func
from models import db, Scan, Result, ResultItem

scan_history_bp = Blueprint('scan_history', __name__)

@scan_history_bp.route('/scan-history/<user_id>', methods=['GET'])
def get_scan_history(user_id):
    try:
        # Count findings by severity for every Result ---
        severity_counts = db.session.query(
            ResultItem.result_id,
            func.count(func.nullif(ResultItem.severity != 'High', True)).label('high'),
            func.count(func.nullif(ResultItem.severity != 'Medium', True)).label('med'),
            func.count(func.nullif(ResultItem.severity != 'Low', True)).label('low')
        ).group_by(ResultItem.result_id).subquery()

        # --- 2. Main Query ---
        # Combine Scan info with the counts calculated in the subquery above
        history_query = db.session.query(
            Scan,
            severity_counts.c.high,
            severity_counts.c.med,
            severity_counts.c.low
        ).outerjoin(Result, Scan.scan_id == Result.scan_id)\
         .outerjoin(severity_counts, Result.result_id == severity_counts.c.result_id)\
         .filter(func.lower(Scan.user_id) == func.lower(user_id))\
         .order_by(Scan.start_time.desc())\
         .all()

        # --- DEBUGGING TERMINAL ---
        print(f"🔎 SCAN HISTORY REQUEST FOR: {user_id}")
        print(f"📊 DATABASE FOUND: {len(history_query)} RECORD(S)")

        # --- 3. Format result for Frontend ---
        history_list = []
        for scan, high, med, low in history_query:
            history_list.append({
                "scan_id": scan.scan_id,
                # Safe date formatting
                "start_time": scan.start_time.isoformat() if scan.start_time else None,
                "end_time": scan.end_time.isoformat() if scan.end_time else None,
                # Round duration to 2 decimal places
                "duration": round(float(scan.duration), 2) if scan.duration else 0.00,
                "scan_status": scan.scan_status,
                # Default to 0 if no findings (ensures React doesn't show 'NaN' or 'null')
                "high_count": high or 0,
                "med_count": med or 0,
                "low_count": low or 0
            })

        return jsonify({
            "status": "success",
            "scans": history_list
        }), 200

    except Exception as e:
        # Detailed error printing for your terminal
        import traceback
        print(f"❌ DATABASE ERROR: {str(e)}")
        traceback.print_exc() 
        return jsonify({"error": "Failed to fetch scan history"}), 500