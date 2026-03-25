import boto3
from botocore.exceptions import ClientError

# --- CONFIGURATION ---
ACCESS_KEY = "KEY"
SECRET_KEY = "KEY"
REGION     = "ap-southeast-2" 

def run_full_vuln_audit():
    session = boto3.Session(
        aws_access_key_id=ACCESS_KEY,
        aws_secret_access_key=SECRET_KEY,
        region_name=REGION
    )
    
    s3 = session.client('s3')
    ec2 = session.client('ec2')

    print("🚀 CloudSentinel: Starting Full Vulnerable Model Audit...")
    print("="*60)

    # ==========================================
    # 1. S3 AUDIT (CNAS-1)
    # ==========================================
    print("\n--- 📦 CATEGORY: S3 STORAGE ---")
    try:
        buckets = s3.list_buckets()['Buckets']
        for b in buckets:
            name = b['Name']
            try:
                # Check for Access Permission
                s3.get_bucket_location(Bucket=name)
                print(f"Checking Bucket: {name}")
                
                # Check Public Access Block
                try:
                    pab = s3.get_public_access_block(Bucket=name)['PublicAccessBlockConfiguration']
                    if not all(pab.values()): print("   ❌ FAIL: Public Access Block is DISABLED")
                    else: print("   ✅ PASS: Public Access Block is Active")
                except: print("   ❌ FAIL: No Public Access Block Configured")

                # Check Encryption
                try:
                    enc = s3.get_bucket_encryption(Bucket=name)
                    algo = enc['ServerSideEncryptionConfiguration']['Rules'][0]['ApplyServerSideEncryptionByDefault']['SSEAlgorithm']
                    if algo == 'AES256': print("   ❌ FAIL: Weak Encryption (SSE-S3)")
                    else: print("   ✅ PASS: Strong Encryption (KMS)")
                except: print("   ❌ FAIL: No Explicit Encryption Configured")

            except ClientError:
                print(f"🚫 Skipping {name}: Access Denied (Isolation Working)")
    except Exception as e: print(f"⚠️ S3 Error: {e}")

    # ==========================================
    # 2. EBS AUDIT (CNAS-1)
    # ==========================================
    print("\n--- 💾 CATEGORY: EBS VOLUMES ---")
    try:
        volumes = ec2.describe_volumes()['Volumes']
        for vol in volumes:
            vol_id = vol['VolumeId']
            print(f"Checking Volume: {vol_id}")
            if not vol.get('Encrypted'):
                print("   ❌ FAIL: Volume is UNENCRYPTED")
            else:
                print("   ✅ PASS: Volume is Encrypted")
    except Exception as e: print(f"⚠️ EBS Error: {e}")

    # ==========================================
    # 3. SECURITY GROUP AUDIT (CNAS-6)
    # ==========================================
    print("\n--- 🛡️  CATEGORY: NETWORK POLICIES ---")
    try:
        sgs = ec2.describe_security_groups()['SecurityGroups']
        for sg in sgs:
            sg_id = sg['GroupId']
            print(f"Checking Security Group: {sg_id} ({sg.get('GroupName')})")
            
            is_vulnerable = False
            for rule in sg.get('IpPermissions', []):
                # Check if Port 22 is open to the world
                if rule.get('ToPort') == 22:
                    for ip_range in rule.get('IpRanges', []):
                        if ip_range.get('CidrIp') == '0.0.0.0/0':
                            is_vulnerable = True
            
            if is_vulnerable:
                print("   ❌ FAIL: Port 22 (SSH) is OPEN TO THE WORLD (0.0.0.0/0)")
            else:
                print("   ✅ PASS: No wide-open management ports found")
    except Exception as e: print(f"⚠️ SG Error: {e}")

    print("\n" + "="*60)
    print("AUDIT COMPLETE.")

if __name__ == "__main__":
    run_full_vuln_audit()