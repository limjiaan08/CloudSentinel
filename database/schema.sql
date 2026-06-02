-- database/schema.sql
CREATE DATABASE IF NOT EXISTS cloudsentinel_db;

DESCRIBE predefined_rule;

-- CNAS-1: Insecure cloud, container or orchestration
INSERT IGNORE INTO predefined_rule (rule_id, rule_name, aws_service, cnas_category, description, severity) VALUES
('RULE-S3-01', 'Publicly Open S3 Bucket', 'S3', 'CNAS-1', 'S3 buckets are accessible to the public', 'HIGH'),
('RULE-S3-02', 'Unencrypted S3 Bucket', 'S3', 'CNAS-1', 'S3 bucket data is not encrypted at rest', 'MEDIUM'),
('RULE-EBS-01', 'Unencrypted EBS Volumes', 'EBS', 'CNAS-1', 'EBS volumes are not encrypted', 'MEDIUM'),
('RULE-S3-03', 'S3 Bucket Versioning Disabled', 'S3', 'CNAS-1', 'Versioning is disabled, risking permanent data loss or overwrite', 'LOW'),
('RULE-EC2-02', 'IMDSv1 Enabled', 'EC2', 'CNAS-1', 'Instance Metadata Service v1 is active and vulnerable to SSRF credential theft', 'HIGH')

-- CNAS-3: Improper authentication and authorization
INSERT IGNORE INTO predefined_rule (rule_id, rule_name, aws_service, cnas_category, description, severity) VALUES
('RULE-IAM-01', 'Over-Permissive IAM Roles and Policies', 'IAM', 'CNAS-3', 'IAM permissions are broader than necessary', 'HIGH'),
('RULE-IAM-02', 'Lack of MFA for Root Account', 'IAM', 'CNAS-3', 'Root account does not have MFA enabled', 'HIGH'),
('RULE-IAM-03', 'Unavailable or Weakly Enforced Password Policy', 'IAM', 'CNAS-3', 'Password policy does not meet security requirements', 'LOW'),
('RULE-IAM-04', 'Stale Access Keys Detected', 'IAM', 'CNAS-3', 'IAM Access keys older than 90 days have not been rotated', 'MEDIUM');

-- CNAS-6: Over-permissive or insecure network policies
INSERT IGNORE INTO predefined_rule (rule_id, rule_name, aws_service, cnas_category, description, severity) VALUES
('RULE-VPC-01', 'No Network Segmentation Defined', 'VPC', 'CNAS-6', 'Network resources are not properly isolated', 'MEDIUM'),
('RULE-SG-01', 'Wide-Open Ingress Allowed by Security Group', 'VPC, EC2', 'CNAS-6', 'Inbound traffic is allowed from all sources', 'HIGH'),
('RULE-VPC-02', 'Unenabled Flow Logs for VPC', 'VPC', 'CNAS-6', 'Network traffic logging is disabled', 'LOW'),
('RULE-SG-03', 'Publicly Exposed Database Port', 'EC2', 'CNAS-6', 'Critical database management ports are open to the public internet', 'HIGH'),
('RULE-SG-04', 'Unrestricted Outbound Traffic Allowed by Security Group', 'VPC', 'CNAS-6', 'Security Group allows all traffic to leave the instance to any destination', 'MEDIUM');

USE cloudsentinel_db;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Clear Findings and Results (DISABLED FOR PRODUCTION - PREVENTS ACCIDENTAL DATA LOSS)
-- TRUNCATE TABLE result_item;
-- TRUNCATE TABLE results;

-- 2. Clear AWS Configuration Details (DISABLED FOR PRODUCTION - PREVENTS ACCIDENTAL DATA LOSS)
-- TRUNCATE TABLE s3_config;
-- TRUNCATE TABLE ebs_config;
-- TRUNCATE TABLE iam_config;
-- TRUNCATE TABLE vpc_config;
-- TRUNCATE TABLE ec2_config;

-- 3. Clear Headers and Scan History (DISABLED FOR PRODUCTION - PREVENTS ACCIDENTAL DATA LOSS)
-- TRUNCATE TABLE aws_config;
-- TRUNCATE TABLE scan;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Support for RULE-S3-03 (CNAS-1: S3 Versioning)
ALTER TABLE s3_config 
ADD COLUMN versioning_enabled BOOLEAN DEFAULT 0;

-- 2. Support for RULE-IAM-04 (CNAS-3: Key Rotation)
ALTER TABLE iam_config 
ADD COLUMN key_age_days INTEGER DEFAULT 0;

-- 3. Support for RULE-EC2-02 (CNAS-1: IMDSv2 Enforcement)
ALTER TABLE ec2_config 
ADD COLUMN imds_version VARCHAR(10) DEFAULT 'v1';

-- 4. Support for RULE-SG-04 (CNAS-6: Unrestricted Outbound)
ALTER TABLE ec2_config 
ADD COLUMN open_egress_rules TEXT NULL;

-- 5. Verify the updates (Optional)
-- This ensures the columns exist before you run your next scan.
SELECT * FROM s3_config LIMIT 1;
SELECT * FROM iam_config LIMIT 1;
SELECT * FROM ec2_config LIMIT 1;

DESCRIBE iam_config

ALTER TABLE session
ADD COLUMN token VARCHAR(500) NULL UNIQUE,
ADD COLUMN token_expiry DATETIME NULL,
ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;