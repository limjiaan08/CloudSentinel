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
('RULE-SG-03', 'Publicly Exposed Database Port', 'EC2', 'CNAS-6', 'Critical database management ports are open to the public internet', 'HIGH');

USE cloudsentinel_db;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Clear Findings and Results
TRUNCATE TABLE result_item;
TRUNCATE TABLE results;

-- 2. Clear AWS Configuration Details
TRUNCATE TABLE s3_config;
TRUNCATE TABLE ebs_config;
TRUNCATE TABLE iam_config;
TRUNCATE TABLE vpc_config;
TRUNCATE TABLE ec2_config;

-- 3. Clear Headers and Scan History
TRUNCATE TABLE aws_config;
TRUNCATE TABLE scan;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

SELECT 
    ac.resource_name, 
    ac.resource_type, 
    ri.misconfig_name, 
    ri.severity
FROM aws_config ac
LEFT JOIN result_item ri ON ac.config_id = ri.config_id
WHERE ac.scan_id = (SELECT MAX(scan_id) FROM scan);