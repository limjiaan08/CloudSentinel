import json
from datetime import datetime
from models import db, Result, ResultItem, PredefinedRule, AWSConfig, S3Config, EBSConfig, IAMConfig, VPCConfig, EC2Config
import pytz
from datetime import datetime

def get_my_time():
    kl_tz = pytz.timezone('Asia/Kuala_Lumpur')
    return datetime.now(kl_tz).replace(tzinfo=None)

def run_analysis(scan_id):
    print(f"DEBUG: Starting Security Analysis for Scan ID: {scan_id}")
    
    # 1. Create the Result Header (The "Parent" for all findings)
    new_result = Result(scan_id=scan_id, detected_at=get_my_time())
    db.session.add(new_result)
    db.session.flush() 

    # --- HELPER FUNCTION ---
    def add_finding(config_id, rule_id):
        # This checks if the rule exists in your PredefinedRule table first
        rule = PredefinedRule.query.get(rule_id)
        if not rule:
            print(f"ERROR: Rule {rule_id} not found in PredefinedRule table!")
            return

        item = ResultItem(
            result_id=new_result.result_id,
            config_id=config_id,
            rule_id=rule.rule_id,
            cnas_category=rule.cnas_category,
            misconfig_name=rule.rule_name, # Pulls "Publicly Open S3 Bucket"
            aws_service=rule.aws_service,
            severity=rule.severity,
            description=rule.description, # Pulls the detailed desc from DB
            detected_at=get_my_time()
        )
        db.session.add(item)

    # --- 2. S3 Analysis (CNAS-1) ---
    s3_data = db.session.query(AWSConfig, S3Config).join(S3Config).filter(AWSConfig.scan_id == scan_id).all()
    for header, detail in s3_data:
        if detail.is_public:
            add_finding(header.config_id, "RULE-S3-01")
        if not detail.encryption_enabled:
            add_finding(header.config_id, "RULE-S3-02")

    # --- 3. EBS Analysis (CNAS-1) ---
    ebs_data = db.session.query(AWSConfig, EBSConfig).join(EBSConfig).filter(AWSConfig.scan_id == scan_id).all()
    for header, detail in ebs_data:
        if not detail.encryption_enabled:
            add_finding(header.config_id, "RULE-EBS-01")

    # --- 4. IAM Analysis (CNAS-3) ---
    iam_data = db.session.query(AWSConfig, IAMConfig).join(IAMConfig).filter(AWSConfig.scan_id == scan_id).all()
    for header, detail in iam_data:
        if header.resource_type == 'IAM_GLOBAL':
            if not detail.mfa_enabled:
                add_finding(header.config_id, "RULE-IAM-01")
            if detail.password_policy_strength == "Weak":
                add_finding(header.config_id, "RULE-IAM-02")
        
        if header.resource_type == 'IAM_ROLE' and detail.permissions:
            perms = json.loads(detail.permissions)
            if 'AdministratorAccess' in perms:
                add_finding(header.config_id, "RULE-IAM-03")

    # --- 5. VPC & SG Analysis (CNAS-6) ---
    
    # A. VPC Analysis (Segmentation and Flow Logs)
    vpc_data = db.session.query(AWSConfig, VPCConfig).join(VPCConfig).filter(AWSConfig.scan_id == scan_id).all()
    for header, detail in vpc_data:
        # Check 1: No Network Segmentation (Default VPC)
        # We check the name since your fetcher labels it "Default VPC (id)"
        if "Default" in header.resource_name:
            add_finding(header.config_id, "RULE-VPC-01") 

        # Check 2: Flow Logs Disabled
        # If flow_logs_enabled is False, trigger RULE-VPC-02
        if not detail.flow_logs_enabled:
            add_finding(header.config_id, "RULE-VPC-02")

    # B. Security Group Analysis (Wide-Open Ingress)
    sg_data = db.session.query(AWSConfig, EC2Config).join(EC2Config).filter(AWSConfig.scan_id == scan_id).all()
    for header, detail in sg_data:
        rules = json.loads(detail.open_ingress_rules) if detail.open_ingress_rules else []
        
        # Trigger finding if ANY wide-open rules exist (0.0.0.0/0)
        # Specifically checking for the "CRITICAL" tag we added in fetch_config
        if any("ALL (CRITICAL)" in rule for rule in rules) or len(rules) > 0:
            add_finding(header.config_id, "RULE-SG-01")

    # Final Commit
    db.session.commit()
    print(f"DEBUG: Analysis Finished. Findings saved to Result ID: {new_result.result_id}")