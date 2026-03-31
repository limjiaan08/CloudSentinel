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

# Global set to track scans that should stop
stop_signals = set()

@config_fetching_bp.route('/fetch-config', methods=['POST'])
def fetch_config():
    data = request.get_json()
    scan_id = data.get('scan_id')
    access_key = data.get('accessKey')
    secret_key = data.get('secretKey')
    region = data.get('region')

    if scan_id in stop_signals:
        stop_signals.remove(scan_id)

    def check_for_cancel():
        return scan_id in stop_signals

    try:
        print(f"\n{'='*60}")
        print(f"🚀 STARTING AWS CONFIG FETCH (Scan ID: {scan_id})")
        print(f"{'='*60}")

        session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
        s3_client = session.client('s3')
        iam_client = session.client('iam')
        ec2_client = session.client('ec2')

        # --- 1. S3 SCAN ---
        print("\n📂 [1/5] Fetching S3 Bucket Configurations...")
        buckets = s3_client.list_buckets().get('Buckets', [])
        for b in buckets:
            if check_for_cancel(): return handle_cancellation(scan_id)
            name = b['Name']
            
            is_pub = False
            try:
                pab = s3_client.get_public_access_block(Bucket=name)
                conf = pab['PublicAccessBlockConfiguration']
                if not all([conf.get('BlockPublicAcls', True), conf.get('BlockPublicPolicy', True)]):
                    is_pub = True
            except ClientError: is_pub = True 

            has_enc = True
            try: s3_client.get_bucket_encryption(Bucket=name)
            except ClientError: has_enc = False

            print(f"   -> Bucket: {name} | Public: {is_pub} | Encrypted: {has_enc}")
            
            header = AWSConfig(scan_id=scan_id, resource_name=name, resource_type='S3')
            db.session.add(header)
            db.session.flush()
            db.session.add(S3Config(config_id=header.config_id, is_public=is_pub, encryption_enabled=has_enc))

        # --- 2. EBS SCAN ---
        print("\n💾 [2/5] Fetching EBS Volume Configurations...")
        volumes = ec2_client.describe_volumes().get('Volumes', [])
        for v in volumes:
            if check_for_cancel(): return handle_cancellation(scan_id)
            vol_id = v['VolumeId']
            is_enc = bool(v.get('Encrypted', False)) 
            
            print(f"   -> Volume: {vol_id} | Encrypted: {is_enc}")

            header = AWSConfig(scan_id=scan_id, resource_name=vol_id, resource_type='EBS')
            db.session.add(header)
            db.session.flush()
            db.session.add(EBSConfig(config_id=header.config_id, encryption_enabled=is_enc))

        # --- 3. IAM SCAN ---
        print("\n🔐 [3/5] Fetching IAM Identity Configurations...")
        if check_for_cancel(): return handle_cancellation(scan_id)
        
        # A. Account Settings
        try:
            summary = iam_client.get_account_summary()['SummaryMap']
            mfa_root = bool(summary.get('AccountMFAEnabled', 0) == 1)
            
            pw_strength = "Weak"
            try:
                pol = iam_client.get_account_password_policy()['PasswordPolicy']
                if pol.get('MinimumPasswordLength', 0) >= 14 and pol.get('RequireSymbols'):
                    pw_strength = "Strong"
            except ClientError: pw_strength = "None"
            
            print(f"   -> Account Settings | Root MFA: {mfa_root} | Password Policy: {pw_strength}")
            
            header_iam = AWSConfig(scan_id=scan_id, resource_name='Account Settings', resource_type='IAM_GLOBAL')
            db.session.add(header_iam)
            db.session.flush()
            db.session.add(IAMConfig(config_id=header_iam.config_id, mfa_enabled=mfa_root, password_policy_strength=pw_strength))
        except Exception as e: print(f"   ! IAM Account Error: {e}")

        # B. Roles
        roles = iam_client.list_roles()['Roles']
        for r in roles:
            if check_for_cancel(): return handle_cancellation(scan_id)
            if '/aws-service-role/' in r['Path']: continue
            
            role_name = r['RoleName']
            attached = iam_client.list_attached_role_policies(RoleName=role_name)['AttachedPolicies']
            policy_names = [p['PolicyName'] for p in attached]
            
            print(f"   -> Role: {role_name} | Attached Policies: {policy_names}")
            
            role_header = AWSConfig(scan_id=scan_id, resource_name=role_name, resource_type='IAM_ROLE')
            db.session.add(role_header)
            db.session.flush()
            db.session.add(IAMConfig(config_id=role_header.config_id, permissions=json.dumps(policy_names)))

        # --- 4. VPC SCAN ---
        print("\n🌐 [4/5] Fetching VPC Networking Configurations...")
        vpcs = ec2_client.describe_vpcs().get('Vpcs', [])
        for v in vpcs:
            if check_for_cancel(): return handle_cancellation(scan_id)
            vpc_id = v['VpcId']
            res_name = f"Default VPC ({vpc_id})" if v.get('IsDefault') else vpc_id
            
            logs = ec2_client.describe_flow_logs(Filters=[{'Name': 'resource-id', 'Values': [vpc_id]}]).get('FlowLogs', [])
            flow_enabled = len(logs) > 0
            
            print(f"   -> VPC: {res_name} | Flow Logs Enabled: {flow_enabled}")

            header = AWSConfig(scan_id=scan_id, resource_name=res_name, resource_type='VPC')
            db.session.add(header)
            db.session.flush()
            db.session.add(VPCConfig(config_id=header.config_id, flow_logs_enabled=flow_enabled))

        # --- 5. SECURITY GROUPS SCAN ---
        print("\n🛡️ [5/5] Fetching EC2 Security Group Rules...")
        sgs = ec2_client.describe_security_groups().get('SecurityGroups', [])
        
        for sg in sgs:
            if check_for_cancel(): return handle_cancellation(scan_id)
            sg_name = sg['GroupName']
            
            open_rules = []
            for perm in sg.get('IpPermissions', []):
                # Check for 0.0.0.0/0 (IPv4)
                for ip_range in perm.get('IpRanges', []):
                    if ip_range.get('CidrIp') == '0.0.0.0/0':
                        
                        # FIX: Logic to handle "All Traffic" (Protocol -1)
                        if perm.get('IpProtocol') == '-1':
                            open_rules.append("Port: ALL (CRITICAL)")
                        else:
                            # Standard ports (TCP/UDP)
                            from_port = perm.get('FromPort')
                            to_port = perm.get('ToPort')
                            
                            if from_port == to_port:
                                open_rules.append(f"Port:{from_port}")
                            else:
                                open_rules.append(f"Port:{from_port}-{to_port}")
            
            print(f"   -> SG: {sg_name} | Publicly Open Rules: {open_rules}")

            header = AWSConfig(scan_id=scan_id, resource_name=sg_name, resource_type='EC2_SG')
            db.session.add(header)
            db.session.flush()
            
            # Store the list of open ports as JSON for the analysis engine
            db.session.add(EC2Config(config_id=header.config_id, open_ingress_rules=json.dumps(open_rules)))

        # --- FINALIZING ---
        print(f"\n{'='*60}")
        print(f"✅ FETCH COMPLETE. COMMITTING TO DATABASE...")
        
        scan = Scan.query.get(scan_id)
        if scan:
            scan.scan_status = 'COMPLETED'
            scan.end_time = get_my_time()
            if scan.start_time:
                start_naive = scan.start_time.replace(tzinfo=None)
                duration = (scan.end_time - start_naive).total_seconds()
                scan.duration = int(max(0, duration))

        db.session.commit()
        print(f"📦 DB SYNCED. TRIGGERING ANALYSIS ENGINE...")
        run_analysis(scan_id)
        print(f"✨ SCAN PROCESS FINISHED SUCCESSFULLY.")
        print(f"{'='*60}\n")

        return jsonify({"status": "success", "scan_id": scan_id}), 200

    except Exception as e:
        db.session.rollback()
        if scan_id in stop_signals: stop_signals.remove(scan_id)
        print(f"\n❌ CRITICAL ERROR DURING FETCH: {str(e)}")
        return jsonify({"error": str(e)}), 500

# Supporting function for cancellation
def handle_cancellation(scan_id):
    db.session.commit() # Save partially fetched data
    if scan_id in stop_signals:
        stop_signals.remove(scan_id)
    print(f"\n🛑 USER CANCELLED: Scan {scan_id} terminated mid-process.")
    return jsonify({"status": "cancelled", "message": "Scan stopped by user"}), 200
