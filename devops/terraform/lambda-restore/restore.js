/**
 * HIPAA Backup Restore Lambda
 * 
 * Manual disaster recovery function
 * Restores MongoDB from encrypted S3 backup
 * 
 * WARNING: This will overwrite the target database!
 * Only invoke manually during disaster recovery.
 */

const { MongoClient } = require('mongodb');
const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');

const execAsync = promisify(exec);

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-2' });
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-2' });
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-2' });

exports.handler = async (event) => {
  // Require explicit confirmation to prevent accidental restore
  if (!event.CONFIRM_RESTORE || event.CONFIRM_RESTORE !== 'YES_I_WANT_TO_RESTORE') {
    throw new Error('Restore not confirmed. Set CONFIRM_RESTORE=YES_I_WANT_TO_RESTORE in event payload.');
  }
  
  const backupKey = event.backupKey; // e.g., "daily/backup-2025-01-15T12-00-00Z.gz"
  const targetDatabase = event.targetDatabase || 'production'; // production or staging
  
  if (!backupKey) {
    throw new Error('backupKey is required in event payload');
  }
  
  console.log(`⚠️  STARTING RESTORE OPERATION`);
  console.log(`Backup: ${backupKey}`);
  console.log(`Target: ${targetDatabase}`);
  console.log(`WARNING: This will overwrite the database!`);
  
  try {
    // Step 1: Get target MongoDB URL
    console.log('Getting target MongoDB credentials...');
    const mongoUrl = await getMongoDBUrl(targetDatabase);
    
    // Step 2: Download backup from S3
    console.log('Downloading backup from S3...');
    const backupFile = await downloadBackup(backupKey);
    const stats = fs.statSync(backupFile);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`Downloaded: ${fileSizeMB} MB`);
    
    // Step 3: Verify backup file
    console.log('Verifying backup integrity...');
    await verifyBackupFile(backupFile);
    
    // Step 4: Create pre-restore backup (safety)
    console.log('Creating safety backup of current database...');
    const safetyBackupKey = await createSafetyBackup(mongoUrl);
    console.log(`Safety backup created: ${safetyBackupKey}`);
    
    // Step 5: Restore database
    console.log('⚠️  RESTORING DATABASE (this will drop existing data)...');
    await restoreDatabase(backupFile, mongoUrl);
    
    // Step 6: Verify restoration
    console.log('Verifying restore...');
    const collectionCount = await verifyRestore(mongoUrl);
    console.log(`Restored ${collectionCount} collections`);
    
    // Step 7: Cleanup
    fs.unlinkSync(backupFile);
    
    // Step 8: Send notification
    await sendNotification({
      subject: `✅ Database Restore COMPLETED - ${process.env.ENVIRONMENT}`,
      message: `
DATABASE RESTORE COMPLETED

Backup Restored: ${backupKey}
Target Database: ${targetDatabase}
Collections Restored: ${collectionCount}
Backup Size: ${fileSizeMB} MB
Safety Backup: ${safetyBackupKey}
Timestamp: ${new Date().toISOString()}
Environment: ${process.env.ENVIRONMENT}

Database has been restored from backup.
Test application functionality immediately.

If restore was incorrect, you can restore from safety backup:
${safetyBackupKey}
      `.trim()
    });
    
    // Step 9: Create audit log
    await createAuditLog(mongoUrl, {
      action: 'RESTORE',
      backupKey,
      targetDatabase,
      collectionCount,
      safetyBackupKey,
      outcome: 'SUCCESS'
    });
    
    console.log('✅ Restore completed successfully');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        backupRestored: backupKey,
        targetDatabase,
        collectionsRestored: collectionCount,
        safetyBackup: safetyBackupKey,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
    
    await sendNotification({
      subject: `❌ Database Restore FAILED - ${process.env.ENVIRONMENT}`,
      message: `
DATABASE RESTORE FAILURE!

Backup: ${backupKey}
Target: ${targetDatabase}
Error: ${error.message}
Timestamp: ${new Date().toISOString()}
Environment: ${process.env.ENVIRONMENT}

IMMEDIATE ACTION REQUIRED: Database may be in inconsistent state!
Check database status and retry restore if needed.
      `.trim()
    });
    
    throw error;
  }
};

/**
 * Get MongoDB URL from Secrets Manager
 */
async function getMongoDBUrl(targetDatabase) {
  const secretName = targetDatabase === 'staging' 
    ? `${process.env.ENVIRONMENT}/mongodb-url-staging`
    : process.env.MONGODB_URL_SECRET_NAME;
  
  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await secretsClient.send(command);
  
  if (response.SecretString) {
    const secrets = JSON.parse(response.SecretString);
    return secrets.MONGODB_URL || secrets.mongodb_url;
  }
  
  throw new Error('MongoDB URL not found in secrets');
}

/**
 * Download backup from S3
 */
async function downloadBackup(s3Key) {
  const downloadPath = `/tmp/${path.basename(s3Key)}`;
  
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: s3Key
  });
  
  const response = await s3Client.send(command);
  
  // Verify encryption
  if (!response.ServerSideEncryption || response.ServerSideEncryption !== 'aws:kms') {
    console.warn('WARNING: Backup not encrypted with KMS!');
  }
  
  // Convert stream to buffer and save
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  const fileBuffer = Buffer.concat(chunks);
  
  fs.writeFileSync(downloadPath, fileBuffer);
  
  return downloadPath;
}

/**
 * Verify backup file integrity
 */
async function verifyBackupFile(filePath) {
  try {
    // Test gzip integrity
    await execAsync(`gunzip -t ${filePath}`);
    console.log('✓ Backup file integrity verified');
    return true;
  } catch (error) {
    throw new Error(`Backup file is corrupted: ${error.message}`);
  }
}

/**
 * Create safety backup before restore
 */
async function createSafetyBackup(mongoUrl) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `safety-backup-${timestamp}`;
  const dumpFile = `/tmp/${backupId}.gz`;
  
  const command = `mongodump --uri="${mongoUrl}" --archive=${dumpFile} --gzip`;
  await execAsync(command);
  
  // Upload to S3
  const fileContent = fs.readFileSync(dumpFile);
  const s3Key = `safety/${backupId}.gz`;
  
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const uploadCommand = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: s3Key,
    Body: fileContent,
    ServerSideEncryption: 'aws:kms',
    SSEKMSKeyId: process.env.KMS_KEY_ID
  });
  
  await s3Client.send(uploadCommand);
  fs.unlinkSync(dumpFile);
  
  return s3Key;
}

/**
 * Restore database from backup
 */
async function restoreDatabase(backupFile, mongoUrl) {
  const command = `mongorestore --uri="${mongoUrl}" --archive=${backupFile} --gzip --drop`;
  
  const { stdout, stderr } = await execAsync(command);
  
  if (stderr && !stderr.includes('done')) {
    console.warn('mongorestore stderr:', stderr);
  }
  
  console.log('✓ Database restored');
  return true;
}

/**
 * Verify restore succeeded
 */
async function verifyRestore(mongoUrl) {
  const client = new MongoClient(mongoUrl);
  await client.connect();
  
  const db = client.db();
  const collections = await db.listCollections().toArray();
  
  await client.close();
  
  return collections.length;
}

/**
 * Create audit log entry
 */
async function createAuditLog(mongoUrl, data) {
  let client;
  
  try {
    client = new MongoClient(mongoUrl);
    await client.connect();
    
    const db = client.db();
    const auditLogs = db.collection('audit_logs');
    
    const auditEntry = {
      timestamp: new Date(),
      userId: 'system',
      userRole: 'system',
      action: data.action,
      resource: 'database',
      resourceId: data.backupKey,
      outcome: data.outcome,
      metadata: {
        targetDatabase: data.targetDatabase,
        collectionCount: data.collectionCount?.toString() || '0',
        safetyBackupKey: data.safetyBackupKey || ''
      },
      complianceFlags: {
        phiAccessed: false,
        highRiskAction: true,
        requiresReview: true // Restore requires review
      },
      previousLogHash: 'genesis',
      signature: 'pending'
    };
    
    await auditLogs.insertOne(auditEntry);
    console.log('✓ Audit log created');
    
  } catch (error) {
    console.error('Failed to create audit log:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

/**
 * Send SNS notification
 */
async function sendNotification({ subject, message }) {
  const command = new PublishCommand({
    TopicArn: process.env.SNS_TOPIC_ARN,
    Subject: subject,
    Message: message
  });
  
  await snsClient.send(command);
}

