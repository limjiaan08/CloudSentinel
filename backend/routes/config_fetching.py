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

@config_fetching_bp.route('/fetch-config', methods=['POST'])
def fetch_config():
    data = request.get_json()
    scan_id = data.get('scan_id')
    access_key = data.get('accessKey')
    secret_key = data.get('secretKey')
    region = data.get('region')

    try:
        session = boto3.Session(aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name=region)
        
        # --- 0. IDENTITY DISCOVERY ---
        sts = session.client('sts')
        caller = sts.get_caller_identity()
        user_arn = caller['Arn']
        iam_user_name = user_arn.split('/')[-1] 

        target_tag = "Vuln" if "vuln" in iam_user_name.lower() else \
                     "Mixed" if "mixed" in iam_user_name.lower() else "Secure"

        print(f"\n{'='*60}")
        print(f"🚀 IDENTITY DETECTED: {iam_user_name} | TARGET MODEL: {target_tag}")
        print(f"{'='*60}")

        s3_client, iam_client, ec2_client = session.client('s3'), session.client('iam'), session.client('ec2')

        # --- KILL SWITCH HELPER ---
        def check_and_abort():
            db.session.expire_all() # Forces DB refresh
            s = db.session.get(Scan, scan_id)
            if s and s.scan_status == 'CANCELLED':
                db.session.rollback() 
                return True
            return False
        
        # --- 1. S3 SCAN (Versioning & Cancel Responsiveness) ---
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200
        print("\n📂 [1/6] Fetching S3 Bucket Configurations...")

        try:
            buckets = s3_client.list_buckets().get('Buckets', [])
            for b in buckets:
                if check_and_abort(): return jsonify({"status": "cancelled"}), 200
                
                name = b['Name']
                try:
                    tags = {t['Key']: t['Value'] for t in s3_client.get_bucket_tagging(Bucket=name).get('TagSet', [])}
                    
                    if tags.get('SecurityModel') == target_tag:
                        # A. Public Access
                        is_pub = False
                        try:
                            pab = s3_client.get_public_access_block(Bucket=name)['PublicAccessBlockConfiguration']
                            is_pub = not all([pab.get('BlockPublicAcls', True), pab.get('BlockPublicPolicy', True)])
                        except: is_pub = True 

                        # B. Encryption
                        has_enc = True
                        try: s3_client.get_bucket_encryption(Bucket=name)
                        except: has_enc = False

                        # C. Versioning (RULE-S3-03)
                        has_ver = False
                        try: has_ver = (s3_client.get_bucket_versioning(Bucket=name).get('Status') == 'Enabled')
                        except: pass

                        header = AWSConfig(scan_id=scan_id, resource_name=name, resource_type='S3')
                        db.session.add(header)
                        db.session.flush()
                        db.session.add(S3Config(config_id=header.config_id, is_public=is_pub, encryption_enabled=has_enc, versioning_enabled=has_ver))
                except ClientError: continue
        except Exception as e: print(f"S3 ERROR: {e}")

        # --- 2. EBS SCAN ---
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200
        print("\n💾 [2/6] Fetching EBS Volume Configurations...")
        volumes = ec2_client.describe_volumes().get('Volumes', [])
        for v in volumes:
            if check_and_abort(): return jsonify({"status": "cancelled"}), 200
            tags = {t['Key']: t['Value'] for t in v.get('Tags', [])}
            if tags.get('SecurityModel') == target_tag:
                header = AWSConfig(scan_id=scan_id, resource_name=v['VolumeId'], resource_type='EBS')
                db.session.add(header)
                db.session.flush()
                db.session.add(EBSConfig(config_id=header.config_id, encryption_enabled=bool(v.get('Encrypted'))))

        # --- 3. IAM SCAN (MFA FIX) ---
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200
        print("\n🔐 [3/6] Fetching IAM Configurations...")

        # --- 3a. IAM User (Strict MFA Detection for Current User) ---
        try:
            # 1. Fetch tags to see why the match might be failing
            u_tags = {t['Key']: t['Value'] for t in iam_client.list_user_tags(UserName=iam_user_name).get('Tags', [])}
            user_tag_value = str(u_tags.get('SecurityModel', '')).strip()

            # 2. DEBUG: This will show you exactly what is happening in the console
            print(f"      [DEBUG] IAM User: {iam_user_name} | Tag Found: '{user_tag_value}' | Searching for: '{target_tag}'")

            # 3. Proceed if tags match OR if this is the user we are specifically auditing
            if user_tag_value == target_tag:
                # Key Age Logic
                keys = iam_client.list_access_keys(UserName=iam_user_name).get('AccessKeyMetadata', [])
                max_age = 0
                for k in keys:
                    age = (get_my_time() - k['CreateDate'].replace(tzinfo=None)).days
                    max_age = max(max_age, age)
                
                # MFA Check - This is the core logic you need
                mfa_devices = iam_client.list_mfa_devices(UserName=iam_user_name).get('MFADevices', [])
                mfa_status = len(mfa_devices) > 0
                
                print(f"      [DEBUG] User MFA Check -> Devices: {len(mfa_devices)} | Detected Enabled: {mfa_status}")

                # Save the finding
                user_header = AWSConfig(scan_id=scan_id, resource_name=f"IAM User: {iam_user_name}", resource_type='IAM_USER')
                db.session.add(user_header)
                db.session.flush()
                
                db.session.add(IAMConfig(
                    config_id=user_header.config_id, 
                    mfa_enabled=mfa_status, # This will be False for your 'Vuln' user
                    key_age_days=max_age
                ))
            else:
                print(f"      [!] Skipping User {iam_user_name} - Tag mismatch.")

        except Exception as e:
            print(f"      [!] IAM User Error: {str(e)}")

        # 3b. Account Settings (Root MFA)
        if target_tag != "Secure": # Using 'Secure' as the 'Safe' equivalent for your tiers
            try:
                summary = iam_client.get_account_summary()['SummaryMap']
                mfa_root = bool(summary.get('AccountMFAEnabled', 0) == 1)
                
                print(f"      [DEBUG] Account Root | MFA Status: {mfa_root}")
                
                pw_strength = "Weak"
                try:
                    pol = iam_client.get_account_password_policy().get('PasswordPolicy', {})
                    if pol.get('MinimumPasswordLength', 0) >= 14 and pol.get('RequireSymbols'): 
                        pw_strength = "Strong"
                except: pass
                
                header_iam = AWSConfig(scan_id=scan_id, resource_name='Account Root Account', resource_type='IAM_GLOBAL')
                db.session.add(header_iam)
                db.session.flush()
                db.session.add(IAMConfig(
                    config_id=header_iam.config_id, 
                    mfa_enabled=mfa_root, 
                    password_policy_strength=pw_strength
                ))
            except Exception as e:
                print(f"      [!] ERROR in Global Scan: {str(e)}")

        # 3c. Roles (Untouched to prevent breaking Admin detection)
        roles = iam_client.list_roles().get('Roles', [])
        for r in roles:
            if check_and_abort(): return jsonify({"status": "cancelled"}), 200
            try:
                r_tags = {t['Key']: t['Value'] for t in iam_client.list_role_tags(RoleName=r['RoleName']).get('Tags', [])}
                if r_tags.get('SecurityModel') == target_tag:
                    attached = iam_client.list_attached_role_policies(RoleName=r['RoleName'])['AttachedPolicies']
                    header_role = AWSConfig(scan_id=scan_id, resource_name=r['RoleName'], resource_type='IAM_ROLE')
                    db.session.add(header_role)
                    db.session.flush()
                    db.session.add(IAMConfig(config_id=header_role.config_id, permissions=json.dumps([p['PolicyName'] for p in attached])))
            except: continue

        # --- 4. VPC SCAN (Updated for Segmentation Detection) ---
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200
        print("\n🌐 [4/6] Fetching VPC Configurations...")

        vpcs = ec2_client.describe_vpcs().get('Vpcs', [])
        for v in vpcs:
            if check_and_abort(): return jsonify({"status": "cancelled"}), 200
            tags = {t['Key']: t['Value'] for t in v.get('Tags', [])}
            
            if tags.get('SecurityModel') == target_tag:
                vpc_id = v['VpcId']
                
                # 1. Check Flow Logs (RULE-VPC-02)
                logs = ec2_client.describe_flow_logs(
                    Filters=[{'Name': 'resource-id', 'Values': [vpc_id]}]
                ).get('FlowLogs', [])
                
                # 2. NEW: Count Subnets (For RULE-VPC-01 Segmentation)
                subnets = ec2_client.describe_subnets(
                    Filters=[{'Name': 'vpc-id', 'Values': [vpc_id]}]
                ).get('Subnets', [])
                subnet_count = len(subnets)

                # We store the count in the resource_name so the Analysis Engine can read it
                res_display_name = f"VPC: {vpc_id} | Subnets: {subnet_count}"
                
                header = AWSConfig(scan_id=scan_id, resource_name=res_display_name, resource_type='VPC')
                db.session.add(header)
                db.session.flush()
                db.session.add(VPCConfig(
                    config_id=header.config_id, 
                    flow_logs_enabled=(len(logs) > 0)
                ))

        # --- 5. SECURITY GROUPS ---
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200
        print("\n🛡️ [5/6] Fetching Security Group Rules...")
        sgs = ec2_client.describe_security_groups().get('SecurityGroups', [])
        for sg in sgs:
            if check_and_abort(): return jsonify({"status": "cancelled"}), 200
            tags = {t['Key']: t['Value'] for t in sg.get('Tags', [])}
            if tags.get('SecurityModel') == target_tag:
                open_rules = []
                for perm in sg.get('IpPermissions', []):
                    for ip_range in perm.get('IpRanges', []):
                        if ip_range.get('CidrIp') == '0.0.0.0/0':
                            p = perm.get('FromPort', 'ALL')
                            open_rules.append(f"Port:{p}")
                header = AWSConfig(scan_id=scan_id, resource_name=sg['GroupName'], resource_type='EC2_SG')
                db.session.add(header)
                db.session.flush()
                db.session.add(EC2Config(config_id=header.config_id, open_ingress_rules=json.dumps(open_rules)))

        # --- 6. EC2 INSTANCE SCAN (For RULE-EC2-02 IMDS) ---
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200
        print("\n🖥️ [6/6] Fetching EC2 Instances for IMDS...")
        instances = ec2_client.describe_instances().get('Reservations', [])
        for res in instances:
            for inst in res['Instances']:
                if check_and_abort(): return jsonify({"status": "cancelled"}), 200
                tags = {t['Key']: t['Value'] for t in inst.get('Tags', [])}
                if tags.get('SecurityModel') == target_tag:
                    imds = 'v2' if inst.get('MetadataOptions', {}).get('HttpTokens') == 'required' else 'v1'
                    header = AWSConfig(scan_id=scan_id, resource_name=inst['InstanceId'], resource_type='EC2_INSTANCE')
                    db.session.add(header)
                    db.session.flush()
                    db.session.add(EC2Config(config_id=header.config_id, imds_version=imds))

        # --- COMMIT & ANALYZE ---
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200
        db.session.commit()
        end_dt, duration_sec = run_analysis(scan_id, target_model=target_tag)

        # --- FINAL INTEGRITY CHECK ---
        db.session.expire_all() 
        scan_record = db.session.get(Scan, scan_id)
        if not scan_record or scan_record.scan_status == 'CANCELLED':
            return jsonify({"status": "cancelled"}), 200
        
        if scan_record.scan_status == "IN_PROGRESS" and duration_sec > 0:
            scan_record.scan_status = "COMPLETED"
            scan_record.end_time = end_dt
            scan_record.duration = duration_sec
            db.session.commit()

        return jsonify({"status": "success", "scan_id": scan_id}), 200

    except Exception as e:
        db.session.rollback()
        db.session.expire_all()
        scan_record = db.session.get(Scan, scan_id)
        if scan_record and scan_record.scan_status != 'CANCELLED':
            scan_record.scan_status = "FAILED"
            db.session.commit()
        return jsonify({"error": str(e)}), 500