import os
from google import genai
from dotenv import load_dotenv
from models import db, ResultItem, AWSConfig, S3Config, IAMConfig, VPCConfig, EC2Config, EBSConfig

# Load .env from backend directory explicitly
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Initialize Gemini client with API key from environment
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY not found in environment variables. Check your .env file.")

client = genai.Client(api_key=api_key)

# In-scope keywords for validation
SCOPE_KEYWORDS = {
    # Core AWS
    "aws", "s3", "ec2", "iam", "vpc", "ebs",

    # Security concepts
    "security", "encryption", "mfa",
    "access key", "bucket", "instance",
    "role", "policy", "firewall",
    "compliance", "vulnerability",
    "misconfiguration", "cloud",
    "remediation", "mitigation",
    "fix", "solve", "secure",

    # CloudSentinel
    "cloudsentinel", "dashboard",
    "scan", "finding", "severity", "risk",

    # Actual finding names
    "imdsv1",
    "publicly open s3 bucket",
    "unrestricted outbound traffic",
    "over-permissive iam",
    "network segmentation",
    "wide-open ingress",
    "stale access keys",
    "password policy",
    "unencrypted ebs",
    "flow logs",
    "versioning disabled"
}

def format_cli_command(text):
    # Helper function: Formats AWS CLI commands with line breaks for better readability in UI
    import re
    
    # Find CLI command blocks
    cli_pattern = r'```\n(.*?)\n```'
    matches = re.findall(cli_pattern, text, re.DOTALL)
    
    for match in matches:
        # If command is already split with backslash, keep it
        if '\\' in match:
            continue
        
        # If command is very long (>120 chars), split it
        if len(match.strip()) > 120:
            original = match.strip()
            
            # Split by common AWS CLI delimiters (--flag)
            parts = re.split(r'(\s--)', original)
            
            # Reconstruct with backslash continuation
            if len(parts) > 1:
                formatted = parts[0]
                for i in range(1, len(parts)):
                    formatted += f" \\\n    --{parts[i]}"
                
                text = text.replace(f'```\n{match}\n```', f'```\n{formatted}\n```')
    
    return text

def is_query_in_scope(user_query):
    """
    Validates if query is related to AWS security / CloudSentinel
    """
    query_lower = user_query.lower().strip()

    # 1. Always allow greetings / capability questions
    greeting_keywords = [
        "hi", "hello", "hey", "greetings",
        "what can", "what do", "who are",
        "tell me about", "help",
        "explain cloudsentinel",
        "what is cloudsentinel",
        "capabilities", "features",
        "describe yourself", "what's your purpose",
        "how do i use", "introduce yourself",
        "info", "information", "overview", "start"
    ]

    if any(word in query_lower for word in greeting_keywords):
        return True

    # 2. Detect AWS/security context
    has_scope_keyword = any(
        keyword in query_lower
        for keyword in SCOPE_KEYWORDS
    )

    # 3. Detect remediation intent (VERY IMPORTANT FIX)
    remediation_keywords = [
        "how to", "fix", "solve", "mitigate",
        "remediate", "secure", "protect",
        "resolve", "best practice"
    ]

    has_remediation_intent = any(
        word in query_lower
        for word in remediation_keywords
    )

    # 4. Block obvious unrelated topics
    out_of_scope = [
        "weather", "recipe", "movie", "music",
        "sports", "joke", "politics",
        "travel advice", "medical",
        "legal advice", "book recommendation",
        "cooking"
    ]

    is_definitely_outside = any(
        word in query_lower for word in out_of_scope
    )

    # 5. FINAL DECISION LOGIC
    if is_definitely_outside and not has_scope_keyword:
        return False

    return has_scope_keyword or has_remediation_intent

def get_detailed_config_context(config_id, service):
    # Retrieves detailed configuration data for a specific AWS service to provide LLM context
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
    # Main LLM handler: Processes user queries and returns AI-powered security insights
    # STEP 1: Validate query is in scope
    if not is_query_in_scope(user_query):
        return (
            "❌ Out of scope. I only help with AWS security, cloud misconfigurations, "
            "and CloudSentinel findings. Please ask about security vulnerabilities, "
            "remediation steps, or AWS best practices."
        )
    
    # STEP 2: Gather database context ONLY if user explicitly asks about a specific finding
    # Check if user is asking about "this", "finding", "result", "issue", etc.
    context_packet = ""
    explicit_finding_keywords = [
        # generic references
        "this", "finding", "result", "issue",

        # explanation intent
        "what is", "explain", "tell me about", "analyze",

        # remediation intent
        "fix", "solve", "mitigate", "remediate",
        "secure", "patch", "resolve",
        "how to fix", "how to solve",
        "how to mitigate", "how to remediate",

        # AWS security intent
        "best practice", "recommendation",
        "protection", "hardening"
    ]
    MISCONFIG_NAMES = [
        "publicly open s3 bucket",
        "unrestricted outbound traffic",
        "over-permissive iam",
        "no network segmentation",
        "wide-open ingress",
        "lack of mfa",
        "stale access keys",
        "s3 bucket versioning disabled",
        "imdsv1 enabled",
        "weakly enforced password policy",
        "unencrypted ebs volumes",
        "flow logs"
    ]
    query_lower = user_query.lower()

    asking_about_finding = (
        any(keyword in query_lower for keyword in explicit_finding_keywords)
        or
        any(misconfig in query_lower for misconfig in MISCONFIG_NAMES)
    )
    
    if result_item_id and asking_about_finding:
        # Only include finding context if user explicitly asks about it
        item = ResultItem.query.get(result_item_id)
        if item:
            tech_details = get_detailed_config_context(item.config_id, item.aws_service)
            context_packet = f"""
            [FINDING] {item.aws_service} | Severity: {item.severity}
            Rule: {item.misconfig_name}
            Technical Data: {tech_details}
            """

    # STEP 3: ULTRA-CONCISE system instruction (both methods: Console + CLI)
    system_instruction = (
        "You are SentinelAI, AWS Security Assistant for CloudSentinel. "
        "RESPONSE FORMATS:\n"
        "\n"
        "1. FOR [FINDING] (Security Issues):\n"
        "🚨 RISK: (1 sentence explaining the danger)\n"
        "📋 AWS CONSOLE STEPS:\n"
        "   1. [Go to service/page]\n"
        "   2. [Action to take]\n"
        "   3. [Action to take]\n"
        "   4. [Save/Apply]\n"
        "💻 AWS CLI (OPTIONAL - one-liner only):\n"
        "```\n"
        "[SHORT AWS CLI command with \\ for line breaks if needed]\n"
        "```\n"
        "\n"
        "2. FOR GREETING/CAPABILITY QUESTIONS (what can you do, tell me about you, etc):\n"
        "- Do NOT repeat your name or full identity\n"
        "- Respond directly and naturally\n"
        "- Explain capabilities in 1–3 short sentences\n"
        "- Focus on what the system does, not who you are\n"
        "\n"
        "CRITICAL RULES:\n"
        "- Be EXTREMELY brief (max 250 words total)\n"
        "- For greetings: friendly but professional tone\n"
        "- Do not repeat your identity in every response\n"
        "- Only state identity when explicitly asked 'who are you' or 'introduce yourself'\n"
        "- For security findings: urgent, actionable tone\n"
        "- For out-of-scope: respond 'I only help with AWS security questions.'"
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{context_packet}\n\nUser Question: {user_query}",
            config={'system_instruction': system_instruction}
        )
        
        # STEP 4: Format CLI commands for readability
        response_text = format_cli_command(response.text)
        
        # STEP 5: STRICT response length (keep UI clean)
        if len(response_text) > 1300:  # ~270 words max for both methods
            response_text = response_text[:1200] + "\n\n⚠️ [Full response truncated - see AWS docs for details]"
        
        return response_text
    except Exception as e:
        error_str = str(e)

        # 🚨 HANDLE GEMINI 503 CLEANLY (NO RAW ERROR)
        if "503" in error_str or "UNAVAILABLE" in error_str:
            return (
                "⚠️ SentinelAI is temporarily busy.\n\n"
                "Please try again in a few seconds.\n\n"
                "💡 Quick fix for IMDSv1:\n"
                "Go to EC2 → Modify metadata options → Enable IMDSv2"
            )

        # 🚨 ANY OTHER ERROR (ALSO CLEAN)
        return (
            "⚠️ Something went wrong while processing your request.\n"
            "Please try again later."
        )