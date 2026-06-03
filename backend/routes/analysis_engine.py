import json
import math
from datetime import datetime
import pytz
from sqlalchemy.exc import SQLAlchemyError
from models import db, Result, ResultItem, PredefinedRule, AWSConfig, S3Config, EBSConfig, IAMConfig, VPCConfig, EC2Config, Scan

def get_my_time():
    # Returns naive datetime in Malaysia timezone for database compatibility
    kl_tz = pytz.timezone('Asia/Kuala_Lumpur')
    return datetime.now(kl_tz).replace(tzinfo=None)

def run_analysis(scan_id, target_model="Vuln"):
    # --- 🛑 FIX 1: RESET THE PRODUCTION POISONED TRANSACTION ---
    # This completely clears out any broken connection state inherited from Render's timeout
    db.session.remove()
    
    # Main analysis engine: Runs security rules against fetched AWS resources and generates findings
    # --- 1. FETCH ACTUAL START TIME ---
    try:
        scan_record = db.session.get(Scan, scan_id)
    except SQLAlchemyError as e:
        print(f"⚠️ DB connection dropped while fetching scan. Attempting reconnection recovery...")
        db.session.rollback()
        db.session.remove()
        scan_record = db.session.get(Scan, scan_id)

    actual_start_time = scan_record.start_time if scan_record else get_my_time()

    def is_cancelled():
        # Helper function: Checks if scan has been cancelled by user and stops processing
        try:
            db.session.expire_all()
            s = db.session.get(Scan, scan_id)
            return s and s.scan_status == 'CANCELLED'
        except SQLAlchemyError:
            db.session.rollback()
            return False
    
    print(f"\n{'*'*60}")
    print(f"🔍 STARTING SECURITY ANALYSIS: {target_model} MODEL")
    print(f"⏰ PROCESS START TIME: {actual_start_time}")
    print(f"{'*'*60}")
    
    # Create the Result Header
    analysis_start = get_my_time()
    new_result = Result(scan_id=scan_id, detected_at=analysis_start)
    
    try:
        db.session.add(new_result)
        db.session.flush() 
    except SQLAlchemyError as e:
        print(f"❌ Failed to initialize scan result header: {e}")
        db.session.rollback()
        return get_my_time(), 0.0

    def add_finding(config_id, rule_id, resource_name):
        # Helper function: Records a security finding when a rule violation is detected
        # --- 🛑 FIX 2: WRAP LOOKUPS IN A CLEAN STATE ROLLBACK GUARD ---
        try:
            rule = db.session.query(PredefinedRule).filter_by(rule_id=rule_id).first()
        except SQLAlchemyError as e:
            print(f"      [!] DATABASE TRANSACTION POISONED looking up rule {rule_id}: {e}")
            db.session.rollback() # Clears out the invalid state
            try:
                # Retry lookup after resetting the pipe context
                rule = db.session.query(PredefinedRule).filter_by(rule_id=rule_id).first()
            except Exception:
                return

        if not rule:
            print(f"      [!] ERROR: Rule {rule_id} not found!")
            return

        print(f"      [!] ALERT: {rule.rule_name} detected on {resource_name}")
        
        try:
            item = ResultItem(
                result_id=new_result.result_id,
                config_id=config_id,
                rule_id=rule.rule_id,
                cnas_category=rule.cnas_category,
                misconfig_name=rule.rule_name,
                aws_service=rule.aws_service,
                severity=rule.severity,
                description=rule.description,
                detected_at=get_my_time()
            )
            db.session.add(item)
        except Exception as e:
            print(f"      [!] Failed to append ResultItem to session: {e}")

    # --- 2. S3 Analysis ---
    print("\n📝 [1/4] Analyzing S3 Storage Security...")
    try:
        s3_data = db.session.query(AWSConfig, S3Config).join(S3Config).filter(AWSConfig.scan_id == scan_id).all()
        for header, detail in s3_data:
            if is_cancelled(): return get_my_time(), 0.0
            
            if detail.is_public:
                add_finding(header.config_id, "RULE-S3-01", header.resource_name)
            if not detail.encryption_enabled:
                add_finding(header.config_id, "RULE-S3-02", header.resource_name)
            # NEW: RULE-S3-03 (Versioning Disabled)
            if hasattr(detail, 'versioning_enabled') and not detail.versioning_enabled:
                add_finding(header.config_id, "RULE-S3-03", header.resource_name)
    except SQLAlchemyError as e:
        print(f"❌ Error during S3 evaluation context: {e}")
        db.session.rollback()

    # --- 3. EBS Analysis ---
    print("\n📝 [2/4] Analyzing EBS Volume Encryption...")
    try:
        ebs_data = db.session.query(AWSConfig, EBSConfig).join(EBSConfig).filter(AWSConfig.scan_id == scan_id).all()
        for header, detail in ebs_data:
            if is_cancelled(): return get_my_time(), 0.0
            if not detail.encryption_enabled:
                add_finding(header.config_id, "RULE-EBS-01", header.resource_name)
    except SQLAlchemyError as e:
        print(f"❌ Error during EBS evaluation context: {e}")
        db.session.rollback()

    # --- 4. IAM Analysis (MFA Fix) ---
    print("\n📝 [3/4] Analyzing IAM Roles & Identity...")
    try:
        iam_data = db.session.query(AWSConfig, IAMConfig).join(IAMConfig).filter(AWSConfig.scan_id == scan_id).all()
        
        for header, detail in iam_data:
            if is_cancelled(): return get_my_time(), 0.0
            
            # A. Check IAM Users 
            if header.resource_type == 'IAM_USER':
                if not detail.mfa_enabled:
                    add_finding(header.config_id, "RULE-IAM-02", f"IAM User ({header.resource_name})")
                
                # RULE-IAM-04: Stale Access Keys
                if hasattr(detail, 'key_age_days') and detail.key_age_days > 7:
                    add_finding(header.config_id, "RULE-IAM-04", f"Stale Access Keys ({header.resource_name})")
                    
            # B. Check IAM Roles 
            elif header.resource_type == 'IAM_ROLE':
                perms = json.loads(detail.permissions) if detail.permissions else []
                if 'AdministratorAccess' in perms:
                    add_finding(header.config_id, "RULE-IAM-01", header.resource_name)
                    
            # C. Check IAM Global 
            elif header.resource_type == 'IAM_GLOBAL':
                if target_model != "Secure":
                    if not detail.mfa_enabled:
                        add_finding(header.config_id, "RULE-IAM-02", "Account Root")
                    
                    if detail.password_policy_strength == "Weak":
                        add_finding(header.config_id, "RULE-IAM-03", "Account Password Policy")
    except SQLAlchemyError as e:
        print(f"❌ Error during IAM evaluation context: {e}")
        db.session.rollback()

    # --- 5. VPC & SG Analysis ---
    print("\n📝 [4/4] Analyzing Network Perimeter (VPC & SG)...")

    # --- 5a. VPC Analysis ---
    try:
        vpc_data = db.session.query(AWSConfig, VPCConfig).join(VPCConfig).filter(AWSConfig.scan_id == scan_id).all()
        for header, detail in vpc_data:
            if is_cancelled(): return get_my_time(), 0.0
            
            # RULE-VPC-02: Missing visibility
            if not detail.flow_logs_enabled:
                add_finding(header.config_id, "RULE-VPC-02", header.resource_name)
            
            # RULE-VPC-01: Poor segmentation (detecting the string we injected in the fetcher)
            if "Subnets: 1" in header.resource_name:
                add_finding(header.config_id, "RULE-VPC-01", header.resource_name)
    except SQLAlchemyError as e:
        print(f"❌ Error during VPC evaluation context: {e}")
        db.session.rollback()

    # --- 5b. SG & EC2 Analysis ---
    try:
        sg_data = db.session.query(AWSConfig, EC2Config).join(EC2Config).filter(AWSConfig.scan_id == scan_id).all()
        for header, detail in sg_data:
            if is_cancelled(): return get_my_time(), 0.0
            
            # Security Group Specific Rules (CNAS-6)
            if header.resource_type == 'EC2_SG':
                # --- Check Ingress (Existing) ---
                in_rules = json.loads(detail.open_ingress_rules) if detail.open_ingress_rules else []
                if any(r in ["Port:ALL", "Port:22"] for r in in_rules):
                    add_finding(header.config_id, "RULE-SG-01", header.resource_name)
                    
                # --- NEW: Check Egress for RULE-SG-04 (CNAS-6) ---
                out_rules = json.loads(detail.open_egress_rules) if detail.open_egress_rules else []
                if "Port:ALL" in out_rules:
                    add_finding(header.config_id, "RULE-SG-04", header.resource_name)
            
            # Instance Specific Rules (CNAS-1)
            if header.resource_type == 'EC2_INSTANCE':
                if hasattr(detail, 'imds_version') and detail.imds_version == 'v1':
                    add_finding(header.config_id, "RULE-EC2-02", header.resource_name)
    except SQLAlchemyError as e:
        print(f"❌ Error during Security Group/EC2 evaluation context: {e}")
        db.session.rollback()

    # --- 🛑 FINAL KILL SWITCH & COMMIT GUARD ---
    try:
        db.session.expire_all()
        check_scan = db.session.get(Scan, scan_id)
        
        if not check_scan or check_scan.scan_status == 'CANCELLED':
            db.session.rollback() # Abort saving any findings
            print(f"🛑 Analysis for {scan_id} aborted: Scan was CANCELLED by user.")
            return get_my_time(), 0.0

        # --- 6. CAPTURE END TIME & CALCULATE DURATION ---
        end_dt = get_my_time()
        duration_delta = end_dt - actual_start_time
        total_seconds = duration_delta.total_seconds()
        
        duration_str = f"{total_seconds:.2f}s" if total_seconds < 60 else f"{int(total_seconds // 60)}m {total_seconds % 60:.2f}s"

        new_result.completed_at = end_dt
        new_result.duration = duration_str

        # Final commit only if we reached this point and are NOT cancelled
        db.session.commit()
        
        print(f"\n{'='*60}")
        print(f"✅ ANALYSIS COMPLETE.")
        print(f"⏱️  TOTAL DURATION: {duration_str}")
        print(f"{'='*60}\n")

        return end_dt, round(total_seconds, 2)

    except SQLAlchemyError as e:
        print(f"❌ Final commit execution failed: {e}")
        db.session.rollback()
        return get_my_time(), 0.0
    finally:
        # --- 🛑 FIX 3: TEARDOWN CLEANUP ---
        # Instantly releases the connection back to the clean pool cleanly
        db.session.remove()