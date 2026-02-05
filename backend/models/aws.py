import uuid
from . import db
from sqlalchemy import Column, String, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship

class AWSConfig(db.Model):
    __tablename__ = 'aws_config'
    config_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    scan_id = Column(String(36), ForeignKey('scan.scan_id'), nullable=False)
    resource_name = Column(String(100), nullable=True)
    resource_type = Column(String(50), nullable=False)

    s3 = relationship('S3Config', backref='header', uselist=False, cascade="all, delete-orphan")
    iam = relationship('IAMConfig', backref='header', uselist=False, cascade="all, delete-orphan")
    vpc = relationship('VPCConfig', backref='header', uselist=False, cascade="all, delete-orphan")
    ec2 = relationship('EC2Config', backref='header', uselist=False, cascade="all, delete-orphan")
    ebs = relationship('EBSConfig', backref='header', uselist=False, cascade="all, delete-orphan")

class S3Config(db.Model):
    __tablename__ = 's3_config' 
    config_id = Column(String(36), ForeignKey('aws_config.config_id'), primary_key=True)
    is_public = Column(Boolean, default=False)
    encryption_enabled = Column(Boolean, default=False)

class IAMConfig(db.Model):
    __tablename__ = 'iam_config' 
    config_id = Column(String(36), ForeignKey('aws_config.config_id'), primary_key=True)
    permissions = Column(Text, nullable=True)
    mfa_enabled = Column(Boolean, default=False)
    password_policy_strength = Column(String(50), nullable=True)

class VPCConfig(db.Model):
    __tablename__ = 'vpc_config' 
    config_id = Column(String(36), ForeignKey('aws_config.config_id'), primary_key=True)
    subnets_list = Column(Text, nullable=True)
    flow_logs_enabled = Column(Boolean, default=False)

class EC2Config(db.Model):
    __tablename__ = 'ec2_config' 
    config_id = Column(String(36), ForeignKey('aws_config.config_id'), primary_key=True)
    security_groups = Column(Text, nullable=True)
    open_ingress_rules = Column(Text, nullable=True)

class EBSConfig(db.Model):
    __tablename__ = 'ebs_config' 
    config_id = Column(String(36), ForeignKey('aws_config.config_id'), primary_key=True)
    encryption_enabled = Column(Boolean, default=False)