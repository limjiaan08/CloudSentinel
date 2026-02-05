import uuid
from datetime import datetime
from . import db
from sqlalchemy import Column, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

class Result(db.Model):
    __tablename__ = 'results'  
    result_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    scan_id = Column(String(36), ForeignKey('scan.scan_id'), nullable=False)
    detected_at = Column(DateTime, default=datetime.utcnow)

    items = relationship('ResultItem', backref='result', lazy=True)

class ResultItem(db.Model):
    __tablename__ = 'result_item'  
    result_item_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    result_id = Column(String(36), ForeignKey('results.result_id'), nullable=False)
    config_id = Column(String(36), ForeignKey('aws_config.config_id'), nullable=False)
    rule_id = Column(String(36), ForeignKey('predefined_rule.rule_id'), nullable=False)
    cnas_category = Column(String(20), nullable=True)
    misconfig_name = Column(String(100), nullable=True)
    aws_service = Column(String(10), nullable=True)
    severity = Column(String(10), nullable=True)
    description = Column(Text, nullable=True)
    detected_at = Column(DateTime, default=datetime.utcnow)