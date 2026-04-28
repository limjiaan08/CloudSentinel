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
    # Retrieve scan parameters and credentials from the frontend
    data = request.get_json()
    scan_id = data.get('scan_id')
    access_key = data.get('accessKey')
    secret_key = data.get('secretKey')
    region = data.get('region')

    try:
        # Initiate Boto3 Session
        session = boto3.Session(aws_access_key_id=access_key, aws_secret_access_key=secret_key, region_name=region)
        
        # Identity discovery
        sts = session.client('sts')
        caller = sts.get_caller_identity()
        user_arn = caller['Arn']
        # Extract the username from the ARN
        iam_user_name = user_arn.split('/')[-1] 
        # Tag-based filtering 
        # Due to the constraint of only one AWS account (will use 3 IAM users to represent different scenario)
        target_tag = "Vuln" if "vuln" in iam_user_name.lower() else \
                     "Mixed" if "mixed" in iam_user_name.lower() else "Secure"

        print(f"\n{'='*60}")
        print(f"🚀 IDENTITY DETECTED: {iam_user_name} | TARGET MODEL: {target_tag}")
        print(f"{'='*60}")

        # Initialize specific AWS service clients for use in subsequent scan steps
        s3_client, iam_client, ec2_client = session.client('s3'), session.client('iam'), session.client('ec2')

        # --- KILL SWITCH HELPER ---
        def check_and_abort():
            # Check the DB to see if the scan status has changed to CANCELLED
            # Prevent further AWS API calss and roll back DB changes
            db.session.expire_all() # Forces DB refresh
            s = db.session.get(Scan, scan_id)
            if s and s.scan_status == 'CANCELLED':
                db.session.rollback() 
                return True
            return False
        
        # --- 1. S3 SCAN ---
        # Check for a cancellation signal
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200
        print("\n📂 [1/6] Fetching S3 Bucket Configurations...")

        try:
            # Retrieve all buckets available in the account
            buckets = s3_client.list_buckets().get('Buckets', [])
            for b in buckets:
                # Check for scan cancellation 
                if check_and_abort(): return jsonify({"status": "cancelled"}), 200
                
                name = b['Name']
                try:
                    # Fiter by tag (IAM user tag key and value)
                    tags = {t['Key']: t['Value'] for t in s3_client.get_bucket_tagging(Bucket=name).get('TagSet', [])}
                    
                    if tags.get('SecurityModel') == target_tag:
                        # A. Public Access
                        is_pub = False
                        try:
                            pab = s3_client.get_public_access_block(Bucket=name)['PublicAccessBlockConfiguration']
                            is_pub = not all([pab.get('BlockPublicAcls', True), pab.get('BlockPublicPolicy', True)])
                        except: is_pub = True 

                        # B. Encryption (already enabled by default by AWS)
                        has_enc = True
                        try: s3_client.get_bucket_encryption(Bucket=name)
                        except: has_enc = False

                        # C. Versioning (RULE-S3-03)
                        # NEW MISCONFIG (Check for whether version is enabled or not so that data recovery is possible)
                        has_ver = False
                        try: has_ver = (s3_client.get_bucket_versioning(Bucket=name).get('Status') == 'Enabled')
                        except: pass

                        # Database insertion
                        header = AWSConfig(scan_id=scan_id, resource_name=name, resource_type='S3')
                        db.session.add(header)
                        db.session.flush()
                        db.session.add(S3Config(config_id=header.config_id, is_public=is_pub, encryption_enabled=has_enc, versioning_enabled=has_ver))
                except ClientError: continue 
        except Exception as e: print(f"S3 ERROR: {e}")

        # --- 2. EBS SCAN ---
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200
        print("\n💾 [2/6] Fetching EBS Volume Configurations...")

        # Fetch all EBS volumes in the current region (Region specific)
        volumes = ec2_client.describe_volumes().get('Volumes', [])
        for v in volumes:
            if check_and_abort(): return jsonify({"status": "cancelled"}), 200

            # Convert AWS tag list into Python dictionary
            tags = {t['Key']: t['Value'] for t in v.get('Tags', [])}
            if tags.get('SecurityModel') == target_tag:
                header = AWSConfig(scan_id=scan_id, resource_name=v['VolumeId'], resource_type='EBS')
                db.session.add(header)
                db.session.flush()
                db.session.add(EBSConfig(config_id=header.config_id, encryption_enabled=bool(v.get('Encrypted'))))

        # --- 3. IAM SCAN ---
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200
        print("\n🔐 [3/6] Fetching IAM Configurations...")

        # 3a. IAM User (Strict MFA Detection for Current User)
        try:
            u_tags = {t['Key']: t['Value'] for t in iam_client.list_user_tags(UserName=iam_user_name).get('Tags', [])}
            user_tag_value = str(u_tags.get('SecurityModel', '')).strip()

            print(f"      [DEBUG] IAM User: {iam_user_name} | Tag Found: '{user_tag_value}' | Searching for: '{target_tag}'")

            if user_tag_value == target_tag:
                # NEW MISCONFIG (Check Access Key Age whether more than 7 days or not)
                keys = iam_client.list_access_keys(UserName=iam_user_name).get('AccessKeyMetadata', [])

                print(f"      [🔍] Checking {len(keys)} Access Keys for staleness...")

                max_age = 0
                for k in keys:
                    # Heartbeat check
                    if check_and_abort(): return jsonify({"status": "cancelled"}), 200
                    
                    create_date = k['CreateDate'].replace(tzinfo=None)
                    age = (get_my_time() - create_date).days
                    
                    status = "STALE" if age > 7 else "VALID"
                    print(f"      [Key: {k['AccessKeyId']}] Age: {age} days | Status: {status}")
                    
                    max_age = max(max_age, age)
                
                # Summary message
                print(f"      [✅] Final Max Key Age for {iam_user_name}: {max_age} days")

                # Check if the user has MFA enabled
                mfa_devices = iam_client.list_mfa_devices(UserName=iam_user_name).get('MFADevices', [])
                mfa_status = len(mfa_devices) > 0
                
                print(f"      [DEBUG] User MFA Check -> Devices: {len(mfa_devices)} | Detected Enabled: {mfa_status}")

                # Save results for the IAM user
                user_header = AWSConfig(scan_id=scan_id, resource_name=f"IAM User: {iam_user_name}", resource_type='IAM_USER')
                db.session.add(user_header)
                db.session.flush()
                
                db.session.add(IAMConfig(
                    config_id=user_header.config_id, 
                    mfa_enabled=mfa_status,
                    key_age_days=max_age
                ))
            else:
                print(f"      [!] Skipping User {iam_user_name} - Tag mismatch.")

        except Exception as e:
            print(f"      [!] IAM User Error: {str(e)}")

        # 3b. Account Settings (Root MFA)
        # Only perfomred for specific target tiers to avoid redundant global checks
        if target_tag != "Secure": # Using 'Secure' as the 'Safe' equivalent for your tiers
            try:
                summary = iam_client.get_account_summary()['SummaryMap']
                mfa_root = bool(summary.get('AccountMFAEnabled', 0) == 1)
                
                print(f"      [DEBUG] Account Root | MFA Status: {mfa_root}")
                
                # Evaluate password policy strength (Strong = 14+ chars + symbols)
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
        # Fetch all roles available in the AWS account
        roles = iam_client.list_roles().get('Roles', [])
        for r in roles:
            if check_and_abort(): return jsonify({"status": "cancelled"}), 200
            try:
                r_tags = {t['Key']: t['Value'] for t in iam_client.list_role_tags(RoleName=r['RoleName']).get('Tags', [])}
                if r_tags.get('SecurityModel') == target_tag:
                    # Get the list of manaed policies attached to this specific role
                    attached = iam_client.list_attached_role_policies(RoleName=r['RoleName'])['AttachedPolicies']
                    header_role = AWSConfig(scan_id=scan_id, resource_name=r['RoleName'], resource_type='IAM_ROLE')
                    db.session.add(header_role)
                    db.session.flush()
                    db.session.add(IAMConfig(config_id=header_role.config_id, permissions=json.dumps([p['PolicyName'] for p in attached])))
            except: continue

        # --- 4. VPC SCAN  ---
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200
        print("\n🌐 [4/6] Fetching VPC Configurations...")

        # Fetch basic VPC metadata
        vpcs = ec2_client.describe_vpcs().get('Vpcs', [])
        for v in vpcs:
            if check_and_abort(): return jsonify({"status": "cancelled"}), 200
            tags = {t['Key']: t['Value'] for t in v.get('Tags', [])}
            
            if tags.get('SecurityModel') == target_tag:
                vpc_id = v['VpcId']
                
                # 1. Check Flow Logs
                logs = ec2_client.describe_flow_logs(
                    Filters=[{'Name': 'resource-id', 'Values': [vpc_id]}]
                ).get('FlowLogs', [])
                
                # 2. Network segmentation
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

        # Retrieve all security groups in the region 
        sgs = ec2_client.describe_security_groups().get('SecurityGroups', [])
        for sg in sgs:
            if check_and_abort(): return jsonify({"status": "cancelled"}), 200
            tags = {t['Key']: t['Value'] for t in sg.get('Tags', [])}
            if tags.get('SecurityModel') == target_tag:
                open_ingress=[]
                open_egress=[]

                # 1. Scan Ingress (Inbound)
                for perm in sg.get('IpPermissions', []):
                    for ip_range in perm.get('IpRanges', []):
                        # Flags 0.0.0.0/0 (Open to the whole internet)
                        if ip_range.get('CidrIp') == '0.0.0.0/0':
                            p = perm.get('FromPort', 'ALL')
                            open_ingress.append(f"Port:{p}")

                # 2. Scan Egress (Outbound)
                # IpPermissionsEgress handles the traffic leaving the resource
                for perm in sg.get('IpPermissionsEgress', []):
                    for ip_range in perm.get('IpRanges', []):
                        # Flags 0.0.0.0/0 (Traffic can leave to any destination)
                        # IpProtocol '-1' indicates 'ALL' protocols/ports
                        if ip_range.get('CidrIp') == '0.0.0.0/0':
                            p = perm.get('FromPort', 'ALL')
                            if perm.get('IpProtocol') == '-1':
                                open_egress.append("Port:ALL")
                            else:
                                open_egress.append(f"Port:{p}")
                header = AWSConfig(scan_id=scan_id, resource_name=sg['GroupName'], resource_type='EC2_SG')
                db.session.add(header)
                db.session.flush()
                db.session.add(EC2Config(
                    config_id=header.config_id, 
                    open_ingress_rules=json.dumps(open_ingress),
                    open_egress_rules=json.dumps(open_egress)  # Now populating your new column
                ))

        # --- 6. EC2 INSTANCE SCAN ---
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200
        print("\n🖥️ [6/6] Fetching EC2 Instances for IMDS...")

        # Fetch all instances
        instances = ec2_client.describe_instances().get('Reservations', [])
        for res in instances:
            for inst in res['Instances']:
                if check_and_abort(): return jsonify({"status": "cancelled"}), 200
                tags = {t['Key']: t['Value'] for t in inst.get('Tags', [])}
                if tags.get('SecurityModel') == target_tag:
                    # NEW MISCONFIG (Check for IMDSv2 enforcement)
                    # Instance Metadata Service V1 is vulnerable to SSRF (server-side request forgery) attacks
                    imds = 'v2' if inst.get('MetadataOptions', {}).get('HttpTokens') == 'required' else 'v1'
                    header = AWSConfig(scan_id=scan_id, resource_name=inst['InstanceId'], resource_type='EC2_INSTANCE')
                    db.session.add(header)
                    db.session.flush()
                    db.session.add(EC2Config(config_id=header.config_id, imds_version=imds))

        # --- COMMIT & ANALYZE ---
        if check_and_abort(): return jsonify({"status": "cancelled"}), 200

        # Save all fetched configurations
        db.session.commit()
        end_dt, duration_sec = run_analysis(scan_id, target_model=target_tag)

        # --- FINAL INTEGRITY CHECK ---
        # Refresh the session to see if the scan is cancelled during analysis
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