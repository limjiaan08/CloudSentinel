import uuid
import pytz
from datetime import datetime
from . import db
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship

def get_my_time():
    return datetime.now(pytz.timezone('Asia/Kuala_Lumpur'))
class User(db.Model):
    __tablename__ = 'user'
    user_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4())) #automation rule
    user_name = Column(String(100), nullable=False)
    user_email = Column(String(255), unique=True, nullable=False)
    user_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=get_my_time)

    sessions = relationship('Session', backref='user', lazy=True) 
    #backref: add a hidden property to the Session objects
    #lazy=True: performance optimization
    scans = relationship('Scan', backref='user', lazy=True)

class Session(db.Model):
    __tablename__ = 'session'
    session_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('user.user_id'), nullable=False)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    duration = Column(Integer, nullable=True)
