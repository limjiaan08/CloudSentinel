from flask import Blueprint, request, jsonify
from models import db, Scan, AWSConfig, S3Config, IAMConfig, VPCConfig, EC2Config, EBSConfig
import boto3
from botocore.exceptions import ClientError
from datetime import datetime
import pytz
import json

config_bp = Blueprint('configfetching', __name__)

def get_my_time():
    kl_tz = pytz.timezone('Asia/Kuala_Lumpur')
    return datetime.now(kl_tz).replace(tzinfo=None)

@config_bp.route('/fetch-config', methods=['POST'])
def fetch_config():
    data = request.get_json()
    scan_id = data.get('scan_id')
    access_key = data.get('accessKey')
    secret_key = data.get('secretKey')
    region = data.get('region')

    try:
        session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region
        )
        s3_client = session.client('s3')
        iam_client = session.client('iam')
        ec2_client = session.client('ec2')

        # --- 1. S3 (CNAS-1: Unencrypted & Publicly Open) ---
        print("DEBUG: Starting S3 Scan...")
        buckets = s3_client.list_buckets().get('Buckets', [])
        for b in buckets:
            name = b['Name']
            header = AWSConfig(scan_id=scan_id, resource_name=name, resource_type='S3')
            db.session.add(header)
            db.session.flush()

            is_pub = False
            try:
                pab = s3_client.get_public_access_block(Bucket=name)
                conf = pab['PublicAccessBlockConfiguration']
                if not all([conf['BlockPublicAcls'], conf['BlockPublicPolicy']]):
                    is_pub = True
            except ClientError: is_pub = True 

            has_enc = True
            try: s3_client.get_bucket_encryption(Bucket=name)
            except ClientError: has_enc = False

            db.session.add(S3Config(config_id=header.config_id, is_public=is_pub, encryption_enabled=has_enc))
            print(f"DEBUG: Scanned S3: {name} | Public: {is_pub}, Enc: {has_enc}")

        # --- 2. EBS (CNAS-1: Unencrypted EBS) ---
        print("DEBUG: Starting EBS Scan...")
        volumes = ec2_client.describe_volumes().get('Volumes', [])
        for v in volumes:
            vol_id = v['VolumeId']
            is_enc = bool(v.get('Encrypted', False)) 
            header = AWSConfig(scan_id=scan_id, resource_name=vol_id, resource_type='EBS')
            db.session.add(header)
            db.session.flush()
            db.session.add(EBSConfig(config_id=header.config_id, encryption_enabled=is_enc))
            print(f"DEBUG: Scanned EBS: {vol_id} | Enc: {is_enc}")

        # --- 3. IAM (MFA Root / Password Policy / Admin Roles) ---
        try:
            print("DEBUG: Starting IAM Scan...")
            # A. Account Level
            header = AWSConfig(scan_id=scan_id, resource_name='Account Settings', resource_type='IAM_GLOBAL')
            db.session.add(header)
            db.session.flush()
            
            summary = iam_client.get_account_summary()['SummaryMap']
            mfa_root = bool(summary.get('AccountMFAEnabled', 0) == 1)
            
            pw_strength = "Weak"
            try:
                pol = iam_client.get_account_password_policy()['PasswordPolicy']
                if pol.get('MinimumPasswordLength', 0) >= 14 and pol.get('RequireSymbols'):
                    pw_strength = "Strong"
            except ClientError: 
                pw_strength = "None"
            
            db.session.add(IAMConfig(config_id=header.config_id, mfa_enabled=mfa_root, password_policy_strength=pw_strength))
            print(f"DEBUG: IAM Global - MFA: {mfa_root}, Policy: {pw_strength}")

            # B. Over-permissive Roles
            roles = iam_client.list_roles()['Roles']
            for r in roles:
                if '/aws-service-role/' in r['Path']: continue
                role_name = r['RoleName']
                role_header = AWSConfig(scan_id=scan_id, resource_name=role_name, resource_type='IAM_ROLE')
                db.session.add(role_header)
                db.session.flush()
                attached = iam_client.list_attached_role_policies(RoleName=role_name)['AttachedPolicies']
                policy_names = [p['PolicyName'] for p in attached]
                db.session.add(IAMConfig(config_id=role_header.config_id, permissions=json.dumps(policy_names)))
                print(f"DEBUG: Scanned Role: {role_name} | Policies: {policy_names}")
        except Exception as iam_err:
            print(f"DEBUG: IAM SCAN ERROR: {iam_err}")

        # --- 4. VPC (CNAS-6: Flow Logs & Segmentation) ---
        print("DEBUG: Starting VPC Scan...")
        vpcs = ec2_client.describe_vpcs().get('Vpcs', [])
        for v in vpcs:
            vpc_id = v['VpcId']
            is_default = v.get('IsDefault', False)
            res_name = f"Default VPC ({vpc_id})" if is_default else vpc_id
            
            header = AWSConfig(scan_id=scan_id, resource_name=res_name, resource_type='VPC')
            db.session.add(header)
            db.session.flush()
            
            logs = ec2_client.describe_flow_logs(
                Filters=[{'Name': 'resource-id', 'Values': [vpc_id]}]
            ).get('FlowLogs', [])
            
            has_logs = len(logs) > 0
            db.session.add(VPCConfig(config_id=header.config_id, flow_logs_enabled=has_logs))
            print(f"DEBUG: Scanned VPC: {res_name} | Flow Logs: {has_logs}")

        # --- 5. Security Groups (CNAS-6: Wide-Open Ingress) ---
        print("DEBUG: Starting Security Group Scan...")
        sgs = ec2_client.describe_security_groups().get('SecurityGroups', [])
        for sg in sgs:
            sg_name = sg['GroupName']
            header = AWSConfig(scan_id=scan_id, resource_name=sg_name, resource_type='EC2_SG')
            db.session.add(header)
            db.session.flush()
            
            open_rules = []
            for perm in sg.get('IpPermissions', []):
                for ip_range in perm.get('IpRanges', []):
                    if ip_range.get('CidrIp') == '0.0.0.0/0':
                        from_port = perm.get('FromPort', 'All')
                        proto = perm.get('IpProtocol', 'tcp')
                        open_rules.append(f"Port:{from_port} Protocol:{proto}")
            
            db.session.add(EC2Config(
                config_id=header.config_id,
                open_ingress_rules=json.dumps(open_rules)
            ))
            print(f"DEBUG: Scanned SG: {sg_name} | Open Rules: {open_rules}")

        # 3. Finalize Scan Record
        scan = Scan.query.get(scan_id)
        if scan:
            scan.scan_status = 'COMPLETED'
            scan.end_time = get_my_time()
            if scan.start_time:
                scan.duration = int(scan.end_time.timestamp() - scan.start_time.timestamp())
        
        db.session.commit()
        print("DEBUG: Final Database Commit Executed Successfully")
        
        return jsonify({
            "status": "success", 
            "message": "Full scan completed successfully",
            "volumes_found": len(volumes)
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"GENERAL ERROR: {str(e)}")
        return jsonify({"error": str(e)}), 500