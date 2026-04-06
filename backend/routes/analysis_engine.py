import json
import math
from datetime import datetime
import pytz
from models import db, Result, ResultItem, PredefinedRule, AWSConfig, S3Config, EBSConfig, IAMConfig, VPCConfig, EC2Config, Scan

def get_my_time():
    kl_tz = pytz.timezone('Asia/Kuala_Lumpur')
    return datetime.now(kl_tz).replace(tzinfo=None)

def run_analysis(scan_id, target_model="Vuln"):
    # --- 1. FETCH ACTUAL START TIME FROM SCAN TABLE ---
    scan_record = Scan.query.get(scan_id)
    # Measure from the exact moment the scan was initiated
    actual_start_time = scan_record.start_time if scan_record else get_my_time()
    
    print(f"\n{'*'*60}")
    print(f"🔍 STARTING SECURITY ANALYSIS: {target_model} MODEL")
    print(f"⏰ PROCESS START TIME: {actual_start_time}")
    print(f"{'*'*60}")
    
    # Create the Result Header (Analysis Start Time)
    analysis_start = get_my_time()
    new_result = Result(scan_id=scan_id, detected_at=analysis_start)
    db.session.add(new_result)
    db.session.flush() 

    # --- HELPER FUNCTION ---
    def add_finding(config_id, rule_id, resource_name):
        rule = PredefinedRule.query.get(rule_id)
        if not rule:
            print(f"      [!] ERROR: Rule {rule_id} not found in database!")
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
        if detail.is_public:
            add_finding(header.config_id, "RULE-S3-01", header.resource_name)
        if not detail.encryption_enabled:
            add_finding(header.config_id, "RULE-S3-02", header.resource_name)

    # --- 3. EBS Analysis ---
    print("\n📝 [2/4] Analyzing EBS Volume Encryption...")
    ebs_data = db.session.query(AWSConfig, EBSConfig).join(EBSConfig).filter(AWSConfig.scan_id == scan_id).all()
    for header, detail in ebs_data:
        if not detail.encryption_enabled:
            add_finding(header.config_id, "RULE-EBS-01", header.resource_name)

    # --- 4. IAM Analysis ---
    print("\n📝 [3/4] Analyzing IAM Roles & Identity...")
    iam_data = db.session.query(AWSConfig, IAMConfig).join(IAMConfig).filter(AWSConfig.scan_id == scan_id).all()
    for header, detail in iam_data:
        if header.resource_type == 'IAM_USER':
            if not detail.mfa_enabled:
                add_finding(header.config_id, "RULE-IAM-02", f"IAM User ({header.resource_name})")
        elif header.resource_type == 'IAM_ROLE':
            perms = json.loads(detail.permissions) if detail.permissions else []
            if 'AdministratorAccess' in perms:
                add_finding(header.config_id, "RULE-IAM-01", header.resource_name)
        elif header.resource_type == 'IAM_GLOBAL' and target_model != "Safe":
            if not detail.mfa_enabled:
                add_finding(header.config_id, "RULE-IAM-02", "Account Root")
            if detail.password_policy_strength == "Weak":
                add_finding(header.config_id, "RULE-IAM-03", "Account Password Policy")

    # --- 5. VPC & SG Analysis ---
    print("\n📝 [4/4] Analyzing Network Perimeter (VPC & SG)...")
    vpc_data = db.session.query(AWSConfig, VPCConfig).join(VPCConfig).filter(AWSConfig.scan_id == scan_id).all()
    for header, detail in vpc_data:
        if not detail.flow_logs_enabled:
            add_finding(header.config_id, "RULE-VPC-02", header.resource_name)
        if "Subnets: 1" in header.resource_name:
            add_finding(header.config_id, "RULE-VPC-01", header.resource_name)

    sg_data = db.session.query(AWSConfig, EC2Config).join(EC2Config).filter(AWSConfig.scan_id == scan_id).all()
    for header, detail in sg_data:
        rules = json.loads(detail.open_ingress_rules) if detail.open_ingress_rules else []
        if any("Port:ALL" in rule for rule in rules) or any("Port:22" in rule for rule in rules):
            add_finding(header.config_id, "RULE-SG-01", header.resource_name)

    # --- 6. CAPTURE END TIME & CALCULATE TOTAL DURATION (FLOAT) ---
    end_dt = get_my_time()
    duration_delta = end_dt - actual_start_time
    
    # Get raw seconds as float
    total_seconds = duration_delta.total_seconds()
    
    # Format string for Result table display (2 decimal places)
    duration_str = f"{total_seconds:.22f}s" if total_seconds < 60 else f"{int(total_seconds // 60)}m {total_seconds % 60:.2f}s"

    # Save details to the Result record
    new_result.completed_at = end_dt
    new_result.duration = duration_str

    db.session.commit()
    
    print(f"\n{'='*60}")
    print(f"✅ ANALYSIS COMPLETE.")
    print(f"⏱️  TOTAL DURATION: {total_seconds:.2f}s")
    print(f"📅 END TIME: {end_dt}")
    print(f"{'='*60}\n")

    # Return values for config_fetching_bp
    # Round to 2 decimal places for the Float column in the Scan table
    return end_dt, round(total_seconds, 2)