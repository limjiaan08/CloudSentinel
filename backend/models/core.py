from datetime import datetime
import uuid
from . import db
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

class Scan(db.Model):
    __tablename__ = 'scan'
    scan_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('user.user_id'), nullable=False)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    duration = Column(Integer, nullable=True)
    scan_status = Column(String(20), default='PENDING')

    aws_configs = relationship('AWSConfig', backref='scan', lazy=True)
    results = relationship('Result', backref='scan', lazy=True)

class PredefinedRule(db.Model):
    __tablename__ = 'predefined_rule'
    rule_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    rule_name = Column(String(255), nullable=False, unique=True)
    aws_service = Column(String(10), nullable=False)
    cnas_category = Column(String(10), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), nullable=False)
