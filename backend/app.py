from flask import Flask
from dotenv import load_dotenv
import os
from flask_cors import CORS
from models import db
from routes.auth import auth_bp

load_dotenv()

app = Flask(__name__)
CORS(app)

db_user = os.getenv('DB_USER', 'root')
db_password = os.getenv('DB_PASSWORD', '')
db_host = os.getenv('DB_HOST', 'localhost')
db_name = os.getenv('DB_NAME', 'cloudsentinel_db')

app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+mysqlconnector://{db_user}:{db_password}@{db_host}/{db_name}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

app.register_blueprint(auth_bp, url_prefix='/api/auth')

@app.route('/')
def home():
    return "CloudSentinel API is running"

if __name__ == '__main__':
    app.run(debug=True, port=5000)