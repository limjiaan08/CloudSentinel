from flask import Blueprint, request, jsonify
from routes.ai_assistant import get_sentinel_response

ai_bp = Blueprint('ai', __name__)

@ai_bp.route('/chat', methods=['POST', 'OPTIONS'])
def chat_with_sentinel():
    """
    Main endpoint for the LLM Chatbot.
    Expects JSON: { "message": "...", "result_item_id": "..." }
    Note: result_item_id is optional.
    """
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