from flask import Flask
from dotenv import load_dotenv
import os 
from models import db
from models.auth import User, Session
from models.core import Scan,PredefinedRule
from models.aws import AWSConfig, S3Config, IAMConfig, VPCConfig, EC2Config, EBSConfig
from models.reporting import Result, ResultItem

load_dotenv() #load environment variables

app = Flask(__name__)

#configure the database connection
db_user = os.getenv('DB_USER', 'root')
db_password = os.getenv('DB_PASSWORD', '')
db_host = os.getenv('DB_HOST', 'localhost')
db_name = os.getenv('DB_NAME', 'cloudsentinel_db')

#connection address
app.config['SQLALCHEMY_DATABASE_URI'] = f"mysql+mysqlconnector://{db_user}:{db_password}@{db_host}/{db_name}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

#connect the db tool to the app
db.init_app(app)

with app.app_context():
    #check the database
    db.create_all()    