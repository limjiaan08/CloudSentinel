from flask import Flask
from dotenv import load_dotenv
import os
from flask_cors import CORS
from models import db
from routes.auth import auth_bp, mail # mail is imported from auth.py
from routes.connection import connection_bp
from routes.config_fetching import config_fetching_bp
from routes.result_fetching import result_fetching_bp
from routes.scan_history import scan_history_bp
from routes.ai_routes import ai_bp

load_dotenv()

app = Flask(__name__)

# --- NEW: SECURITY CONFIG ---
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

# --- NEW: MAIL CONFIGURATION ---
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER')

# Initialize Mail with App
mail.init_app(app)

# --- CORS Configuration ---
CORS(app, resources={r"/*": {
    "origins": "http://localhost:5173",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

# Database Configuration
db_user = os.getenv('DB_USER', 'root')
db_password = os.getenv('DB_PASSWORD', '')
db_host = os.getenv('DB_HOST', 'localhost')
db_name = os.getenv('DB_NAME', 'cloudsentinel_db')

app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+mysqlconnector://{db_user}:{db_password}@{db_host}/{db_name}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Register Blueprints
app.register_blueprint(auth_bp, url_prefix='/auth')
app.register_blueprint(connection_bp, url_prefix='/api')
app.register_blueprint(config_fetching_bp, url_prefix='/api')
app.register_blueprint(result_fetching_bp, url_prefix='/api')
app.register_blueprint(scan_history_bp, url_prefix='/api')
app.register_blueprint(ai_bp, url_prefix='/api')

@app.route('/')
def home():
    return "CloudSentinel API is running"

if __name__ == '__main__':
    app.run(debug=True, port=5000)