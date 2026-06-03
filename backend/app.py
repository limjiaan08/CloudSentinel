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

# Load .env from backend directory explicitly
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

app = Flask(__name__)

# --- SECURITY CONFIG ---
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')

# --- MAIL CONFIGURATION ---
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER')

# Initialize Mail with App
mail.init_app(app)

# --- CORS Configuration ---
frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
CORS(app, resources={r"/*": {
    "origins": frontend_url,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"]
}})

# --- DATABASE ROUTING CONFIGURATION (LOCAL MYSQL VS AIVEN CLOUD) ---
DATABASE_URL = os.environ.get('DATABASE_URL')

if os.environ.get('RENDER') and DATABASE_URL:
    # Production: Use the Aiven Cloud MySQL URI string and route via pymysql driver
    if DATABASE_URL.startswith("mysql://"):
        DATABASE_URL = DATABASE_URL.replace("mysql://", "mysql+pymysql://", 1)
    
    app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
    print("Cloud Mode: Connected to Free Aiven MySQL Cloud Database Tier.")
else:
    # Local Development: Fall back to your laptop's original local MySQL server
    db_user = os.getenv('DB_USER', 'root')
    db_password = os.getenv('DB_PASSWORD', '')
    db_host = os.getenv('DB_HOST', 'localhost')
    db_name = os.getenv('DB_NAME', 'cloudsentinel_db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+mysqlconnector://{db_user}:{db_password}@{db_host}/{db_name}"
    print("Local Mode: Connected to local MySQL server...")

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

# --- AUTO-CREATE TABLES ON THE CLOUD DATABASE ---
if os.environ.get('RENDER'):
    with app.app_context():
        db.create_all()
        print("Database tables initialized successfully on the Aiven cloud cluster!")

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
    app.run(debug=False, port=5000)