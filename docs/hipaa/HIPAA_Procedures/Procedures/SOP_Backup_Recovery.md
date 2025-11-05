# Standard Operating Procedure: Backup and Disaster Recovery
## MyPhoneFriend - HIPAA Compliance

**SOP ID**: HIPAA-SOP-003  
**Version**: 1.0  
**Effective Date**: October 15, 2025  
**Department**: IT / DevOps  
**Owner**: Technical Lead

---

## 1. PURPOSE

To establish procedures for backing up ePHI and recovering from disasters in compliance with HIPAA §164.308(a)(7) - Contingency Plan.

---

## 2. SCOPE

This procedure covers:
- Daily automated database backups
- Backup encryption and storage
- Backup verification and testing
- Disaster recovery procedures
- Recovery time and recovery point objectives

---

## 3. BACKUP REQUIREMENTS

### 3.1 HIPAA Requirements
- **Frequency**: Daily minimum
- **Encryption**: Required (AES-256)
- **Storage**: Secure, off-site location
- **Retention**: 7 years
- **Testing**: Quarterly restore tests
- **Documentation**: Backup logs and verification

### 3.2 Recovery Objectives
- **RPO (Recovery Point Objective)**: 24 hours (max data loss)
- **RTO (Recovery Time Objective)**: 4 hours (max downtime)
- **Data Integrity**: 100% (verified checksums)

---

## 4. DAILY BACKUP PROCEDURE

### 4.1 Automated Backup (2:00 AM Daily)

**What Gets Backed Up**:
- Complete MongoDB database
- Application configuration files
- SSL certificates and keys
- Environment variables (from Secrets Manager)

**Backup Script**: `scripts/automated-backup.js`

**Process**:
```bash
#!/usr/bin/env node
# Runs automatically via cron: 0 2 * * *

# 1. Create MongoDB dump
mongodump --uri="${MONGODB_URL}" \
  --archive=/tmp/backup-$(date +%Y%m%d).gz \
  --gzip

# 2. Encrypt backup with AWS KMS
aws kms encrypt \
  --key-id "${BACKUP_KMS_KEY_ID}" \
  --plaintext fileb:///tmp/backup-$(date +%Y%m%d).gz \
  --output text \
  --query CiphertextBlob \
  > /tmp/backup-$(date +%Y%m%d).gz.enc

# 3. Upload to S3
aws s3 cp /tmp/backup-$(date +%Y%m%d).gz.enc \
  s3://bianca-hipaa-backups/daily/backup-$(date +%Y%m%d).gz.enc \
  --server-side-encryption aws:kms \
  --ssekms-key-id "${BACKUP_KMS_KEY_ID}" \
  --storage-class STANDARD_IA

# 4. Verify upload
aws s3 ls s3://bianca-hipaa-backups/daily/backup-$(date +%Y%m%d).gz.enc

# 5. Create audit log
# (Automated in script)

# 6. Cleanup
rm /tmp/backup-$(date +%Y%m%d).gz*

# 7. Send success notification
aws sns publish \
  --topic-arn "${BACKUP_NOTIFICATION_TOPIC}" \
  --message "Daily backup completed: $(date +%Y%m%d)"
```

---

### 4.2 Backup Verification

**Automated Checks** (every backup):
- [ ] Backup file created successfully
- [ ] File size reasonable (compare to previous)
- [ ] Encryption successful
- [ ] S3 upload successful
- [ ] Checksum verification
- [ ] Audit log entry created

**Alerts on Failure**:
- Email to DevOps team
- SNS notification
- PagerDuty alert (if configured)
- Retry automatically (max 3 attempts)

---

## 5. BACKUP STORAGE

### 5.1 S3 Bucket Configuration

**Bucket**: `bianca-hipaa-backups`  
**Region**: us-east-2  
**Encryption**: AES-256 with AWS KMS

**Structure**:
```
s3://bianca-hipaa-backups/
├── daily/
│   ├── backup-20251015.gz.enc
│   ├── backup-20251014.gz.enc
│   └── ...
├── weekly/          # Sunday backups (retained longer)
├── monthly/         # First of month (retained longer)
└── annual/          # January 1st (7-year retention)
```

**Lifecycle Policy**:
- Daily backups: 90 days
- Weekly backups: 1 year
- Monthly backups: 3 years
- Annual backups: 7 years

---

### 5.2 Access Control

**S3 Bucket Policy**:
- No public access
- Access restricted to:
  - Backup service role
  - Security Officer
  - Designated DevOps personnel
- MFA required for human access
- All access logged in CloudTrail

**KMS Key Policy**:
- Encrypt: Backup service only
- Decrypt: Backup service + Security Officer + DevOps (with approval)
- Key rotation: Annual
- Key usage logged

---

## 6. WEEKLY BACKUP VERIFICATION

### 6.1 Every Sunday (Additional Backup)

**Purpose**: Long-term retention point

**Process**:
```bash
# Same as daily backup but with different naming
# Stored in weekly/ folder
# Retained for 1 year instead of 90 days
```

---

### 6.2 Weekly Verification Test

**Every Sunday After Backup**:

**Step 1: Download Random Backup**
```bash
# Select random backup from last week
BACKUP_FILE=$(aws s3 ls s3://bianca-hipaa-backups/daily/ | shuf -n 1 | awk '{print $4}')

# Download
aws s3 cp s3://bianca-hipaa-backups/daily/${BACKUP_FILE} /tmp/verify-backup.gz.enc
```

**Step 2: Verify Decryption**
```bash
# Decrypt with KMS
aws kms decrypt \
  --ciphertext-blob fileb:///tmp/verify-backup.gz.enc \
  --output text \
  --query Plaintext \
  | base64 --decode > /tmp/verify-backup.gz

# Verify it's a valid gzip
gunzip -t /tmp/verify-backup.gz

# If no errors, encryption/decryption working
```

**Step 3: Document Result**
- Log verification success/failure
- Create audit log entry
- Alert if verification fails

---

## 7. MONTHLY BACKUP TEST

### 7.1 First Sunday of Month

**Additional Retention**:
- Monthly backups kept for 3 years
- Stored in monthly/ folder

---

### 7.2 Monthly Restore Test

**Purpose**: Verify backups are restorable

**Frequency**: Monthly (first Sunday)  
**Environment**: Staging database (never overwrite production)

**Steps**:

**Step 1: Download Backup**
```bash
# Get previous month's backup
LAST_MONTH=$(date -d "last month" +%Y%m01)
aws s3 cp s3://bianca-hipaa-backups/monthly/backup-${LAST_MONTH}.gz.enc /tmp/restore-test.gz.enc
```

**Step 2: Decrypt**
```bash
aws kms decrypt \
  --ciphertext-blob fileb:///tmp/restore-test.gz.enc \
  --output text \
  --query Plaintext \
  | base64 --decode > /tmp/restore-test.gz
```

**Step 3: Restore to Staging**
```bash
# IMPORTANT: Use staging database URL, never production
mongorestore \
  --uri="${STAGING_MONGODB_URL}" \
  --archive=/tmp/restore-test.gz \
  --gzip \
  --drop

# This overwrites staging database with backup data
```

**Step 4: Verification**
```bash
# Connect to staging database
mongo "${STAGING_MONGODB_URL}"

# Verify data:
db.patients.countDocuments()        # Should match expected
db.caregivers.countDocuments()      # Should match expected
db.conversations.countDocuments()   # Should match expected
db.audit_logs.countDocuments()      # Should match expected

# Spot check: Query random patient
db.patients.findOne()

# Verify dates match backup period
```

**Step 5: Documentation**
- Record test date
- Backup size
- Restore time (should be < 4 hours)
- Any issues encountered
- Test passed/failed

**Output**: Monthly Restore Test Report

---

## 8. QUARTERLY DISASTER RECOVERY DRILL

### 8.1 Full DR Test (Every 3 Months)

**Purpose**: Test complete system recovery

**Participants**:
- Security Officer
- DevOps team
- Technical Lead
- CTO

**Scenario**: Complete production database loss

**Steps**:

**Hour 0: Disaster Declared**
```
Scenario: Production database corrupted/lost
Goal: Restore from backup within 4 hours (RTO)
```

**Hour 0-1: Assessment**
1. Verify nature of data loss
2. Identify last known good backup
3. Calculate data loss window
4. Notify stakeholders
5. Activate DR team

**Hour 1-2: Backup Retrieval**
```bash
# 1. Identify most recent backup
LATEST_BACKUP=$(aws s3 ls s3://bianca-hipaa-backups/daily/ | tail -1 | awk '{print $4}')

# 2. Download backup
aws s3 cp s3://bianca-hipaa-backups/daily/${LATEST_BACKUP} /tmp/restore-prod.gz.enc

# 3. Verify file integrity
md5sum /tmp/restore-prod.gz.enc
# Compare with stored checksum

# 4. Decrypt
aws kms decrypt \
  --ciphertext-blob fileb:///tmp/restore-prod.gz.enc \
  --output text \
  --query Plaintext \
  | base64 --decode > /tmp/restore-prod.gz
```

**Hour 2-3: Database Restoration**
```bash
# For DR drill: Use separate test database
# For real disaster: Use production URL

mongorestore \
  --uri="${DR_TEST_MONGODB_URL}" \
  --archive=/tmp/restore-prod.gz \
  --gzip \
  --numParallelCollections=4 \  # Faster restore
  --drop
```

**Hour 3-4: Verification & Testing**
1. Verify all collections restored
2. Check record counts
3. Spot check data integrity
4. Test application connectivity
5. Run smoke tests
6. Verify audit log integrity

**Hour 4: Go/No-Go Decision**
- If verification passes: Declare recovery successful
- If issues: Troubleshoot or try previous backup
- Document actual recovery time

**Post-DR Activities**:
1. Debrief meeting
2. Update DR procedures based on lessons learned
3. Document test results
4. Report to management
5. Update RTO/RPO if needed

---

## 9. DISASTER SCENARIOS

### 9.1 Scenario: Database Corruption

**Detection**:
- Application errors connecting to database
- Data inconsistencies reported
- MongoDB service degraded

**Response**:
1. Immediately stop write operations
2. Assess extent of corruption
3. If extensive: Restore from backup
4. If limited: Repair and document

**Recovery**: Follow Section 8 procedures

---

### 9.2 Scenario: Ransomware Attack

**Detection**:
- Files/database encrypted by malware
- Ransom note displayed
- Cannot access systems

**Response**:
1. **DO NOT PAY RANSOM** (FBI recommendation)
2. Isolate affected systems immediately
3. Contact law enforcement (FBI)
4. Activate backup recovery
5. Forensic investigation
6. Malware removal before restoration

**Recovery**:
1. Build clean systems (new servers)
2. Restore from last clean backup
3. Verify no malware in backup
4. Restore to new environment
5. Enhanced security before going live

---

### 9.3 Scenario: AWS Region Failure

**Detection**:
- AWS services unavailable
- Cannot connect to resources
- AWS status page shows issues

**Response**:
1. Check AWS Service Health Dashboard
2. If prolonged outage: Activate DR site (if configured)
3. If short outage: Wait for AWS recovery
4. Restore from backups to different region (if needed)

**Prevention**:
- Multi-region deployment (future enhancement)
- Cross-region backup replication
- Failover procedures documented

---

## 10. BACKUP RETENTION

### 10.1 Retention Schedule

| Backup Type | Retention | Location |
|-------------|-----------|----------|
| Daily | 90 days | s3://bianca-hipaa-backups/daily/ |
| Weekly | 1 year | s3://bianca-hipaa-backups/weekly/ |
| Monthly | 3 years | s3://bianca-hipaa-backups/monthly/ |
| Annual | 7 years | s3://bianca-hipaa-backups/annual/ |

**HIPAA Requirement**: Minimum 7 years for records

---

### 10.2 S3 Lifecycle Policy

**Automated transitions**:
```json
{
  "Rules": [
    {
      "Id": "DailyBackups",
      "Status": "Enabled",
      "Filter": { "Prefix": "daily/" },
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 60,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 90
      }
    },
    {
      "Id": "AnnualBackups",
      "Status": "Enabled",
      "Filter": { "Prefix": "annual/" },
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "GLACIER_DEEP_ARCHIVE"
        }
      ],
      "Expiration": {
        "Days": 2555
      }
    }
  ]
}
```

---

## 11. BACKUP MONITORING

### 11.1 Daily Monitoring

**Automated**:
- CloudWatch alarm if backup fails
- SNS notification to DevOps
- Slack alert (if configured)
- PagerDuty escalation (if no response in 1 hour)

**Manual** (DevOps checks daily):
```bash
# Check last backup
aws s3 ls s3://bianca-hipaa-backups/daily/ | tail -5

# Verify today's backup exists
TODAY=$(date +%Y%m%d)
aws s3 ls s3://bianca-hipaa-backups/daily/backup-${TODAY}.gz.enc

# Check backup size (should be consistent)
aws s3 ls s3://bianca-hipaa-backups/daily/ --human-readable | tail -10
```

---

### 11.2 Backup Health Dashboard

**Metrics to Track**:
- Last successful backup date/time
- Backup file size (trend)
- Backup duration (should be < 1 hour)
- Encryption time
- Upload time
- Success rate (target: 100%)
- Average backup size

**Query in MongoDB**:
```javascript
// Check audit logs for backup success
db.audit_logs.find({
  action: "BACKUP",
  outcome: "SUCCESS",
  timestamp: { $gte: new Date(Date.now() - 7*24*60*60*1000) }
}).sort({ timestamp: -1 })
```

---

## 12. RESTORE PROCEDURES

### 12.1 Restore from Latest Backup

**When to Use**:
- Data corruption
- Accidental deletion
- Malware infection
- Need to revert to earlier state

**WARNING**: This overwrites current database!

**Step 1: Prepare**
```bash
# 1. Notify all users (if planned restore)
# 2. Stop application (prevent new writes)
# 3. Document current state
# 4. Create snapshot of current database (if possible)
```

**Step 2: Download Backup**
```bash
# Get most recent backup
LATEST=$(aws s3 ls s3://bianca-hipaa-backups/daily/ | tail -1 | awk '{print $4}')

# Download
aws s3 cp s3://bianca-hipaa-backups/daily/${LATEST} /tmp/restore.gz.enc

# Verify file integrity
aws s3api head-object --bucket bianca-hipaa-backups --key daily/${LATEST}
```

**Step 3: Decrypt**
```bash
# Decrypt with KMS
aws kms decrypt \
  --ciphertext-blob fileb:///tmp/restore.gz.enc \
  --output text \
  --query Plaintext \
  | base64 --decode > /tmp/restore.gz

# Verify gzip integrity
gunzip -t /tmp/restore.gz
```

**Step 4: Restore Database**
```bash
# CRITICAL: Verify you're using correct database URL!
echo "Restoring to: ${MONGODB_URL}"
echo "Press Ctrl+C to abort, Enter to continue..."
read

# Restore (--drop removes existing data first)
mongorestore \
  --uri="${MONGODB_URL}" \
  --archive=/tmp/restore.gz \
  --gzip \
  --drop \
  --numParallelCollections=4

# Expected output:
# - preparing collections to restore from
# - reading metadata for database.collection from archive
# - restoring database.collection from archive
# - finished restoring (X documents, Y MB)
```

**Step 5: Verification**
```bash
# Connect to database
mongo "${MONGODB_URL}"

# Verify collections
show collections

# Count documents
db.patients.countDocuments()
db.caregivers.countDocuments()
db.conversations.countDocuments()
db.audit_logs.countDocuments()

# Spot check data
db.patients.findOne()
db.caregivers.findOne()

# Check audit log integrity
# Run: AuditLog.verifyChainIntegrity()
```

**Step 6: Application Testing**
```bash
# Start application
npm run start

# Run smoke tests
curl https://api.myphonefriend.com/health
# Should return 200 OK

# Test critical endpoints
# - Login
# - Patient list
# - Conversation retrieval

# Monitor logs for errors
tail -f logs/app.log
```

**Step 7: Documentation**
- Restore date/time
- Backup file used
- Data loss window (how much data lost?)
- Verification results
- Issues encountered
- Total restore time
- Create audit log entry

---

### 12.2 Point-in-Time Restore (If MongoDB Atlas)

**MongoDB Atlas Feature**: Restore to any point in last 7 days

**Steps**:
1. Go to Atlas Console
2. Select Cluster → Backup
3. Choose "Restore from Continuous Backup"
4. Select date and time
5. Choose restore method:
   - Download archive (for analysis)
   - Restore to new cluster (safe)
   - Restore to existing cluster (overwrites)
6. Verify restoration
7. Document recovery

**Advantage**: More precise recovery, less data loss

---

## 13. DISASTER RECOVERY SCENARIOS

### 13.1 Complete Database Loss

**Scenario**: Production database completely gone

**RTO**: 4 hours  
**RPO**: 24 hours (last backup)

**Recovery Plan**:

**Hour 0-1: Assessment & Preparation**
1. Confirm database is unrecoverable
2. Notify stakeholders (customers will experience downtime)
3. Activate DR team
4. Prepare clean database instance
5. Identify most recent backup

**Hour 1-2: Database Rebuild**
1. Create new MongoDB instance (or use Atlas)
2. Configure security settings
3. Verify connectivity
4. Update connection strings (if new instance)

**Hour 2-3: Data Restoration**
1. Download latest backup
2. Decrypt
3. Restore to new database
4. Verify data integrity

**Hour 3-4: Application Recovery**
1. Update application configuration
2. Restart application services
3. Run smoke tests
4. Verify functionality
5. Enable monitoring

**Hour 4: Go Live**
1. Remove maintenance page
2. Monitor closely
3. Notify customers of restoration
4. Enhanced monitoring for 24 hours

---

### 13.2 Application Server Failure

**Scenario**: EC2 instance(s) failed

**RTO**: 2 hours  
**RPO**: 0 (database intact)

**Recovery Plan**:
1. Launch new EC2 instances
2. Deploy application code
3. Configure environment
4. Connect to database
5. Verify functionality
6. Update load balancer
7. Monitor

---

### 13.3 Complete AWS Region Failure

**Scenario**: Entire us-east-2 region down

**RTO**: 8 hours (if cross-region backups exist)  
**RPO**: 24 hours

**Recovery Plan** (requires cross-region backup):
1. Activate DR region (e.g., us-west-2)
2. Retrieve backups from cross-region replication
3. Restore database in new region
4. Deploy application in new region
5. Update DNS to point to new region
6. Extensive testing before go-live

**Note**: This requires pre-configured cross-region DR (not currently implemented)

---

## 14. BACKUP TROUBLESHOOTING

### Issue: Backup Failed

**Diagnosis**:
```bash
# Check CloudWatch logs
aws logs tail /aws/backup/bianca-prod --since 1h

# Check disk space
df -h /tmp

# Check MongoDB connectivity
mongo "${MONGODB_URL}" --eval "db.stats()"

# Check S3 bucket access
aws s3 ls s3://bianca-hipaa-backups/
```

**Common Causes**:
1. Disk space full (clear /tmp)
2. MongoDB connection timeout (check credentials)
3. S3 upload timeout (check network)
4. KMS key permissions (verify IAM role)
5. Cron job not running (check crontab)

**Solution**: Fix root cause and retry manually

---

### Issue: Backup Size Suddenly Changed

**Normal**: Gradual increase over time  
**Concerning**: Sudden 50%+ increase or decrease

**Investigation**:
```bash
# Compare sizes
aws s3 ls s3://bianca-hipaa-backups/daily/ --human-readable | tail -10

# Check database size
mongo "${MONGODB_URL}" --eval "db.stats(1024*1024)"  # Size in MB

# Check collection sizes
mongo "${MONGODB_URL}" --eval "db.stats()"
```

**Possible Causes**:
- Large data import/export
- Data corruption
- Collection dropped
- Index changes

**Action**: Investigate cause before next backup

---

### Issue: Cannot Decrypt Backup

**Symptoms**: KMS decrypt fails

**Diagnosis**:
```bash
# Verify KMS key exists
aws kms describe-key --key-id "${BACKUP_KMS_KEY_ID}"

# Check key permissions
aws kms list-grants --key-id "${BACKUP_KMS_KEY_ID}"

# Verify IAM permissions
aws iam get-role-policy --role-name backup-service-role --policy-name KMSAccess
```

**Solutions**:
1. Verify correct KMS key ID in environment
2. Check IAM role has decrypt permission
3. Verify key is enabled (not disabled/deleted)
4. Use different backup if key lost (THIS IS WHY WE TEST!)

---

## 15. EMERGENCY PROCEDURES

### 15.1 Emergency Restore (Off-Hours)

**On-Call Contact**: [DevOps on-call rotation]

**Quick Restore** (if trained personnel available):
```bash
# 1. Download latest backup
aws s3 cp s3://bianca-hipaa-backups/daily/$(aws s3 ls s3://bianca-hipaa-backups/daily/ | tail -1 | awk '{print $4}') /tmp/emergency-restore.gz.enc

# 2. Decrypt
aws kms decrypt --ciphertext-blob fileb:///tmp/emergency-restore.gz.enc --output text --query Plaintext | base64 --decode > /tmp/emergency-restore.gz

# 3. Restore
mongorestore --uri="${MONGODB_URL}" --archive=/tmp/emergency-restore.gz --gzip --drop

# 4. Verify and restart application
```

**After Emergency**:
- Document what happened
- Why was emergency restore needed?
- What was the outcome?
- Lessons learned
- Report to Security Officer next business day

---

### 15.2 Break-Glass Backup Access

**Credentials Location**: AWS Secrets Manager  
**Secret Name**: `emergency-backup-credentials`

**Contains**:
- AWS access key with S3/KMS permissions
- MongoDB restore credentials
- Emergency contact list

**Access**: Only Security Officer and designated backup DevOps

---

## 16. BACKUP AUDIT TRAIL

### 16.1 All Backup Operations Logged

**Automatic Audit Log**:
```javascript
// Created automatically by backup script
{
  action: "BACKUP",
  resource: "database",
  resourceId: "backup-20251015",
  outcome: "SUCCESS",
  userId: "system",
  userRole: "system",
  ipAddress: "internal",
  metadata: {
    backupSize: "1.2GB",
    duration: "45s",
    collections: "12",
    s3Location: "s3://bianca-hipaa-backups/daily/backup-20251015.gz.enc"
  }
}
```

---

### 16.2 Restore Operations Logged

**Manual Audit Log** (created by operator):
```javascript
await AuditLog.createLog({
  action: "RESTORE",
  resource: "database",
  resourceId: "restore-from-20251014",
  outcome: "SUCCESS",
  userId: operatorId,
  userRole: "superAdmin",
  ipAddress: operatorIp,
  complianceFlags: {
    highRiskAction: true,
    requiresReview: true
  },
  metadata: {
    backupDate: "2025-10-14",
    restoreDate: "2025-10-15",
    reason: "Disaster recovery drill",
    dataLoss: "0 hours"
  }
});
```

---

## 17. MONITORING AND ALERTS

### 17.1 CloudWatch Alarms

**Create Alarms For**:
```bash
# Backup failure
aws cloudwatch put-metric-alarm \
  --alarm-name "Backup-Failed" \
  --alarm-description "Daily backup failed" \
  --metric-name BackupSuccess \
  --namespace "Bianca/Backups" \
  --statistic Sum \
  --period 86400 \
  --threshold 0 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions "${SNS_TOPIC_ARN}"

# Backup size anomaly
aws cloudwatch put-metric-alarm \
  --alarm-name "Backup-Size-Anomaly" \
  --alarm-description "Backup size changed significantly" \
  --metric-name BackupSize \
  --namespace "Bianca/Backups" \
  --statistic Average \
  --period 604800 \
  --threshold 2000000000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

---

### 17.2 SNS Notifications

**Configure Topic**:
```bash
# Create SNS topic for backup alerts
aws sns create-topic --name bianca-backup-alerts

# Subscribe DevOps team
aws sns subscribe \
  --topic-arn "arn:aws:sns:us-east-2:ACCOUNT:bianca-backup-alerts" \
  --protocol email \
  --notification-endpoint devops@myphonefriend.com
```

---

## 18. COMPLIANCE VERIFICATION

### 18.1 Monthly Checklist

- [ ] All daily backups successful this month
- [ ] Weekly backup completed
- [ ] Monthly backup completed (if first of month)
- [ ] Restore test passed (monthly test)
- [ ] All backups encrypted
- [ ] S3 bucket access logs reviewed
- [ ] KMS key usage logs reviewed
- [ ] Backup audit logs verified
- [ ] Issues documented and resolved

---

### 18.2 Quarterly Checklist

- [ ] DR drill completed
- [ ] RTO/RPO met
- [ ] All backups tested
- [ ] Cross-region replication verified (if configured)
- [ ] Backup retention policy enforced
- [ ] Old backups purged per schedule
- [ ] Backup documentation updated
- [ ] DR procedures updated based on drill

---

## 19. BACKUP SECURITY

### 19.1 Encryption

**At Rest**:
- KMS encryption before upload
- S3 server-side encryption
- Encrypted storage class

**Keys**:
- AWS KMS managed
- Automatic rotation annually
- Key policy restricts access
- Key usage logged

---

### 19.2 Access Control

**Who Can Access Backups**:
- Backup service (automated)
- Security Officer (emergency)
- Designated DevOps personnel (with approval)

**Access Requires**:
- MFA authentication
- Approved IAM role
- Business justification
- Logged access

**Never**:
- No public access
- No unauthenticated access
- No cross-account access (unless explicitly configured)

---

## 20. MANUAL BACKUP (If Needed)

### 20.1 On-Demand Backup

**When to Use**:
- Before major system changes
- Before data migration
- Before risky operations
- Legal hold requirements

**Command**:
```bash
# Run backup script manually
node scripts/automated-backup.js

# Or manual MongoDB dump
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mongodump --uri="${MONGODB_URL}" \
  --archive=/tmp/manual-backup-${TIMESTAMP}.gz \
  --gzip

# Encrypt and upload (follow automated process)
```

**Documentation**:
- Reason for manual backup
- Who requested
- Date/time
- Backup location
- Retention period (if different from standard)

---

## 21. TESTING SCHEDULE

### 21.1 Backup Testing Calendar

| Test Type | Frequency | Last Completed | Next Scheduled |
|-----------|-----------|----------------|----------------|
| Backup verification | Daily | [Auto] | [Auto] |
| Decrypt test | Weekly | [Date] | [Date] |
| Restore test | Monthly | [Date] | [Date] |
| DR drill | Quarterly | [Date] | [Date] |
| Full DR scenario | Annual | [Date] | [Date] |

---

### 21.2 Test Documentation

**Each Test Must Document**:
- Date and time of test
- Personnel involved
- Backup file tested
- Restore duration
- Data integrity verification results
- Issues encountered
- Resolutions applied
- Test passed/failed
- Lessons learned

**Template**: `../Templates/Backup_Test_Report.md`

---

## 22. CONTACTS

### Internal:
- **DevOps Lead**: devops@myphonefriend.com | [Phone]
- **Security Officer**: security@myphonefriend.com | [Phone]
- **CTO**: [Email] | [Phone]

### External:
- **MongoDB Support**: support@mongodb.com | Support Portal
- **AWS Support**: AWS Support Console | [Phone]
- **Disaster Recovery Consultant**: [If contracted]

---

## 23. RELATED DOCUMENTS

- **Policy**: `../Policies/Backup_Recovery_Policy.md`
- **Script**: `bianca-app-backend/scripts/automated-backup.js`
- **Script**: `bianca-app-backend/scripts/restore-backup.js`
- **Form**: `../Forms/DR_Test_Report.md`
- **Template**: `../Templates/Backup_Test_Report.md`

---

## 24. REVISION HISTORY

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Oct 15, 2025 | Initial SOP | Technical Lead |

---

## 25. APPROVAL

**Reviewed By**: HIPAA Security Officer  
**Approved By**: CTO  
**Date**: October 15, 2025  
**Next Review**: October 15, 2026

---

**CRITICAL**: Test your backups regularly. An untested backup is not a backup.

**For Questions**: Contact DevOps Lead at devops@myphonefriend.com












