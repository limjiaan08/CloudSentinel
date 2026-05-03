import os
from google import genai
from dotenv import load_dotenv
from models import db, ResultItem, AWSConfig, S3Config, IAMConfig, VPCConfig, EC2Config, EBSConfig

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def get_detailed_config_context(config_id, service):
    # Dives into service-specific tables to extractt the exact technical state for the LLM
    header = AWSConfig.query.get(config_id)
    if not header:
        return "No specific resource data found."
    
    details = {
        "resource_name": header.resource_name,
        "resource_type": header.resource_type
    }

    # --- S3 Service Fix ---
    if service == 'S3' and header.s3:
        details.update({
            "is_public": header.s3.is_public,
            "encryption_enabled": header.s3.encryption_enabled,
            "versioning_enabled": header.s3.versioning_enabled
        })

    # --- EC2 Service Fix ---
    elif service == 'EC2' and header.ec2:
        details.update({
            "imds_version": header.ec2.imds_version,
            "open_ingress_rules": header.ec2.open_ingress_rules,
            "open_egress_rules": header.ec2.open_egress_rules,
            "security_groups": header.ec2.security_groups
        })

    # --- IAM Service Fix (Updated to match your provided schema) ---
    elif service == 'IAM' and header.iam:
        details.update({
            "mfa_enabled": bool(header.iam.mfa_enabled),  # tinyint(1) to Boolean
            "key_age_days": header.iam.key_age_days,
            "password_policy_strength": header.iam.password_policy_strength,
            "permissions_summary": header.iam.permissions
        })

    # --- VPC Service Fix ---
    elif service == 'VPC' and header.vpc:
        details.update({
            "flow_logs_enabled": header.vpc.flow_logs_enabled,
            "subnets": header.vpc.subnets_list
        })

    # --- EBS Service Fix ---
    elif service == 'EBS' and header.ebs:
        details.update({
            "encryption_enabled": header.ebs.encryption_enabled
        })

    return details

def get_sentinel_response(user_query, result_item_id=None):
    # The main LLM logic: Combines DB findings with Gemini's intelligence.
    context_packet = ""

    # 1. ATTEMPT TO GATHER DATABASE CONTEXT
    if result_item_id:
        item = ResultItem.query.get(result_item_id)
        if item:
            tech_details = get_detailed_config_context(item.config_id, item.aws_service)
            context_packet = f"""
            [CRITICAL SECURITY FINDING]
            Service: {item.aws_service}
            Severity: {item.severity}
            Category: {item.cnas_category}
            Detection Rule: {item.misconfig_name}
            Technical Data: {tech_details}
            System Description: {item.description}
            """

    # 2. SYSTEM INSTRUCTIONS (The LLM's Persona)
    system_instruction = (
        "You are SentinelAI, an elite Cloud Security Co-Pilot. "
        "You specialize in the CNAS framework (1, 3, and 6). "
        "BEHAVIOR RULES:\n"
        "1. If [CRITICAL SECURITY FINDING] is present, provide a tailored fix for that specific resource.\n"
        "2. If no finding is present, act as a general cloud security consultant.\n"
        "3. Always explain the RISK first.\n"
        "4. Provide step-by-step AWS Console remediation.\n"
        "5. Provide a code block with the exact AWS CLI command.\n"
        "6. If asked about the system, mention the 'Dashboard', 'Connect', or 'History' pages."
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=f"{context_packet}\n\nUser Question: {user_query}",
            config={'system_instruction': system_instruction}
        )
        return response.text
    except Exception as e:
        return f"SentinelAI is currently unavailable. Error: {str(e)}"