import json
from datetime import datetime
import pytz
from sqlalchemy.exc import SQLAlchemyError
from models import (
    db, Result, ResultItem, PredefinedRule,
    AWSConfig, S3Config, EBSConfig, IAMConfig,
    VPCConfig, EC2Config, Scan
)

def get_my_time():
    kl_tz = pytz.timezone('Asia/Kuala_Lumpur')
    return datetime.now(kl_tz).replace(tzinfo=None)


def run_analysis(scan_id, target_model="Vuln"):

    # -------------------------------
    # SAFE START (no session poisoning)
    # -------------------------------
    try:
        scan_record = db.session.get(Scan, scan_id)
    except SQLAlchemyError:
        db.session.rollback()
        scan_record = db.session.get(Scan, scan_id)

    actual_start_time = scan_record.start_time if scan_record else get_my_time()

    def is_cancelled():
        try:
            s = db.session.get(Scan, scan_id)
            return s and s.scan_status == 'CANCELLED'
        except SQLAlchemyError:
            db.session.rollback()
            return False

    print("\n" + "*" * 60)
    print(f"🔍 STARTING SECURITY ANALYSIS: {target_model}")
    print(f"⏰ START TIME: {actual_start_time}")
    print("*" * 60)

    # -------------------------------
    # PRELOAD RULES (IMPORTANT FIX)
    # -------------------------------
    rules = {
        r.rule_id: r for r in db.session.query(PredefinedRule).all()
    }

    # -------------------------------
    # CREATE RESULT HEADER
    # -------------------------------
    new_result = Result(
        scan_id=scan_id,
        detected_at=get_my_time()
    )

    try:
        db.session.add(new_result)
        db.session.flush()
    except SQLAlchemyError as e:
        db.session.rollback()
        print(f"❌ Failed to create result header: {e}")
        return get_my_time(), 0.0

    # -------------------------------
    # SAFE FINDING FUNCTION
    # -------------------------------
    def add_finding(config_id, rule_id, resource_name):

        rule = rules.get(rule_id)

        if not rule:
            print(f"      [!] RULE MISSING IN CACHE: {rule_id}")
            return

        print(f"      [!] ALERT: {rule.rule_name} on {resource_name}")

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
            print(f"      [!] Failed to insert result item: {e}")

    # -------------------------------
    # 1. S3 ANALYSIS
    # -------------------------------
    print("\n📝 [1/4] S3 Analysis...")

    try:
        s3_data = db.session.query(AWSConfig, S3Config)\
            .join(S3Config, AWSConfig.config_id == S3Config.config_id)\
            .filter(AWSConfig.scan_id == scan_id).all()

        for header, detail in s3_data:
            if is_cancelled():
                return get_my_time(), 0.0

            if detail.is_public:
                add_finding(header.config_id, "RULE-S3-01", header.resource_name)

            if not detail.encryption_enabled:
                add_finding(header.config_id, "RULE-S3-02", header.resource_name)

            if hasattr(detail, 'versioning_enabled') and not detail.versioning_enabled:
                add_finding(header.config_id, "RULE-S3-03", header.resource_name)

    except SQLAlchemyError as e:
        print(f"❌ S3 error: {e}")
        db.session.rollback()

    # -------------------------------
    # 2. EBS ANALYSIS
    # -------------------------------
    print("\n📝 [2/4] EBS Analysis...")

    try:
        ebs_data = db.session.query(AWSConfig, EBSConfig)\
            .join(EBSConfig, AWSConfig.config_id == EBSConfig.config_id)\
            .filter(AWSConfig.scan_id == scan_id).all()

        for header, detail in ebs_data:
            if is_cancelled():
                return get_my_time(), 0.0

            if not detail.encryption_enabled:
                add_finding(header.config_id, "RULE-EBS-01", header.resource_name)

    except SQLAlchemyError as e:
        print(f"❌ EBS error: {e}")
        db.session.rollback()

    # -------------------------------
    # 3. IAM ANALYSIS
    # -------------------------------
    print("\n📝 [3/4] IAM Analysis...")

    try:
        iam_data = db.session.query(AWSConfig, IAMConfig)\
            .join(IAMConfig, AWSConfig.config_id == IAMConfig.config_id)\
            .filter(AWSConfig.scan_id == scan_id).all()

        for header, detail in iam_data:
            if is_cancelled():
                return get_my_time(), 0.0

            if header.resource_type == 'IAM_USER':
                if not detail.mfa_enabled:
                    add_finding(header.config_id, "RULE-IAM-02",
                                f"IAM User ({header.resource_name})")

                if hasattr(detail, 'key_age_days') and detail.key_age_days > 7:
                    add_finding(header.config_id, "RULE-IAM-04",
                                f"Stale Keys ({header.resource_name})")

            elif header.resource_type == 'IAM_ROLE':
                perms = json.loads(detail.permissions or "[]")
                if 'AdministratorAccess' in perms:
                    add_finding(header.config_id, "RULE-IAM-01",
                                header.resource_name)

    except SQLAlchemyError as e:
        print(f"❌ IAM error: {e}")
        db.session.rollback()

    # -------------------------------
    # 4. NETWORK ANALYSIS
    # -------------------------------
    print("\n📝 [4/4] Network Analysis...")

    try:
        all_configs = db.session.query(AWSConfig)\
            .filter(AWSConfig.scan_id == scan_id).all()

        for header in all_configs:
            if is_cancelled():
                return get_my_time(), 0.0

            if header.resource_type == 'EC2_SG':
                detail = db.session.query(EC2Config)\
                    .filter_by(config_id=header.config_id).first()

                if detail:
                    in_rules = json.loads(detail.open_ingress_rules or "[]")
                    if any(r in ["Port:ALL", "Port:22"] for r in in_rules):
                        add_finding(header.config_id, "RULE-SG-01",
                                    header.resource_name)

                    out_rules = json.loads(detail.open_egress_rules or "[]")
                    if "Port:ALL" in out_rules:
                        add_finding(header.config_id, "RULE-SG-04",
                                    header.resource_name)

            elif header.resource_type == 'EC2_INSTANCE':
                detail = db.session.query(EC2Config)\
                    .filter_by(config_id=header.config_id).first()

                if detail and getattr(detail, 'imds_version', None) == 'v1':
                    add_finding(header.config_id, "RULE-EC2-02",
                                header.resource_name)

    except SQLAlchemyError as e:
        print(f"❌ Network error: {e}")
        db.session.rollback()

    # -------------------------------
    # FINAL COMMIT
    # -------------------------------
    try:
        end_time = get_my_time()
        duration = (end_time - actual_start_time).total_seconds()

        new_result.completed_at = end_time
        new_result.duration = f"{duration:.2f}s"

        db.session.commit()

        print("\n" + "=" * 60)
        print("✅ ANALYSIS COMPLETE")
        print(f"⏱️ Duration: {duration:.2f}s")
        print("=" * 60)

        return end_time, duration

    except SQLAlchemyError as e:
        db.session.rollback()
        print(f"❌ Final commit failed: {e}")
        return get_my_time(), 0.0

    finally:
        db.session.remove()