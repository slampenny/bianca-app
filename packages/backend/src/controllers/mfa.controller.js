/**
 * MFA Controller
 * 
 * Handles Multi-Factor Authentication endpoints
 */

const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { mfaService } = require('../services');

/**
 * Enable MFA (Step 1)
 * Generates QR code and backup codes
 */
const enableMFA = catchAsync(async (req, res) => {
  const caregiverId = req.caregiver.id;
  const ipAddress = req.ip || req.connection.remoteAddress;
  
  const mfaData = await mfaService.enableMFA(caregiverId);
  
  res.status(httpStatus.OK).send({
    message: 'Scan the QR code with your authenticator app',
    qrCode: mfaData.qrCode,
    secret: mfaData.secret, // Also provide secret for manual entry
    backupCodes: mfaData.backupCodes // Save these securely!
  });
});

/**
 * Verify and enable MFA (Step 2)
 * Verifies the TOTP token and activates MFA
 */
const verifyAndEnableMFA = catchAsync(async (req, res) => {
  const caregiverId = req.caregiver.id;
  const { token } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  
  await mfaService.verifyAndEnableMFA(caregiverId, token, ipAddress);
  
  res.status(httpStatus.OK).send({
    message: 'MFA successfully enabled',
    mfaEnabled: true
  });
});

/**
 * Disable MFA
 * Requires current MFA token for verification
 */
const disableMFA = catchAsync(async (req, res) => {
  const caregiverId = req.caregiver.id;
  const { token } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  
  await mfaService.disableMFA(caregiverId, token, ipAddress);
  
  res.status(httpStatus.OK).send({
    message: 'MFA successfully disabled',
    mfaEnabled: false
  });
});

/**
 * Regenerate backup codes
 * Requires current MFA token
 */
const regenerateBackupCodes = catchAsync(async (req, res) => {
  const caregiverId = req.caregiver.id;
  const { token } = req.body;
  
  const backupCodes = await mfaService.regenerateBackupCodes(caregiverId, token);
  
  res.status(httpStatus.OK).send({
    message: 'Backup codes regenerated',
    backupCodes
  });
});

/**
 * Get MFA status
 * Returns whether MFA is enabled and backup codes remaining
 */
const getMFAStatus = catchAsync(async (req, res) => {
  const caregiverId = req.caregiver.id;
  
  const status = await mfaService.getMFAStatus(caregiverId);
  
  res.status(httpStatus.OK).send(status);
});

module.exports = {
  enableMFA,
  verifyAndEnableMFA,
  disableMFA,
  regenerateBackupCodes,
  getMFAStatus
};

