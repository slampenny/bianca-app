/**
 * HIPAA-Compliant MongoDB Backup Lambda Function
 * 
 * Runs daily/weekly/monthly to backup MongoDB database
 * Encrypts with KMS and uploads to S3
 * 
 * HIPAA Requirements Met:
 * - Automated backups (§164.308(a)(7)(ii)(A))
 * - Encryption at rest
 * - Audit logging
 * - 7-year retention
 */

const { MongoClient } = require('mongodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { KMSClient, EncryptCommand } = require('@aws-sdk/client-kms');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

// AWS Clients
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-2' });
const kmsClient = new KMSClient({ region: process.env.AWS_REGION || 'us-east-2' });
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-2' });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-2' });

exports.handler = async (event) => {
  const backupType = event.backupType || 'daily'; // daily, weekly, monthly, annual
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `backup-${timestamp}`;
  
  console.log(`Starting ${backupType} backup: ${backupId}`);
  
  try {
    // Step 1: Get MongoDB URL from Secrets Manager
    console.log('Retrieving MongoDB credentials from Secrets Manager...');
    const mongoUrl = await getMongoDBUrl();
    
    // Step 2: Create MongoDB dump
    console.log('Creating MongoDB dump...');
    const dumpFile = await createMongoDBDump(mongoUrl, backupId);
    
    // Step 3: Get file stats
    const stats = fs.statSync(dumpFile);
    const fileSizeBytes = stats.size;
    const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(2);
    console.log(`Dump created: ${fileSizeMB} MB`);
    
    // Step 4: Upload to S3 (with automatic KMS encryption via bucket policy)
    console.log('Uploading to S3 with encryption...');
    const s3Key = await uploadToS3(dumpFile, backupType, timestamp, fileSizeBytes);
    
    // Step 5: Verify upload
    console.log('Verifying S3 upload...');
    await verifyS3Upload(s3Key);
    
    // Step 6: Cleanup local files
    console.log('Cleaning up temporary files...');
    fs.unlinkSync(dumpFile);
    
    // Step 7: Send success notification
    console.log('Sending success notification...');
    await sendNotification({
      subject: `✅ ${backupType.toUpperCase()} Backup Successful - ${process.env.ENVIRONMENT}`,
      message: `
Backup completed successfully!

Backup ID: ${backupId}
Type: ${backupType}
Size: ${fileSizeMB} MB
S3 Location: s3://${process.env.S3_BUCKET}/${s3Key}
Timestamp: ${new Date().toISOString()}
Environment: ${process.env.ENVIRONMENT}

Backup encrypted with KMS and stored securely.
Retention: ${getRetentionDays(backupType)} days
      `.trim()
    });
    
    // Step 8: Create audit log entry (via MongoDB connection)
    console.log('Creating audit log entry...');
    await createAuditLog(mongoUrl, {
      action: 'BACKUP',
      backupType,
      backupId,
      s3Key,
      sizeBytes: fileSizeBytes,
      outcome: 'SUCCESS'
    });
    
    console.log(`✅ Backup completed successfully: ${backupId}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        backupId,
        backupType,
        sizeMB: fileSizeMB,
        s3Key,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    
    // Send failure notification
    await sendNotification({
      subject: `❌ ${backupType.toUpperCase()} Backup FAILED - ${process.env.ENVIRONMENT}`,
      message: `
BACKUP FAILURE ALERT!

Backup ID: ${backupId}
Type: ${backupType}
Error: ${error.message}
Timestamp: ${new Date().toISOString()}
Environment: ${process.env.ENVIRONMENT}

IMMEDIATE ACTION REQUIRED: Investigate backup failure.
      `.trim()
    });
    
    // Try to create audit log for failure
    try {
      const mongoUrl = await getMongoDBUrl();
      await createAuditLog(mongoUrl, {
        action: 'BACKUP',
        backupType,
        backupId,
        outcome: 'FAILURE',
        errorMessage: error.message
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }
    
    throw error;
  }
};

/**
 * Get MongoDB URL from AWS Secrets Manager
 */
async function getMongoDBUrl() {
  const secretName = process.env.MONGODB_URL_SECRET_NAME;
  
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await secretsClient.send(command);
  
  if (response.SecretString) {
    const secrets = JSON.parse(response.SecretString);
    return secrets.MONGODB_URL || secrets.mongodb_url;
  }
  
  throw new Error('MongoDB URL not found in secrets');
}

/**
 * Create MongoDB dump using mongodump
 */
async function createMongoDBDump(mongoUrl, backupId) {
  const dumpFile = `/tmp/${backupId}.gz`;
  
  // Use mongodump (requires mongodump to be included in Lambda layer)
  // Alternative: Use MongoDB Atlas API for cloud backups
  const command = `mongodump --uri="${mongoUrl}" --archive=${dumpFile} --gzip`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr && !stderr.includes('done dumping')) {
      console.warn('mongodump stderr:', stderr);
    }
    console.log('mongodump completed');
    return dumpFile;
  } catch (error) {
    console.error('mongodump failed:', error);
    throw new Error(`MongoDB dump failed: ${error.message}`);
  }
}

/**
 * Upload backup to S3 with encryption
 */
async function uploadToS3(filePath, backupType, timestamp, fileSize) {
  const fileName = path.basename(filePath);
  const s3Key = `${backupType}/${fileName}`;
  
  const fileContent = fs.readFileSync(filePath);
  
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: s3Key,
    Body: fileContent,
    ServerSideEncryption: 'aws:kms',
    SSEKMSKeyId: process.env.KMS_KEY_ID,
    StorageClass: 'STANDARD_IA', // Infrequent Access (cost-effective)
    Metadata: {
      'backup-type': backupType,
      'backup-date': timestamp,
      'backup-size-bytes': fileSize.toString(),
      'retention-years': getRetentionYears(backupType).toString(),
      'environment': process.env.ENVIRONMENT,
      'hipaa-compliant': 'true'
    },
    Tagging: `BackupType=${backupType}&Environment=${process.env.ENVIRONMENT}&Compliance=HIPAA`
  });
  
  await s3Client.send(command);
  console.log(`Uploaded to S3: s3://${process.env.S3_BUCKET}/${s3Key}`);
  
  return s3Key;
}

/**
 * Verify S3 upload succeeded
 */
async function verifyS3Upload(s3Key) {
  const { HeadObjectCommand } = require('@aws-sdk/client-s3');
  
  const command = new HeadObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: s3Key
  });
  
  const response = await s3Client.send(command);
  
  if (!response.ServerSideEncryption || response.ServerSideEncryption !== 'aws:kms') {
    throw new Error('S3 object not encrypted with KMS!');
  }
  
  console.log('✓ S3 upload verified - encrypted with KMS');
  return true;
}

/**
 * Send notification via SNS
 */
async function sendNotification({ subject, message }) {
  const command = new PublishCommand({
    TopicArn: process.env.SNS_TOPIC_ARN,
    Subject: subject,
    Message: message
  });
  
  await snsClient.send(command);
}

/**
 * Create audit log entry in MongoDB
 */
async function createAuditLog(mongoUrl, data) {
  let client;
  
  try {
    client = new MongoClient(mongoUrl);
    await client.connect();
    
    const db = client.db();
    const auditLogs = db.collection('audit_logs');
    
    // Create audit log document
    const auditEntry = {
      timestamp: new Date(),
      userId: 'system', // System-generated backup
      userRole: 'system',
      action: data.action,
      resource: 'database',
      resourceId: data.backupId || 'backup-operation',
      outcome: data.outcome,
      ipAddress: 'lambda',
      metadata: {
        backupType: data.backupType,
        s3Key: data.s3Key || '',
        sizeBytes: data.sizeBytes?.toString() || '0',
        errorMessage: data.errorMessage || ''
      },
      complianceFlags: {
        phiAccessed: false, // Backup doesn't access individual PHI
        highRiskAction: true, // Backup is high-risk operation
        requiresReview: false
      },
      // Note: Signature will be generated by MongoDB pre-save hook
      previousLogHash: 'genesis', // Will be updated by pre-save hook
      signature: 'pending' // Will be generated by pre-save hook
    };
    
    await auditLogs.insertOne(auditEntry);
    console.log('✓ Audit log entry created');
    
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't fail backup if audit log fails
  } finally {
    if (client) {
      await client.close();
    }
  }
}

/**
 * Get retention period in days based on backup type
 */
function getRetentionDays(backupType) {
  const retentionMap = {
    daily: parseInt(process.env.RETENTION_DAYS_DAILY || '90'),
    weekly: parseInt(process.env.RETENTION_DAYS_WEEKLY || '365'),
    monthly: parseInt(process.env.RETENTION_DAYS_MONTHLY || '1095'),
    annual: parseInt(process.env.RETENTION_DAYS_ANNUAL || '2555')
  };
  return retentionMap[backupType] || 90;
}

/**
 * Get retention period in years for metadata
 */
function getRetentionYears(backupType) {
  const days = getRetentionDays(backupType);
  return Math.round(days / 365);
}

