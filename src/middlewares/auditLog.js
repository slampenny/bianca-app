const mongoose = require('mongoose');
const { AuditLog } = require('../models');
const logger = require('../config/logger');

/**
 * HIPAA Audit Logging Middleware
 * 
 * HIPAA Requirements:
 * - §164.312(b) - Audit Controls
 * - §164.308(a)(1)(ii)(D) - Information System Activity Review
 * 
 * This middleware automatically logs all PHI access and modifications
 */

// Define which routes contain PHI and should be audited
const PHI_ROUTES = {
  // Patient routes
  'GET /v1/patients/:id': { action: 'READ', resource: 'patient', phiAccessed: true },
  'GET /v1/patients': { action: 'READ', resource: 'patient', phiAccessed: true },
  'POST /v1/patients': { action: 'CREATE', resource: 'patient', phiAccessed: true, highRisk: true },
  'PATCH /v1/patients/:id': { action: 'UPDATE', resource: 'patient', phiAccessed: true },
  'PUT /v1/patients/:id': { action: 'UPDATE', resource: 'patient', phiAccessed: true },
  'DELETE /v1/patients/:id': { action: 'DELETE', resource: 'patient', phiAccessed: true, highRisk: true },

  // Conversation routes (contain PHI)
  'GET /v1/conversations/:id': { action: 'READ', resource: 'conversation', phiAccessed: true },
  'GET /v1/conversations': { action: 'READ', resource: 'conversation', phiAccessed: true },
  'POST /v1/conversations': { action: 'CREATE', resource: 'conversation', phiAccessed: true },
  'PATCH /v1/conversations/:id': { action: 'UPDATE', resource: 'conversation', phiAccessed: true },
  'DELETE /v1/conversations/:id': { action: 'DELETE', resource: 'conversation', phiAccessed: true, highRisk: true },

  // Medical analysis routes (contain PHI)
  'GET /v1/medical-analysis/:patientId': { action: 'READ', resource: 'medicalAnalysis', phiAccessed: true },
  'POST /v1/medical-analysis/:patientId': { action: 'CREATE', resource: 'medicalAnalysis', phiAccessed: true },
  'GET /v1/medical-analysis/:patientId/baseline': { action: 'READ', resource: 'medicalAnalysis', phiAccessed: true },
  'POST /v1/medical-analysis/:patientId/baseline': { action: 'CREATE', resource: 'medicalAnalysis', phiAccessed: true },

  // Sentiment analysis routes
  'GET /v1/sentiment/patient/:patientId/trend': { action: 'READ', resource: 'patient', phiAccessed: true },
  'GET /v1/sentiment/patient/:patientId/summary': { action: 'READ', resource: 'patient', phiAccessed: true },
  'GET /v1/sentiment/conversation/:conversationId': { action: 'READ', resource: 'conversation', phiAccessed: true },
  'POST /v1/sentiment/conversation/:conversationId/analyze': { action: 'CREATE', resource: 'conversation', phiAccessed: true },

  // Call routes
  'POST /v1/calls/initiate': { action: 'CREATE', resource: 'conversation', phiAccessed: true },
  'GET /v1/calls/:conversationId/status': { action: 'READ', resource: 'conversation', phiAccessed: true },
  'POST /v1/calls/:conversationId/status': { action: 'UPDATE', resource: 'conversation', phiAccessed: true },
  'POST /v1/calls/:conversationId/end': { action: 'UPDATE', resource: 'conversation', phiAccessed: true },

  // Alert routes (may contain PHI context)
  'GET /v1/alerts': { action: 'READ', resource: 'alert', phiAccessed: false },
  'GET /v1/alerts/:id': { action: 'READ', resource: 'alert', phiAccessed: true },
  'POST /v1/alerts': { action: 'CREATE', resource: 'alert', phiAccessed: true },
  'PATCH /v1/alerts/:id': { action: 'UPDATE', resource: 'alert', phiAccessed: true },

  // Reports (aggregated PHI)
  'GET /v1/reports': { action: 'READ', resource: 'report', phiAccessed: true },
  'POST /v1/reports': { action: 'CREATE', resource: 'report', phiAccessed: true },

  // Export/Download operations (high risk)
  'GET /v1/patients/:id/export': { action: 'EXPORT', resource: 'patient', phiAccessed: true, highRisk: true },
  'GET /v1/conversations/:id/export': { action: 'EXPORT', resource: 'conversation', phiAccessed: true, highRisk: true },
  'POST /v1/reports/export': { action: 'EXPORT', resource: 'report', phiAccessed: true, highRisk: true },
};

// Authentication events that need auditing
const AUTH_ROUTES = {
  'POST /v1/auth/login': { action: 'LOGIN', resource: 'session' },
  'POST /v1/auth/logout': { action: 'LOGOUT', resource: 'session' },
  'POST /v1/auth/forgot-password': { action: 'PASSWORD_RESET', resource: 'caregiver' },
  'POST /v1/auth/reset-password': { action: 'PASSWORD_CHANGED', resource: 'caregiver' },
};

/**
 * Extract resource ID from request
 */
function extractResourceId(req, config) {
  // Check params for common ID fields
  if (req.params.id) return req.params.id;
  if (req.params.patientId) return req.params.patientId;
  if (req.params.conversationId) return req.params.conversationId;
  
  // For POST requests creating new resources, use "new" or "pending"
  if (req.method === 'POST') {
    return req.body._id || req.body.id || 'new';
  }
  
  // For GET requests without ID, it's a list operation
  if (req.method === 'GET' && !req.params.id) {
    return 'multiple';
  }
  
  return 'unknown';
}

/**
 * Main audit logging middleware
 */
const auditMiddleware = async (req, res, next) => {
  // Skip if no user (unauthenticated routes)
  if (!req.caregiver && !req.path.includes('/auth/login')) {
    return next();
  }

  // Construct route key
  const routePath = req.route?.path || req.path;
  const routeKey = `${req.method} ${routePath}`;
  
  // Check if this route needs auditing
  const auditConfig = PHI_ROUTES[routeKey] || AUTH_ROUTES[routeKey];
  
  if (!auditConfig) {
    return next(); // Not a PHI-related or auth endpoint
  }

  // Capture original response methods
  const originalJson = res.json;
  const originalSend = res.send;
  
  // Flag to ensure we only log once
  let logged = false;

  // Create audit log function
  const createAudit = async (outcome = 'SUCCESS', errorMessage = null) => {
    if (logged) return; // Prevent duplicate logs
    logged = true;

    try {
      const resourceId = extractResourceId(req, auditConfig);
      
      const auditData = {
        timestamp: new Date(),
        userId: req.caregiver?._id || req.caregiver?.id || new mongoose.Types.ObjectId(),
        userRole: req.caregiver?.role || 'unverified',
        action: auditConfig.action,
        resource: auditConfig.resource,
        resourceId: resourceId.toString(),
        outcome,
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('user-agent'),
        requestMethod: req.method,
        requestPath: req.path,
        statusCode: res.statusCode,
        complianceFlags: {
          phiAccessed: auditConfig.phiAccessed || false,
          highRiskAction: auditConfig.highRisk || false,
          requiresReview: (auditConfig.highRisk || outcome === 'FAILURE'),
        },
      };

      // Add error information if failed
      if (errorMessage) {
        auditData.errorMessage = errorMessage;
      }

      // Add metadata for specific routes
      const metadata = {};
      if (req.query.timeRange) metadata.timeRange = req.query.timeRange;
      if (req.query.startDate) metadata.startDate = req.query.startDate;
      if (req.query.endDate) metadata.endDate = req.query.endDate;
      if (Object.keys(metadata).length > 0) {
        auditData.metadata = metadata;
      }

      // Create audit log
      await AuditLog.createLog(auditData);

      // Log to application logger (without PHI)
      logger.info(`[AUDIT] ${auditConfig.action} ${auditConfig.resource} by user ${auditData.userId} - ${outcome}`, {
        action: auditConfig.action,
        resource: auditConfig.resource,
        outcome,
        userId: auditData.userId,
        ipAddress: auditData.ipAddress,
      });

    } catch (error) {
      // Critical: Audit logging failed
      logger.error('[AUDIT] Failed to create audit log:', {
        error: error.message,
        route: routeKey,
        userId: req.caregiver?._id,
      });
      
      // Don't fail the request, but this should trigger alerts
      // In production, you might want to queue failed audit logs for retry
    }
  };

  // Intercept res.json
  res.json = function (data) {
    const outcome = res.statusCode < 400 ? 'SUCCESS' : 'FAILURE';
    const errorMessage = res.statusCode >= 400 ? (data?.message || 'Request failed') : null;
    
    createAudit(outcome, errorMessage).then(() => {
      originalJson.call(this, data);
    });
  };

  // Intercept res.send
  res.send = function (data) {
    const outcome = res.statusCode < 400 ? 'SUCCESS' : 'FAILURE';
    const errorMessage = res.statusCode >= 400 ? 'Request failed' : null;
    
    createAudit(outcome, errorMessage).then(() => {
      originalSend.call(this, data);
    });
  };

  // Handle errors
  res.on('finish', () => {
    if (!logged && res.statusCode >= 400) {
      createAudit('FAILURE', `HTTP ${res.statusCode}`);
    }
  });

  next();
};

/**
 * Middleware to log authentication failures
 * Should be used in auth controller before the main audit middleware
 */
const auditAuthFailure = async (email, ipAddress, userAgent, errorMessage) => {
  try {
    // Create a system ObjectId for failed logins
    const systemUserId = new mongoose.Types.ObjectId();
    
    await AuditLog.createLog({
      timestamp: new Date(),
      userId: systemUserId, // Use ObjectId for system
      userRole: 'unverified', // Failed logins are from unverified users
      userEmail: email, // Will be hashed by pre-save hook
      action: 'LOGIN_FAILED',
      resource: 'session',
      resourceId: 'auth',
      outcome: 'FAILURE',
      ipAddress,
      userAgent,
      errorMessage,
      complianceFlags: {
        phiAccessed: false,
        highRiskAction: true, // Failed logins are security events
        requiresReview: true,
      },
    });
  } catch (error) {
    logger.error('[AUDIT] Failed to log authentication failure:', error);
  }
};

/**
 * Manually create audit log for special cases
 */
const createManualAuditLog = async (data) => {
  try {
    return await AuditLog.createLog(data);
  } catch (error) {
    logger.error('[AUDIT] Failed to create manual audit log:', error);
    throw error;
  }
};

module.exports = {
  auditMiddleware,
  auditAuthFailure,
  createManualAuditLog,
};

