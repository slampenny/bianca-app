const mongoose = require('mongoose');
const { createManualAuditLog } = require('../middlewares/auditLog');

const CATEGORY = 'family_digest_verification';

/** Stable system actor for unauthenticated public verification links. */
const SYSTEM_USER_ID = new mongoose.Types.ObjectId('000000000000000000000001');

const auditContextFromReq = (req) => ({
  ipAddress: req?.ip || req?.connection?.remoteAddress || 'unknown',
  userAgent: req?.get?.('user-agent'),
  requestMethod: req?.method,
  requestPath: req?.path || req?.originalUrl,
});

const logVerificationEmailRequested = async (caregiver, clientId, req) => {
  await createManualAuditLog({
    timestamp: new Date(),
    userId: caregiver._id || caregiver.id,
    userRole: caregiver.role,
    action: 'CREATE',
    resource: 'client',
    resourceId: String(clientId),
    outcome: 'SUCCESS',
    statusCode: 200,
    ...auditContextFromReq(req),
    metadata: {
      category: CATEGORY,
      event: 'verification_email_requested',
    },
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: false,
      requiresReview: false,
    },
  });
};

const logVerificationSucceeded = async (clientId, req, { alreadyVerified = false } = {}) => {
  await createManualAuditLog({
    timestamp: new Date(),
    userId: SYSTEM_USER_ID,
    userRole: 'system',
    action: 'UPDATE',
    resource: 'client',
    resourceId: String(clientId),
    outcome: 'SUCCESS',
    statusCode: 200,
    ...auditContextFromReq(req),
    metadata: {
      category: CATEGORY,
      event: alreadyVerified ? 'verification_already_complete' : 'verification_succeeded',
    },
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: false,
      requiresReview: false,
    },
  });
};

const logVerificationFailed = async (clientId, req, errorMessage, statusCode = 401) => {
  await createManualAuditLog({
    timestamp: new Date(),
    userId: SYSTEM_USER_ID,
    userRole: 'system',
    action: 'UPDATE',
    resource: 'client',
    resourceId: clientId ? String(clientId) : 'unknown',
    outcome: 'FAILURE',
    statusCode,
    errorMessage: (errorMessage || 'Verification failed').slice(0, 500),
    ...auditContextFromReq(req),
    metadata: {
      category: CATEGORY,
      event: 'verification_failed',
    },
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: false,
      requiresReview: true,
    },
  });
};

module.exports = {
  CATEGORY,
  logVerificationEmailRequested,
  logVerificationSucceeded,
  logVerificationFailed,
};
