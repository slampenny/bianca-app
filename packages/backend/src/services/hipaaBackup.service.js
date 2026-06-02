const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const config = require('../config/config');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

let s3Client;
let lambdaClient;

function getBackupConfig() {
  const nodeEnv = config.env;
  const enabled = nodeEnv === 'staging' || nodeEnv === 'production';
  const environment = nodeEnv;
  return {
    enabled,
    environment,
    bucket: process.env.HIPAA_BACKUP_S3_BUCKET || `${environment}-bianca-hipaa-backups`,
    backupLambdaName: process.env.HIPAA_BACKUP_LAMBDA_NAME || `${environment}-mongodb-backup`,
    restoreLambdaName: process.env.HIPAA_RESTORE_LAMBDA_NAME || `${environment}-mongodb-restore`,
    region: config.aws.region || 'us-east-2',
  };
}

function getS3() {
  if (!s3Client) {
    s3Client = new S3Client({ region: getBackupConfig().region });
  }
  return s3Client;
}

function getLambda() {
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({ region: getBackupConfig().region });
  }
  return lambdaClient;
}

function assertBackupEnabled() {
  const cfg = getBackupConfig();
  if (!cfg.enabled) {
    throw new ApiError(httpStatus.NOT_IMPLEMENTED, 'HIPAA backups are only available in staging and production');
  }
  return cfg;
}

function mapS3Object(obj) {
  const key = obj.Key || '';
  const parts = key.split('/');
  const backupType = parts.length > 1 ? parts[0] : 'unknown';
  const fileName = parts[parts.length - 1] || key;
  return {
    key,
    backupType,
    fileName,
    sizeBytes: obj.Size || 0,
    lastModified: obj.LastModified ? obj.LastModified.toISOString() : null,
    storageClass: obj.StorageClass || 'STANDARD',
  };
}

/**
 * List HIPAA backup objects from S3.
 */
async function listBackups({ prefix, limit = 100 } = {}) {
  const cfg = assertBackupEnabled();
  const s3 = getS3();
  const results = [];
  let continuationToken;

  do {
    const resp = await s3.send(new ListObjectsV2Command({
      Bucket: cfg.bucket,
      Prefix: prefix || '',
      ContinuationToken: continuationToken,
      MaxKeys: Math.min(limit - results.length, 1000),
    }));

    for (const obj of resp.Contents || []) {
      if (!obj.Key || !obj.Key.endsWith('.gz')) continue;
      results.push(mapS3Object(obj));
      if (results.length >= limit) break;
    }

    if (results.length >= limit) break;
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);

  results.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

  return {
    environment: cfg.environment,
    bucket: cfg.bucket,
    backups: results,
    total: results.length,
  };
}

async function invokeLambda(functionName, payload) {
  const cfg = getBackupConfig();
  const resp = await getLambda().send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'RequestResponse',
    Payload: Buffer.from(JSON.stringify(payload)),
  }));

  const raw = resp.Payload ? Buffer.from(resp.Payload).toString('utf8') : '';
  let body = {};
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = { raw };
    }
  }

  if (resp.FunctionError) {
    const message = body.errorMessage || body.message || raw || 'Lambda invocation failed';
    logger.error('[HIPAA Backup] Lambda error', { functionName, message, body });
    throw new ApiError(httpStatus.BAD_GATEWAY, message);
  }

  if (body.statusCode && body.statusCode >= 400) {
    let inner = body.body;
    if (typeof inner === 'string') {
      try {
        inner = JSON.parse(inner);
      } catch {
        /* keep string */
      }
    }
    throw new ApiError(httpStatus.BAD_GATEWAY, inner?.errorMessage || inner?.message || 'Backup operation failed');
  }

  if (typeof body.body === 'string') {
    try {
      return JSON.parse(body.body);
    } catch {
      return body;
    }
  }

  return body;
}

/**
 * Trigger a backup via the backup Lambda (SSM → EC2 mongodump → S3).
 */
async function triggerBackup({ backupType = 'daily' } = {}) {
  const cfg = assertBackupEnabled();
  const allowed = ['daily', 'weekly', 'monthly'];
  if (!allowed.includes(backupType)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `backupType must be one of: ${allowed.join(', ')}`);
  }

  logger.warn('[HIPAA Backup] Manual backup triggered', { backupType, environment: cfg.environment });

  const result = await invokeLambda(cfg.backupLambdaName, {
    backupType,
    timestamp: new Date().toISOString(),
  });

  return {
    environment: cfg.environment,
    backupType,
    ...result,
  };
}

/**
 * Restore from a backup via the restore Lambda (SSM → EC2 mongorestore).
 */
async function restoreBackup({ backupKey, confirmRestore }) {
  const cfg = assertBackupEnabled();

  if (confirmRestore !== 'YES_I_WANT_TO_RESTORE') {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Restore not confirmed. Set confirmRestore to YES_I_WANT_TO_RESTORE',
    );
  }

  if (!backupKey || typeof backupKey !== 'string') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'backupKey is required');
  }

  if (!backupKey.endsWith('.gz')) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'backupKey must reference a .gz archive');
  }

  logger.warn('[HIPAA Backup] RESTORE initiated', { backupKey, environment: cfg.environment });

  const result = await invokeLambda(cfg.restoreLambdaName, {
    CONFIRM_RESTORE: 'YES_I_WANT_TO_RESTORE',
    backupKey,
  });

  return {
    environment: cfg.environment,
    backupKey,
    ...result,
  };
}

module.exports = {
  getBackupConfig,
  listBackups,
  triggerBackup,
  restoreBackup,
};
