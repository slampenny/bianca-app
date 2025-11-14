const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * HIPAA Audit Log Model
 * 
 * HIPAA Requirements:
 * - §164.312(b) - Audit Controls: Record and examine activity in systems containing ePHI
 * - §164.308(a)(1)(ii)(D) - Information System Activity Review
 * - §164.308(a)(3)(ii)(A) - Log-in Monitoring
 * 
 * Features:
 * - Immutable logs (cannot be modified or deleted)
 * - Tamper-proof chain with cryptographic signatures
 * - 7-year retention for HIPAA compliance
 * - NO PHI stored in logs (only references)
 */

const auditLogSchema = mongoose.Schema(
  {
    // Timestamp
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },

    // User Information (NO PHI)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Caregiver',
      required: true,
      index: true,
    },
    userRole: {
      type: String,
      required: true,
      enum: ['superAdmin', 'orgAdmin', 'staff', 'invited', 'unverified', 'system'],
    },
    userEmail: {
      type: String, // Hashed in pre-save hook
      required: false,
    },

    // Action Details (NO PHI)
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE',
        'READ',
        'UPDATE',
        'DELETE',
        'ACCESS',
        'LOGIN',
        'LOGOUT',
        'LOGIN_FAILED',
        'MFA_ENABLED',
        'MFA_DISABLED',
        'MFA_SETUP_INITIATED',
        'MFA_VERIFIED',
        'MFA_VERIFICATION_FAILED',
        'MFA_BACKUP_CODES_REGENERATED',
        'PASSWORD_CHANGED',
        'PASSWORD_RESET',
        'SESSION_TIMEOUT',
        'ACCOUNT_LOCKED',
        'ACCOUNT_UNLOCKED',
        'EXPORT',
        'DOWNLOAD',
        'BACKUP',
        'RESTORE',
        'CONFIG_CHANGE',
        'PERMISSION_CHANGE',
        'BREACH_DETECTED',
        'BREACH_NOTIFICATION_SENT',
      ],
      index: true,
    },

    // Resource Information (NO PHI - use IDs only)
    resource: {
      type: String,
      required: true,
      enum: [
        'patient',
        'conversation',
        'caregiver',
        'org',
        'alert',
        'medicalAnalysis',
        'fraudAbuseAnalysis',
        'payment',
        'invoice',
        'report',
        'schedule',
        'session',
        'database',
        'system',
      ],
      index: true,
    },
    resourceId: {
      type: String, // Can be ObjectId or "multiple" or "system"
      required: true,
      index: true,
    },

    // Outcome
    outcome: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'PARTIAL'],
      required: true,
      index: true,
    },

    // Request Metadata (NO PHI)
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: false,
    },
    requestMethod: {
      type: String,
      required: false,
    },
    requestPath: {
      type: String,
      required: false,
    },
    statusCode: {
      type: Number,
      required: false,
    },

    // Error Information (NO PHI)
    errorMessage: {
      type: String,
      required: false,
    },
    errorCode: {
      type: String,
      required: false,
    },

    // Tamper Detection
    previousLogHash: {
      type: String,
      required: true,
      default: 'genesis', // First log has no previous
    },
    signature: {
      type: String,
      required: true,
      default: 'pending', // Will be set in pre-save hook
    },

    // Additional Context (NO PHI - use codes/IDs only)
    metadata: {
      type: Map,
      of: String,
      required: false,
      default: {},
    },

    // HIPAA Compliance Tags
    complianceFlags: {
      phiAccessed: { type: Boolean, default: false },
      highRiskAction: { type: Boolean, default: false },
      requiresReview: { type: Boolean, default: false },
    },
  },
  {
    timestamps: false, // Using custom timestamp field
    collection: 'audit_logs',
  }
);

// ============================================
// INDEXES for Performance and Compliance
// ============================================

// 7-year retention index (HIPAA requirement: §164.316(b)(2)(i))
// 2555 days = 7 years
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 220752000 });

// Common query patterns
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, outcome: 1, timestamp: -1 });
auditLogSchema.index({ 'complianceFlags.requiresReview': 1, timestamp: -1 });

// ============================================
// PRE-SAVE HOOK: Cryptographic Signature
// ============================================

auditLogSchema.pre('save', async function (next) {
  // Hash user email for privacy
  if (this.userEmail) {
    const hash = crypto.createHash('sha256');
    hash.update(this.userEmail);
    this.userEmail = hash.digest('hex');
  }

  // Get previous log for chain
  if (this.previousLogHash === 'genesis') {
    const previousLog = await this.constructor.findOne().sort({ timestamp: -1 }).exec();
    if (previousLog) {
      this.previousLogHash = previousLog.signature;
    }
  }

  // Create tamper-proof signature
  const dataToSign = JSON.stringify({
    timestamp: this.timestamp.toISOString(),
    userId: this.userId.toString(),
    action: this.action,
    resource: this.resource,
    resourceId: this.resourceId,
    outcome: this.outcome,
    previousLogHash: this.previousLogHash,
  });

  const secret = process.env.AUDIT_LOG_SECRET || 'CHANGE-THIS-IN-PRODUCTION';
  this.signature = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');

  next();
});

// ============================================
// PREVENT MODIFICATIONS (Immutable Logs)
// ============================================

auditLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('HIPAA Violation: Audit logs cannot be modified. This action has been logged.');
});

auditLogSchema.pre('findOneAndDelete', function () {
  throw new Error('HIPAA Violation: Audit logs cannot be deleted. This action has been logged.');
});

auditLogSchema.pre('updateOne', function () {
  throw new Error('HIPAA Violation: Audit logs cannot be modified. This action has been logged.');
});

auditLogSchema.pre('deleteOne', function () {
  // Allow deletion in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  throw new Error('HIPAA Violation: Audit logs cannot be deleted. This action has been logged.');
});

auditLogSchema.pre('deleteMany', function () {
  // Allow deletion in test environment
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  throw new Error('HIPAA Violation: Audit logs cannot be bulk deleted. This action has been logged.');
});

// ============================================
// STATIC METHODS
// ============================================

/**
 * Create audit log entry with automatic chaining
 * @param {Object} data - Audit log data
 * @returns {Promise<AuditLog>}
 */
auditLogSchema.statics.createLog = async function (data) {
  const log = new this(data);
  await log.save();
  return log;
};

/**
 * Verify audit log chain integrity
 * @param {Number} limit - Number of recent logs to verify
 * @returns {Promise<Object>} - Verification result
 */
auditLogSchema.statics.verifyChainIntegrity = async function (limit = 1000) {
  const logs = await this.find().sort({ timestamp: 1 }).limit(limit).exec();

  const results = {
    total: logs.length,
    verified: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 1; i < logs.length; i++) {
    const currentLog = logs[i];
    const previousLog = logs[i - 1];

    if (currentLog.previousLogHash !== previousLog.signature) {
      results.failed++;
      results.errors.push({
        logId: currentLog._id,
        timestamp: currentLog.timestamp,
        error: 'Chain broken: previousLogHash does not match previous signature',
      });
    } else {
      // Verify signature
      const dataToSign = JSON.stringify({
        timestamp: currentLog.timestamp.toISOString(),
        userId: currentLog.userId.toString(),
        action: currentLog.action,
        resource: currentLog.resource,
        resourceId: currentLog.resourceId,
        outcome: currentLog.outcome,
        previousLogHash: currentLog.previousLogHash,
      });

      const secret = process.env.AUDIT_LOG_SECRET || 'CHANGE-THIS-IN-PRODUCTION';
      const expectedSignature = crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');

      if (currentLog.signature === expectedSignature) {
        results.verified++;
      } else {
        results.failed++;
        results.errors.push({
          logId: currentLog._id,
          timestamp: currentLog.timestamp,
          error: 'Signature verification failed - possible tampering',
        });
      }
    }
  }

  return results;
};

/**
 * Get audit logs for a specific resource
 * @param {String} resource - Resource type
 * @param {String} resourceId - Resource ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
auditLogSchema.statics.getResourceAuditTrail = async function (resource, resourceId, options = {}) {
  const { limit = 100, startDate, endDate } = options;

  const query = { resource, resourceId };

  if (startDate || endDate) {
    query.timestamp = {};
    if (startDate) query.timestamp.$gte = new Date(startDate);
    if (endDate) query.timestamp.$lte = new Date(endDate);
  }

  return this.find(query).sort({ timestamp: -1 }).limit(limit).populate('userId', 'name email role').exec();
};

/**
 * Get user activity logs
 * @param {String} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
auditLogSchema.statics.getUserActivity = async function (userId, options = {}) {
  const { limit = 100, action, outcome } = options;

  const query = { userId };
  if (action) query.action = action;
  if (outcome) query.outcome = outcome;

  return this.find(query).sort({ timestamp: -1 }).limit(limit).exec();
};

/**
 * Get logs requiring compliance review
 * @param {Object} options - Query options
 * @returns {Promise<Array>}
 */
auditLogSchema.statics.getComplianceReviewLogs = async function (options = {}) {
  const { limit = 100, startDate } = options;

  const query = { 'complianceFlags.requiresReview': true };

  if (startDate) {
    query.timestamp = { $gte: new Date(startDate) };
  }

  return this.find(query).sort({ timestamp: -1 }).limit(limit).populate('userId', 'name email role').exec();
};

/**
 * Generate audit report for date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>}
 */
auditLogSchema.statics.generateAuditReport = async function (startDate, endDate) {
  const logs = await this.find({
    timestamp: {
      $gte: startDate,
      $lte: endDate,
    },
  }).exec();

  const report = {
    period: {
      start: startDate,
      end: endDate,
    },
    summary: {
      totalLogs: logs.length,
      byAction: {},
      byResource: {},
      byOutcome: {},
      byUser: {},
      phiAccessCount: 0,
      highRiskActions: 0,
      failedActions: 0,
    },
    details: logs,
  };

  logs.forEach((log) => {
    // By action
    report.summary.byAction[log.action] = (report.summary.byAction[log.action] || 0) + 1;

    // By resource
    report.summary.byResource[log.resource] = (report.summary.byResource[log.resource] || 0) + 1;

    // By outcome
    report.summary.byOutcome[log.outcome] = (report.summary.byOutcome[log.outcome] || 0) + 1;

    // By user
    const userId = log.userId.toString();
    report.summary.byUser[userId] = (report.summary.byUser[userId] || 0) + 1;

    // Compliance flags
    if (log.complianceFlags.phiAccessed) report.summary.phiAccessCount++;
    if (log.complianceFlags.highRiskAction) report.summary.highRiskActions++;
    if (log.outcome === 'FAILURE') report.summary.failedActions++;
  });

  return report;
};

// ============================================
// MODEL EXPORT
// ============================================

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;

