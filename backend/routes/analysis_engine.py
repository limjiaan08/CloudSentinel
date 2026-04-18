import json
import math
from datetime import datetime
import pytz
from models import db, Result, ResultItem, PredefinedRule, AWSConfig, S3Config, EBSConfig, IAMConfig, VPCConfig, EC2Config, Scan

def get_my_time():
    kl_tz = pytz.timezone('Asia/Kuala_Lumpur')
    # Returns naive datetime for database compatibility
    return datetime.now(kl_tz).replace(tzinfo=None)

def run_analysis(scan_id, target_model="Vuln"):
    # --- 1. FETCH ACTUAL START TIME ---
    scan_record = db.session.get(Scan, scan_id)
    actual_start_time = scan_record.start_time if scan_record else get_my_time()

    def is_cancelled():
        db.session.expire_all()
        s = db.session.get(Scan, scan_id)
        return s and s.scan_status == 'CANCELLED'
    
    print(f"\n{'*'*60}")
    print(f"🔍 STARTING SECURITY ANALYSIS: {target_model} MODEL")
    print(f"⏰ PROCESS START TIME: {actual_start_time}")
    print(f"{'*'*60}")
    
    # Create the Result Header
    analysis_start = get_my_time()
    new_result = Result(scan_id=scan_id, detected_at=analysis_start)
    db.session.add(new_result)
    db.session.flush() 

    # --- HELPER FUNCTION ---
    def add_finding(config_id, rule_id, resource_name):
        rule = db.session.get(PredefinedRule, rule_id)
        if not rule:
            print(f"      [!] ERROR: Rule {rule_id} not found!")
            return

        print(f"      [!] ALERT: {rule.rule_name} detected on {resource_name}")
        
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

    # --- 2. S3 Analysis ---
    print("\n📝 [1/4] Analyzing S3 Storage Security...")
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

    # --- 3. EBS Analysis ---
    print("\n📝 [2/4] Analyzing EBS Volume Encryption...")
    ebs_data = db.session.query(AWSConfig, EBSConfig).join(EBSConfig).filter(AWSConfig.scan_id == scan_id).all()
    for header, detail in ebs_data:
        if is_cancelled(): return get_my_time(), 0.0
        if not detail.encryption_enabled:
            add_finding(header.config_id, "RULE-EBS-01", header.resource_name)

    # --- 4. IAM Analysis (MFA Fix) ---
    print("\n📝 [3/4] Analyzing IAM Roles & Identity...")
    iam_data = db.session.query(AWSConfig, IAMConfig).join(IAMConfig).filter(AWSConfig.scan_id == scan_id).all()
    
    for header, detail in iam_data:
        if is_cancelled(): return get_my_time(), 0.0
        
        # A. Check IAM Users (This catches your 'Vuln' User)
        if header.resource_type == 'IAM_USER':
            # Use a broad falsy check to catch False, 0, or NULL
            if not detail.mfa_enabled:
                add_finding(header.config_id, "RULE-IAM-02", f"IAM User ({header.resource_name})")
            
            # RULE-IAM-04: Stale Access Keys
            if hasattr(detail, 'key_age_days') and detail.key_age_days > 90:
                add_finding(header.config_id, "RULE-IAM-04", f"Stale Access Keys ({header.resource_name})")
                
        # B. Check IAM Roles (Flags the alert you see in your console)
        elif header.resource_type == 'IAM_ROLE':
            perms = json.loads(detail.permissions) if detail.permissions else []
            if 'AdministratorAccess' in perms:
                add_finding(header.config_id, "RULE-IAM-01", header.resource_name)
                
        # C. Check IAM Global (Flags the Password Policy alert you see)
        elif header.resource_type == 'IAM_GLOBAL':
            if target_model != "Secure":
                # If Root MFA is ENABLED (True), 'not True' is False, so this is skipped.
                # If Root MFA were DISABLED (False), this would trigger.
                if not detail.mfa_enabled:
                    add_finding(header.config_id, "RULE-IAM-02", "Account Root")
                
                if detail.password_policy_strength == "Weak":
                    add_finding(header.config_id, "RULE-IAM-03", "Account Password Policy")

    # --- 5. VPC & SG Analysis ---
    print("\n📝 [4/4] Analyzing Network Perimeter (VPC & SG)...")
    vpc_data = db.session.query(AWSConfig, VPCConfig).join(VPCConfig).filter(AWSConfig.scan_id == scan_id).all()
    for header, detail in vpc_data:
        if is_cancelled(): return get_my_time(), 0.0
        if not detail.flow_logs_enabled:
            add_finding(header.config_id, "RULE-VPC-02", header.resource_name)
        if "Subnets: 1" in header.resource_name:
            add_finding(header.config_id, "RULE-VPC-01", header.resource_name)

    sg_data = db.session.query(AWSConfig, EC2Config).join(EC2Config).filter(AWSConfig.scan_id == scan_id).all()
    for header, detail in sg_data:
        if is_cancelled(): return get_my_time(), 0.0
        
        # Check Security Group Rules
        if header.resource_type == 'EC2_SG':
            rules = json.loads(detail.open_ingress_rules) if detail.open_ingress_rules else []
            
            # Original RULE-SG-01 (SSH/All)
            if any(r in ["Port:ALL", "Port:22"] for r in rules):
                add_finding(header.config_id, "RULE-SG-01", header.resource_name)
                
            # NEW: RULE-SG-03 (Public Database Ports)
            db_ports = ["Port:3306", "Port:5432", "Port:27017", "Port:1433"]
            if any(r in db_ports for r in rules):
                add_finding(header.config_id, "RULE-SG-03", header.resource_name)
        
        # NEW: RULE-EC2-02 (EC2 Instance IMDS Version)
        if header.resource_type == 'EC2_INSTANCE':
            if hasattr(detail, 'imds_version') and detail.imds_version == 'v1':
                add_finding(header.config_id, "RULE-EC2-02", header.resource_name)

    # --- 🛑 FINAL KILL SWITCH & COMMIT GUARD ---
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
    
    # Clean string for UI display
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