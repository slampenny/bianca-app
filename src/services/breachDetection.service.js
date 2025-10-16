/**
 * Breach Detection Service
 * 
 * HIPAA Requirements:
 * - §164.308(a)(6) - Security Incident Procedures
 * - §164.404 - Notification to Individuals (within 60 days)
 * - §164.408 - Notification to the Secretary
 * 
 * Detects and responds to potential security breaches
 */

const logger = require('../config/logger');
const { AuditLog, BreachLog, Caregiver } = require('../models');

// Detection thresholds
const DETECTION_RULES = {
  failed_logins: {
    threshold: 5,
    window: 300000, // 5 minutes
    severity: 'HIGH'
  },
  data_access_volume: {
    threshold: 100,
    window: 3600000, // 1 hour
    severity: 'CRITICAL'
  },
  off_hours: {
    hours: [22, 23, 0, 1, 2, 3, 4, 5], // 10 PM - 6 AM
    severity: 'MEDIUM'
  },
  rapid_data_access: {
    threshold: 20,
    window: 60000, // 1 minute
    severity: 'CRITICAL'
  }
};

class BreachDetectionService {
  /**
   * Detect excessive failed login attempts
   * Rule: More than 5 failed logins in 5 minutes
   */
  async detectFailedLogins() {
    const windowStart = new Date(Date.now() - DETECTION_RULES.failed_logins.window);
    
    try {
      const recentFailures = await AuditLog.aggregate([
        {
          $match: {
            action: { $in: ['LOGIN_FAILED', 'MFA_VERIFICATION_FAILED'] },
            outcome: 'FAILURE',
            timestamp: { $gte: windowStart }
          }
        },
        {
          $group: {
            _id: {
              userId: '$userId',
              ipAddress: '$ipAddress'
            },
            count: { $sum: 1 },
            attempts: { $push: '$$ROOT' },
            lastAttempt: { $max: '$timestamp' }
          }
        },
        {
          $match: {
            count: { $gte: DETECTION_RULES.failed_logins.threshold }
          }
        }
      ]);

      for (const failure of recentFailures) {
        await this.createBreachAlert({
          type: 'excessive_failed_logins',
          severity: DETECTION_RULES.failed_logins.severity,
          userId: failure._id.userId,
          ipAddress: failure._id.ipAddress,
          details: `${failure.count} failed login attempts in 5 minutes`,
          evidence: failure.attempts,
          autoLock: true // Automatically lock account
        });
      }

      return recentFailures.length;
    } catch (error) {
      logger.error('[BREACH] Failed to detect failed logins:', error);
      return 0;
    }
  }

  /**
   * Detect unusual data access volume
   * Rule: More than 100 patient records accessed in 1 hour
   */
  async detectDataAccessVolume() {
    const windowStart = new Date(Date.now() - DETECTION_RULES.data_access_volume.window);
    
    try {
      const volumeAnalysis = await AuditLog.aggregate([
        {
          $match: {
            action: 'READ',
            resource: { $in: ['patient', 'conversation', 'medicalAnalysis'] },
            timestamp: { $gte: windowStart },
            outcome: 'SUCCESS'
          }
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
            resources: { $addToSet: '$resourceId' },
            lastAccess: { $max: '$timestamp' }
          }
        },
        {
          $match: {
            count: { $gte: DETECTION_RULES.data_access_volume.threshold }
          }
        }
      ]);

      for (const access of volumeAnalysis) {
        await this.createBreachAlert({
          type: 'unusual_data_access_volume',
          severity: DETECTION_RULES.data_access_volume.severity,
          userId: access._id,
          details: `${access.count} records accessed in 1 hour (normal: <100)`,
          evidence: {
            count: access.count,
            uniqueResources: access.resources.length,
            lastAccess: access.lastAccess
          },
          affectedResourceIds: access.resources.slice(0, 100), // Limit to first 100
          affectedCount: access.resources.length,
          autoLock: true
        });
      }

      return volumeAnalysis.length;
    } catch (error) {
      logger.error('[BREACH] Failed to detect data access volume:', error);
      return 0;
    }
  }

  /**
   * Detect off-hours access to sensitive data
   * Rule: Access to PHI between 10 PM and 6 AM
   */
  async detectOffHoursAccess() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Only check during off-hours
    if (!DETECTION_RULES.off_hours.hours.includes(currentHour)) {
      return 0;
    }

    const last10Minutes = new Date(Date.now() - 600000);
    
    try {
      const offHoursAccess = await AuditLog.find({
        action: { $in: ['READ', 'UPDATE', 'DELETE'] },
        resource: { $in: ['patient', 'conversation', 'medicalAnalysis'] },
        timestamp: { $gte: last10Minutes },
        outcome: 'SUCCESS',
        'complianceFlags.phiAccessed': true
      }).populate('userId', 'name email role');

      for (const access of offHoursAccess) {
        // Check if this is a known issue (already logged)
        const existingBreach = await BreachLog.findOne({
          type: 'off_hours_access',
          userId: access.userId,
          detectedAt: { $gte: last10Minutes },
          status: { $in: ['INVESTIGATING', 'CONFIRMED'] }
        });

        if (!existingBreach) {
          await this.createBreachAlert({
            type: 'off_hours_access',
            severity: DETECTION_RULES.off_hours.severity,
            userId: access.userId?._id,
            ipAddress: access.ipAddress,
            details: `Off-hours access to ${access.resource} at ${currentHour}:00`,
            evidence: [access],
            affectedResourceType: access.resource,
            affectedResourceIds: [access.resourceId],
            autoLock: false // Don't auto-lock for off-hours (might be legitimate)
          });
        }
      }

      return offHoursAccess.length;
    } catch (error) {
      logger.error('[BREACH] Failed to detect off-hours access:', error);
      return 0;
    }
  }

  /**
   * Detect rapid data access (potential data exfiltration)
   * Rule: More than 20 records accessed in 1 minute
   */
  async detectRapidDataAccess() {
    const windowStart = new Date(Date.now() - DETECTION_RULES.rapid_data_access.window);
    
    try {
      const rapidAccess = await AuditLog.aggregate([
        {
          $match: {
            action: 'READ',
            resource: { $in: ['patient', 'conversation'] },
            timestamp: { $gte: windowStart },
            outcome: 'SUCCESS'
          }
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
            resources: { $addToSet: '$resourceId' }
          }
        },
        {
          $match: {
            count: { $gte: DETECTION_RULES.rapid_data_access.threshold }
          }
        }
      ]);

      for (const access of rapidAccess) {
        await this.createBreachAlert({
          type: 'data_exfiltration_attempt',
          severity: DETECTION_RULES.rapid_data_access.severity,
          userId: access._id,
          details: `${access.count} records accessed in 1 minute (possible data exfiltration)`,
          evidence: {
            count: access.count,
            uniqueResources: access.resources.length
          },
          affectedResourceIds: access.resources,
          affectedCount: access.resources.length,
          autoLock: true
        });
      }

      return rapidAccess.length;
    } catch (error) {
      logger.error('[BREACH] Failed to detect rapid data access:', error);
      return 0;
    }
  }

  /**
   * Create a breach alert
   */
  async createBreachAlert(data) {
    try {
      // Check if similar breach already exists (within last hour)
      const recentBreach = await BreachLog.findOne({
        type: data.type,
        userId: data.userId,
        detectedAt: { $gte: new Date(Date.now() - 3600000) },
        status: { $in: ['INVESTIGATING', 'CONFIRMED'] }
      });

      if (recentBreach) {
        logger.info(`[BREACH] Similar breach already logged: ${recentBreach._id}`);
        return recentBreach;
      }

      // Create breach log
      const breach = await BreachLog.create({
        type: data.type,
        severity: data.severity,
        userId: data.userId,
        ipAddress: data.ipAddress,
        details: data.details,
        evidence: JSON.stringify(data.evidence),
        affectedResourceType: data.affectedResourceType || 'system',
        affectedResourceIds: data.affectedResourceIds || [],
        affectedCount: data.affectedCount || 0,
        status: 'INVESTIGATING',
        // detectedAt will use default (Date.now) from model
        // HIPAA requires notification within 60 days
        notificationDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
      });

      logger.warn(`[BREACH] Alert created: ${breach._id} - ${data.type} - ${data.severity}`);

      // Send notification to security team
      await this.notifySecurityTeam(breach);

      // Auto-lock account if critical
      if (data.autoLock && data.userId) {
        await this.lockAccount(data.userId, `Automatic lock due to: ${data.type}`);
      }

      return breach;
    } catch (error) {
      logger.error('[BREACH] Failed to create breach alert:', error);
      throw error;
    }
  }

  /**
   * Lock a user account
   */
  async lockAccount(userId, reason) {
    try {
      await Caregiver.findByIdAndUpdate(userId, {
        accountLocked: true,
        lockedReason: reason,
        lockedAt: new Date()
      });

      logger.warn(`[BREACH] Account locked: ${userId} - ${reason}`);

      // Create audit log
      await AuditLog.create({
        timestamp: new Date(),
        userId: userId,
        userRole: 'system',
        action: 'ACCOUNT_LOCKED',
        resource: 'caregiver',
        resourceId: userId,
        outcome: 'SUCCESS',
        ipAddress: 'internal',
        metadata: {
          reason
        },
        complianceFlags: {
          phiAccessed: false,
          highRiskAction: true,
          requiresReview: true
        }
      });
    } catch (error) {
      logger.error(`[BREACH] Failed to lock account ${userId}:`, error);
    }
  }

  /**
   * Notify security team via email/SNS
   */
  async notifySecurityTeam(breach) {
    try {
      // TODO: Integrate with SNS or email service
      logger.warn(`[BREACH] 🚨 SECURITY ALERT 🚨`);
      logger.warn(`[BREACH] Type: ${breach.type}`);
      logger.warn(`[BREACH] Severity: ${breach.severity}`);
      logger.warn(`[BREACH] Details: ${breach.details}`);
      logger.warn(`[BREACH] Breach ID: ${breach._id}`);

      // If AWS SNS is configured, send notification
      if (process.env.SECURITY_ALERT_TOPIC_ARN) {
        const { SNS } = require('@aws-sdk/client-sns');
        const sns = new SNS({ region: process.env.AWS_REGION || 'us-east-2' });

      await sns.publish({
          TopicArn: process.env.SECURITY_ALERT_TOPIC_ARN,
          Subject: `🚨 HIPAA Breach Alert: ${breach.type}`,
          Message: JSON.stringify({
            severity: breach.severity,
            type: breach.type,
            details: breach.details,
            breachId: breach._id.toString(),
            userId: breach.userId?.toString(),
            timestamp: breach.detectedAt.toISOString(),
            actionRequired: 'Investigate immediately'
          }, null, 2)
        });
      }
    } catch (error) {
      logger.error('[BREACH] Failed to notify security team:', error);
    }
  }

  /**
   * Run all detection checks
   */
  async runAllDetections() {
    logger.info('[BREACH] Running breach detection checks...');

    const results = {
      failedLogins: await this.detectFailedLogins(),
      dataAccessVolume: await this.detectDataAccessVolume(),
      offHoursAccess: await this.detectOffHoursAccess(),
      rapidDataAccess: await this.detectRapidDataAccess(),
      timestamp: new Date()
    };

    const total = results.failedLogins + results.dataAccessVolume + 
                  results.offHoursAccess + results.rapidDataAccess;

    if (total > 0) {
      logger.warn(`[BREACH] Detection summary: ${total} potential breaches detected`);
    } else {
      logger.info('[BREACH] No breaches detected');
    }

    return results;
  }

  /**
   * Get breach statistics
   */
  async getBreachStatistics(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return BreachLog.getStatistics(since, new Date());
  }
}

// Singleton instance
const breachDetectionService = new BreachDetectionService();

// Start periodic detection (every 5 minutes)
const DETECTION_INTERVAL = parseInt(process.env.BREACH_DETECTION_INTERVAL || '300000'); // 5 minutes

if (process.env.NODE_ENV !== 'test') {
  logger.info(`[BREACH] Starting breach detection service (interval: ${DETECTION_INTERVAL / 1000}s)`);
  
  setInterval(async () => {
    try {
      await breachDetectionService.runAllDetections();
    } catch (error) {
      logger.error('[BREACH] Detection cycle failed:', error);
    }
  }, DETECTION_INTERVAL);
}

module.exports = breachDetectionService;
