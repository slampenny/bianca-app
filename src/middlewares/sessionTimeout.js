/**
 * HIPAA-Compliant Session Timeout Middleware
 * 
 * HIPAA Requirements:
 * - §164.312(a)(2)(iii) - Automatic Logoff
 * - Implements automatic session termination after period of inactivity
 * 
 * Configuration:
 * - Default idle timeout: 15 minutes (900,000 ms)
 * - Configurable via environment variable: SESSION_TIMEOUT_MINUTES
 * 
 * For production with multiple servers, replace in-memory store with Redis
 */

const logger = require('../config/logger');
const { createManualAuditLog } = require('./auditLog');
const { Caregiver } = require('../models');

// Configuration
const IDLE_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '15') * 60 * 1000; // Default 15 minutes
const CLEANUP_INTERVAL = 60 * 1000; // Cleanup every 1 minute

/**
 * In-Memory Session Store
 * 
 * NOTE: For production with multiple servers, replace with Redis:
 * 
 * const Redis = require('ioredis');
 * const redis = new Redis(process.env.REDIS_URL);
 * 
 * // Set activity: redis.set(`session:${userId}:lastActivity`, Date.now(), 'EX', IDLE_TIMEOUT / 1000)
 * // Get activity: redis.get(`session:${userId}:lastActivity`)
 */
class SessionStore {
  constructor() {
    this.sessions = new Map();
    this.startCleanup();
  }

  setLastActivity(userId, timestamp = Date.now()) {
    this.sessions.set(userId, timestamp);
  }

  getLastActivity(userId) {
    return this.sessions.get(userId);
  }

  removeSession(userId) {
    this.sessions.delete(userId);
  }

  // Cleanup expired sessions every minute
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      const expiredSessions = [];

      for (const [userId, lastActivity] of this.sessions.entries()) {
        if (now - lastActivity > IDLE_TIMEOUT) {
          expiredSessions.push(userId);
        }
      }

      expiredSessions.forEach(userId => {
        this.sessions.delete(userId);
        logger.info(`[SESSION] Cleaned up expired session for user: ${userId}`);
      });

      if (expiredSessions.length > 0) {
        logger.info(`[SESSION] Cleaned up ${expiredSessions.length} expired sessions`);
      }
    }, CLEANUP_INTERVAL);
  }

  // Get session stats (for monitoring)
  getStats() {
    const now = Date.now();
    let active = 0;
    let expiring = 0;

    for (const [userId, lastActivity] of this.sessions.entries()) {
      const idleTime = now - lastActivity;
      if (idleTime < IDLE_TIMEOUT) {
        active++;
      } else {
        expiring++;
      }
    }

    return {
      total: this.sessions.size,
      active,
      expiring,
      timeout: IDLE_TIMEOUT / 60000 // in minutes
    };
  }
}

// Singleton instance
const sessionStore = new SessionStore();

/**
 * Session timeout middleware
 * Checks if user session has been idle too long
 */
const sessionTimeoutMiddleware = async (req, res, next) => {
  // Skip if no authenticated user
  if (!req.caregiver || !req.caregiver._id) {
    return next();
  }

  const userId = req.caregiver._id.toString();
  const now = Date.now();
  const lastActivity = sessionStore.getLastActivity(userId);

  // First request from this user - set activity and continue
  if (!lastActivity) {
    sessionStore.setLastActivity(userId, now);
    return next();
  }

  // Calculate idle time
  const idleTime = now - lastActivity;

  // Session expired due to inactivity
  if (idleTime > IDLE_TIMEOUT) {
    logger.warn(`[SESSION] Session expired for user ${userId} after ${Math.round(idleTime / 60000)} minutes idle`);

    // Create audit log for session timeout
    try {
      await createManualAuditLog({
        timestamp: new Date(),
        userId: req.caregiver._id,
        userRole: req.caregiver.role,
        action: 'SESSION_TIMEOUT',
        resource: 'session',
        resourceId: userId,
        outcome: 'SUCCESS',
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        metadata: {
          idleMinutes: Math.round(idleTime / 60000).toString()
        },
        complianceFlags: {
          phiAccessed: false,
          highRiskAction: false,
          requiresReview: false
        }
      });
    } catch (auditError) {
      logger.error('[SESSION] Failed to create audit log for session timeout:', auditError);
    }

    // Remove session
    sessionStore.removeSession(userId);

    // Return 401 Unauthorized with specific message
    return res.status(401).json({
      code: 401,
      message: 'Session expired due to inactivity',
      reason: 'IDLE_TIMEOUT',
      idleMinutes: Math.round(idleTime / 60000),
      maxIdleMinutes: IDLE_TIMEOUT / 60000
    });
  }

  // Session is still valid - update last activity
  sessionStore.setLastActivity(userId, now);

  next();
};

/**
 * Manually expire a user's session
 * Used for logout or security events
 */
const expireSession = (userId) => {
  sessionStore.removeSession(userId);
  logger.info(`[SESSION] Manually expired session for user: ${userId}`);
};

/**
 * Get active sessions count (for monitoring)
 */
const getActiveSessions = () => {
  return sessionStore.getStats();
};

/**
 * Check if session is active
 */
const isSessionActive = (userId) => {
  const lastActivity = sessionStore.getLastActivity(userId);
  if (!lastActivity) return false;
  
  const idleTime = Date.now() - lastActivity;
  return idleTime < IDLE_TIMEOUT;
};

// Export for use in logout handler
const logoutSession = async (userId, ipAddress, userAgent) => {
  sessionStore.removeSession(userId);
  
  // Create audit log
  try {
    // Fetch user to get their role
    const user = await Caregiver.findById(userId).select('role');
    const userRole = user ? user.role : 'staff'; // Default to staff if user not found
    
    await createManualAuditLog({
      timestamp: new Date(),
      userId,
      userRole,
      action: 'LOGOUT',
      resource: 'session',
      resourceId: userId,
      outcome: 'SUCCESS',
      ipAddress,
      userAgent,
      complianceFlags: {
        phiAccessed: false,
        highRiskAction: false,
        requiresReview: false
      }
    });
  } catch (auditError) {
    logger.error('[SESSION] Failed to create audit log for logout:', auditError);
  }
  
  logger.info(`[SESSION] User logged out: ${userId}`);
};

// Log configuration on startup
logger.info(`[SESSION] Session timeout configured: ${IDLE_TIMEOUT / 60000} minutes idle timeout`);
logger.info(`[SESSION] Using in-memory session store. For production clusters, use Redis.`);

module.exports = {
  sessionTimeoutMiddleware,
  expireSession,
  logoutSession,
  getActiveSessions,
  isSessionActive,
  IDLE_TIMEOUT
};

