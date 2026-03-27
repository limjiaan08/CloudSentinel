from flask import Blueprint, request, jsonify
from models import db, Scan
import time
from datetime import datetime
import pytz

config_bp = Blueprint('configfetching', __name__)

def get_my_time():
    return datetime.now(pytz.timezone('Asia/Kuala_Lumpur'))

@config_bp.route('/fetch-config', methods=['POST'])
def fetch_config():
    data = request.get_json()
    scan_id = data.get('scan_id')
    
    if not scan_id:
        return jsonify({"error": "scan_id is required"}), 400

    # --- STEP 1: SIMULATE SCANNING LOOP ---
    for i in range(5):
        time.sleep(1) # Wait 1 second per step (Total 5s)
        
        # We query specifically to check if another route updated the status
        current_scan = Scan.query.get(scan_id)
        
        if current_scan:
            # Force SQLAlchemy to pull the latest data from MySQL
            db.session.refresh(current_scan) 
            
            if current_scan.scan_status == 'CANCELLED':
                print(f"DEBUG: Scan {scan_id} detected as CANCELLED. Stopping loop.")
                # Note: Duration for cancelled scans is usually handled in the /cancel-scan route
                return jsonify({"status": "stopped", "message": "Scan aborted by user"}), 200

    # --- STEP 2: FINALIZE SUCCESSFUL SCAN ---
    current_scan = Scan.query.get(scan_id)
    if current_scan:
        try:
            end_time = get_my_time()
            current_scan.end_time = end_time
            current_scan.scan_status = 'COMPLETED'
            
            # CALCULATE DURATION (Matches your auth.py logic)
            # Ensure start_time exists to avoid NoneType errors
            if current_scan.start_time:
                start_ts = current_scan.start_time.timestamp()
                end_ts = end_time.timestamp()
                current_scan.duration = int(end_ts - start_ts)
            
            db.session.commit()
            print(f"DEBUG: Scan {scan_id} completed. Duration: {current_scan.duration}s")
            
            return jsonify({
                "status": "success", 
                "message": "Mock fetch complete",
                "duration": current_scan.duration
            }), 200
            
        except Exception as e:
            db.session.rollback()
            return jsonify({"error": "Failed to update scan record", "details": str(e)}), 500
    
    return jsonify({"error": "Scan record not found"}), 404