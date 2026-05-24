from flask import Blueprint, request, jsonify
from routes.ai_assistant import get_sentinel_response
from routes.auth import token_required

ai_bp = Blueprint('ai', __name__)

@ai_bp.route('/chat', methods=['POST', 'OPTIONS'])
@token_required
def chat_with_sentinel():
    # Endpoint: LLM chatbot interface requiring JWT token authentication for user queries
    if request.method == 'OPTIONS':
        return jsonify({"status": "ok"}), 200
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({"error": "No message provided"}), 400

        user_message = data.get('message')
        # This will be None if the user hasn't started a scan or clicked a finding
        result_item_id = data.get('result_item_id')

        # Call LLM logic
        ai_reply = get_sentinel_response(user_message, result_item_id)

        return jsonify({
            "status": "success",
            "reply": ai_reply
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error", 
            "message": f"Server encountered an error: {str(e)}"
        }), 500