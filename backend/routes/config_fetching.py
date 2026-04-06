from flask import Blueprint, request, jsonify
from models import db, Scan, AWSConfig, S3Config, IAMConfig, VPCConfig, EC2Config, EBSConfig
import boto3
from botocore.exceptions import ClientError
from datetime import datetime
import pytz
import json
from routes.analysis_engine import run_analysis

config_fetching_bp = Blueprint('configfetching', __name__)

def get_my_time():
    kl_tz = pytz.timezone('Asia/Kuala_Lumpur')
    return datetime.now(kl_tz).replace(tzinfo=None)

stop_signals = set()

@config_fetching_bp.route('/fetch-config', methods=['POST'])
def fetch_config():
    data = request.get_json()
    scan_id, access_key, secret_key, region = data.get('scan_id'), data.get('accessKey'), data.get('secretKey'), data.get('region')

    try:
        session = boto3.Session(aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name=region)
        
        # --- 0. IDENTITY DISCOVERY ---
        sts = session.client('sts')
        caller = sts.get_caller_identity()
        user_arn = caller['Arn']
        iam_user_name = user_arn.split('/')[-1] 

        target_tag = "Vuln" if "vuln" in iam_user_name.lower() else \
                     "Mixed" if "mixed" in iam_user_name.lower() else "Safe"

        print(f"\n{'='*60}")
        print(f"🚀 IDENTITY DETECTED: {iam_user_name} | TARGET MODEL: {target_tag}")
        print(f"{'='*60}")

        s3_client, iam_client, ec2_client = session.client('s3'), session.client('iam'), session.client('ec2')

        # --- 1. S3 SCAN ---
        print("\n📂 [1/5] Fetching S3 Bucket Configurations...")
        buckets = s3_client.list_buckets().get('Buckets', [])
        for b in buckets:
            name = b['Name']
            try:
                tags = {t['Key']: t['Value'] for t in s3_client.get_bucket_tagging(Bucket=name).get('TagSet', [])}
            except ClientError: tags = {}

            if tags.get('SecurityModel') == target_tag:
                is_pub = False
                try:
                    pab = s3_client.get_public_access_block(Bucket=name)
                    conf = pab['PublicAccessBlockConfiguration']
                    is_pub = not all([conf.get('BlockPublicAcls', True), conf.get('BlockPublicPolicy', True)])
                except ClientError: is_pub = True 

                has_enc = True
                try: s3_client.get_bucket_encryption(Bucket=name)
                except ClientError: has_enc = False

                header = AWSConfig(scan_id=scan_id, resource_name=name, resource_type='S3')
                db.session.add(header)
                db.session.flush()
                db.session.add(S3Config(config_id=header.config_id, is_public=is_pub, encryption_enabled=has_enc))

        # --- 2. EBS SCAN ---
        print("\n💾 [2/5] Fetching EBS Volume Configurations...")
        volumes = ec2_client.describe_volumes().get('Volumes', [])
        for v in volumes:
            vol_id = v['VolumeId']
            tags = {t['Key']: t['Value'] for t in v.get('Tags', [])}
            if tags.get('SecurityModel') == target_tag:
                is_enc = bool(v.get('Encrypted', False)) 
                header = AWSConfig(scan_id=scan_id, resource_name=vol_id, resource_type='EBS')
                db.session.add(header)
                db.session.flush()
                db.session.add(EBSConfig(config_id=header.config_id, encryption_enabled=is_enc))

        # --- 3. IAM SCAN ---
        print("\n🔐 [3/5] Fetching IAM Identity Configurations...")
        try:
            mfa_devices = iam_client.list_mfa_devices(UserName=iam_user_name).get('MFADevices', [])
            user_mfa_enabled = len(mfa_devices) > 0
            user_header = AWSConfig(scan_id=scan_id, resource_name=iam_user_name, resource_type='IAM_USER')
            db.session.add(user_header)
            db.session.flush()
            db.session.add(IAMConfig(config_id=user_header.config_id, mfa_enabled=user_mfa_enabled))
        except: pass

        if target_tag != "Safe":
            try:
                summary = iam_client.get_account_summary()['SummaryMap']
                mfa_root = bool(summary.get('AccountMFAEnabled', 0) == 1)
                pw_strength = "Weak"
                try:
                    policy = iam_client.get_account_password_policy().get('PasswordPolicy', {})
                    if policy.get('MinimumPasswordLength', 0) >= 14 and policy.get('RequireSymbols'):
                        pw_strength = "Strong"
                except ClientError: pw_strength = "Weak"

                header_iam = AWSConfig(scan_id=scan_id, resource_name='Account Settings', resource_type='IAM_GLOBAL')
                db.session.add(header_iam)
                db.session.flush()
                db.session.add(IAMConfig(config_id=header_iam.config_id, mfa_enabled=mfa_root, password_policy_strength=pw_strength))
            except: pass

        roles = iam_client.list_roles()['Roles']
        for r in roles:
            role_name = r['RoleName']
            try:
                r_tags = {t['Key']: t['Value'] for t in iam_client.list_role_tags(RoleName=role_name).get('Tags', [])}
            except: r_tags = {}

            if r_tags.get('SecurityModel') == target_tag:
                attached = iam_client.list_attached_role_policies(RoleName=role_name)['AttachedPolicies']
                policy_names = [p['PolicyName'] for p in attached]
                role_header = AWSConfig(scan_id=scan_id, resource_name=role_name, resource_type='IAM_ROLE')
                db.session.add(role_header)
                db.session.flush()
                db.session.add(IAMConfig(config_id=role_header.config_id, permissions=json.dumps(policy_names)))

        # --- 4. VPC SCAN ---
        print("\n🌐 [4/5] Fetching VPC Configurations...")
        vpcs = ec2_client.describe_vpcs().get('Vpcs', [])
        for v in vpcs:
            vpc_id = v['VpcId']
            tags = {t['Key']: t['Value'] for t in v.get('Tags', [])}
            if tags.get('SecurityModel') == target_tag:
                subnets = ec2_client.describe_subnets(Filters=[{'Name': 'vpc-id', 'Values': [vpc_id]}])['Subnets']
                logs = ec2_client.describe_flow_logs(Filters=[{'Name': 'resource-id', 'Values': [vpc_id]}]).get('FlowLogs', [])
                res_name = f"VPC-{vpc_id} | Subnets: {len(subnets)}"
                header = AWSConfig(scan_id=scan_id, resource_name=res_name, resource_type='VPC')
                db.session.add(header)
                db.session.flush()
                db.session.add(VPCConfig(config_id=header.config_id, flow_logs_enabled=(len(logs) > 0)))

        # --- 5. SECURITY GROUPS SCAN ---
        print("\n🛡️ [5/5] Fetching Security Group Rules...")
        sgs = ec2_client.describe_security_groups().get('SecurityGroups', [])
        for sg in sgs:
            tags = {t['Key']: t['Value'] for t in sg.get('Tags', [])}
            if tags.get('SecurityModel') == target_tag:
                open_rules = []
                for perm in sg.get('IpPermissions', []):
                    for ip_range in perm.get('IpRanges', []):
                        if ip_range.get('CidrIp') == '0.0.0.0/0':
                            port = "ALL" if perm.get('IpProtocol') == '-1' else perm.get('FromPort')
                            open_rules.append(f"Port:{port}")
                header = AWSConfig(scan_id=scan_id, resource_name=sg['GroupName'], resource_type='EC2_SG')
                db.session.add(header)
                db.session.flush()
                db.session.add(EC2Config(config_id=header.config_id, open_ingress_rules=json.dumps(open_rules)))

        db.session.commit()
        
        # --- EXECUTE ANALYSIS AND RETRIEVE TIMING DATA ---
        end_dt, duration_sec = run_analysis(scan_id, target_model=target_tag)

        # --- UPDATE SCAN TABLE STATUS (Crucial for UI) ---
        scan_record = Scan.query.get(scan_id)
        if scan_record:
            scan_record.scan_status = "COMPLETED"
            scan_record.end_time = end_dt
            scan_record.duration = duration_sec
            db.session.commit()
            print(f"✨ SCAN {scan_id} marked COMPLETED in {duration_sec}s.")

        return jsonify({"status": "success", "scan_id": scan_id}), 200

    except Exception as e:
        db.session.rollback()
        # Ensure status reflects failure in the UI
        scan_record = Scan.query.get(scan_id)
        if scan_record:
            scan_record.scan_status = "FAILED"
            db.session.commit()
        return jsonify({"error": str(e)}), 500