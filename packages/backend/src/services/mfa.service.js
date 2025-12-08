/**
 * Multi-Factor Authentication (MFA) Service
 * 
 * HIPAA Requirements:
 * - §164.312(a)(2)(i) - Unique User Identification
 * - §164.312(d) - Person or Entity Authentication
 * 
 * Implements TOTP-based MFA using speakeasy
 * 
 * Dependencies Required:
 * - speakeasy: npm install speakeasy
 * - qrcode: npm install qrcode
 */

const crypto = require('crypto');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { Caregiver, AuditLog } = require('../models');
const logger = require('../config/logger');

// These will be conditionally loaded
let speakeasy;
let QRCode;

try {
  speakeasy = require('speakeasy');
  QRCode = require('qrcode');
} catch (error) {
  logger.warn('[MFA] speakeasy or qrcode not installed. MFA features will be limited.');
  logger.warn('[MFA] Install with: npm install speakeasy qrcode');
}

const MFA_ISSUER = 'MyPhoneFriend';
const BACKUP_CODES_COUNT = 10;
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive data (MFA secret)
 */
function encrypt(text) {
  if (!process.env.MFA_ENCRYPTION_KEY) {
    throw new Error('MFA_ENCRYPTION_KEY environment variable not set');
  }
  
  const key = crypto.scryptSync(process.env.MFA_ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data (MFA secret)
 */
function decrypt(encryptedData) {
  if (!process.env.MFA_ENCRYPTION_KEY) {
    throw new Error('MFA_ENCRYPTION_KEY environment variable not set');
  }
  
  const key = crypto.scryptSync(process.env.MFA_ENCRYPTION_KEY, 'salt', 32);
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate backup codes
 */
function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

/**
 * Hash backup code for storage
 */
function hashBackupCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Enable MFA for a user (Step 1: Generate secret and QR code)
 * 
 * @param {string} caregiverId - User ID
 * @returns {Promise<{ secret: string, qrCode: string, backupCodes: string[] }>}
 */
const enableMFA = async (caregiverId) => {
  if (!speakeasy || !QRCode) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'MFA service not available. Please contact administrator.'
    );
  }

  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  if (caregiver.mfaEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA is already enabled');
  }

  // Generate TOTP secret
  const secret = speakeasy.generateSecret({
    name: `${MFA_ISSUER} (${caregiver.email})`,
    issuer: MFA_ISSUER,
    length: 32
  });

  // Generate backup codes
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));

  // Save encrypted secret (not yet enabled)
  await Caregiver.findByIdAndUpdate(caregiverId, {
    mfaSecret: encrypt(secret.base32),
    mfaBackupCodes: hashedBackupCodes,
    mfaEnabled: false // Not enabled until verified
  });

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  // Create audit log
  await AuditLog.create({
    timestamp: new Date(),
    userId: caregiverId,
    userRole: caregiver.role,
    action: 'MFA_SETUP_INITIATED',
    resource: 'caregiver',
    resourceId: caregiverId,
    outcome: 'SUCCESS',
    ipAddress: 'internal',
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: true,
      requiresReview: false
    }
  });

  logger.info(`[MFA] Setup initiated for user: ${caregiverId}`);

  return {
    secret: secret.base32,
    qrCode: qrCodeUrl,
    backupCodes // Return plaintext codes for user to save (only shown once)
  };
};

/**
 * Verify and enable MFA (Step 2: Verify token)
 * 
 * @param {string} caregiverId - User ID
 * @param {string} token - 6-digit TOTP token
 * @param {string} ipAddress - User's IP address
 * @returns {Promise<boolean>}
 */
const verifyAndEnableMFA = async (caregiverId, token, ipAddress = 'unknown') => {
  if (!speakeasy) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      'MFA service not available. Please contact administrator.'
    );
  }

  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  if (!caregiver.mfaSecret) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA setup not initiated');
  }

  if (caregiver.mfaEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA is already enabled');
  }

  const decryptedSecret = decrypt(caregiver.mfaSecret);

  // Verify the token
  const verified = speakeasy.totp.verify({
    secret: decryptedSecret,
    encoding: 'base32',
    token: token,
    window: 2 // Allow 2 time steps before/after for clock skew
  });

  if (!verified) {
    // Audit failed verification
    await AuditLog.create({
      timestamp: new Date(),
      userId: caregiverId,
      userRole: caregiver.role,
      action: 'MFA_VERIFICATION_FAILED',
      resource: 'caregiver',
      resourceId: caregiverId,
      outcome: 'FAILURE',
      ipAddress,
      complianceFlags: {
        phiAccessed: false,
        highRiskAction: true,
        requiresReview: true
      }
    });

    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid MFA token');
  }

  // Enable MFA
  await Caregiver.findByIdAndUpdate(caregiverId, {
    mfaEnabled: true,
    mfaEnrolledAt: new Date()
  });

  // Audit successful enablement
  await AuditLog.create({
    timestamp: new Date(),
    userId: caregiverId,
    userRole: caregiver.role,
    action: 'MFA_ENABLED',
    resource: 'caregiver',
    resourceId: caregiverId,
    outcome: 'SUCCESS',
    ipAddress,
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: true,
      requiresReview: false
    }
  });

  logger.info(`[MFA] Enabled for user: ${caregiverId}`);

  return true;
};

/**
 * Verify MFA token during login
 * 
 * @param {string} caregiverId - User ID
 * @param {string} token - 6-digit TOTP token
 * @returns {Promise<boolean>}
 */
const verifyMFAToken = async (caregiverId, token) => {
  if (!speakeasy) {
    // If MFA library not available, allow login (degraded mode)
    logger.warn(`[MFA] Service unavailable - allowing login without MFA for user: ${caregiverId}`);
    return true;
  }

  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  // If MFA not enabled for this user, allow through
  if (!caregiver.mfaEnabled || !caregiver.mfaSecret) {
    return true;
  }

  // Check if account is locked
  if (caregiver.accountLocked) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Account is locked. Please contact support.');
  }

  const decryptedSecret = decrypt(caregiver.mfaSecret);

  // Try TOTP verification
  const verified = speakeasy.totp.verify({
    secret: decryptedSecret,
    encoding: 'base32',
    token: token,
    window: 2
  });

  if (verified) {
    return true;
  }

  // Try backup codes
  if (token && token.length === 8) {
    const hashedToken = hashBackupCode(token.toUpperCase());
    const backupCodeIndex = caregiver.mfaBackupCodes.indexOf(hashedToken);
    
    if (backupCodeIndex !== -1) {
      // Remove used backup code
      caregiver.mfaBackupCodes.splice(backupCodeIndex, 1);
      await caregiver.save();
      
      logger.info(`[MFA] Backup code used for user: ${caregiverId}. Remaining: ${caregiver.mfaBackupCodes.length}`);
      
      return true;
    }
  }

  return false;
};

/**
 * Disable MFA for a user
 * 
 * @param {string} caregiverId - User ID
 * @param {string} token - Current MFA token for verification
 * @param {string} ipAddress - User's IP address
 * @returns {Promise<boolean>}
 */
const disableMFA = async (caregiverId, token, ipAddress = 'unknown') => {
  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  if (!caregiver.mfaEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA is not enabled');
  }

  // Verify token before disabling
  const verified = await verifyMFAToken(caregiverId, token);
  if (!verified) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid MFA token');
  }

  // Disable MFA
  await Caregiver.findByIdAndUpdate(caregiverId, {
    mfaEnabled: false,
    mfaSecret: null,
    mfaBackupCodes: [],
    mfaEnrolledAt: null
  });

  // Audit log
  await AuditLog.create({
    timestamp: new Date(),
    userId: caregiverId,
    userRole: caregiver.role,
    action: 'MFA_DISABLED',
    resource: 'caregiver',
    resourceId: caregiverId,
    outcome: 'SUCCESS',
    ipAddress,
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: true,
      requiresReview: true // High-risk action
    }
  });

  logger.warn(`[MFA] Disabled for user: ${caregiverId}`);

  return true;
};

/**
 * Regenerate backup codes
 * 
 * @param {string} caregiverId - User ID
 * @param {string} token - Current MFA token for verification
 * @returns {Promise<string[]>}
 */
const regenerateBackupCodes = async (caregiverId, token) => {
  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  if (!caregiver.mfaEnabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'MFA is not enabled');
  }

  // Verify token
  const verified = await verifyMFAToken(caregiverId, token);
  if (!verified) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid MFA token');
  }

  // Generate new backup codes
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));

  await Caregiver.findByIdAndUpdate(caregiverId, {
    mfaBackupCodes: hashedBackupCodes
  });

  // Audit log
  await AuditLog.create({
    timestamp: new Date(),
    userId: caregiverId,
    userRole: caregiver.role,
    action: 'MFA_BACKUP_CODES_REGENERATED',
    resource: 'caregiver',
    resourceId: caregiverId,
    outcome: 'SUCCESS',
    ipAddress: 'internal',
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: true,
      requiresReview: false
    }
  });

  logger.info(`[MFA] Backup codes regenerated for user: ${caregiverId}`);

  return backupCodes;
};

/**
 * Get MFA status for a user
 * 
 * @param {string} caregiverId - User ID
 * @returns {Promise<object>}
 */
const getMFAStatus = async (caregiverId) => {
  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  return {
    mfaEnabled: caregiver.mfaEnabled || false,
    mfaEnrolledAt: caregiver.mfaEnrolledAt,
    backupCodesRemaining: caregiver.mfaBackupCodes?.length || 0
  };
};

module.exports = {
  enableMFA,
  verifyAndEnableMFA,
  verifyMFAToken,
  disableMFA,
  regenerateBackupCodes,
  getMFAStatus
};

