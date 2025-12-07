// src/services/emergencyProcessor.service.js

const { detectEmergency, filterFalsePositives } = require('../utils/emergencyDetector');
const { localizedEmergencyDetector } = require('./localizedEmergencyDetector.service');
const { getAlertDeduplicator } = require('../utils/alertDeduplicator');
const { getConversationContextWindow } = require('../utils/conversationContextWindow');
const { config } = require('../config/emergency.config');
const { snsService } = require('./sns.service');
const alertService = require('./alert.service');
const { Patient, Caregiver } = require('../models');
const logger = require('../config/logger');

/**
 * Main Emergency Processing Pipeline
 * Combines all components to process patient utterances and create alerts
 */
class EmergencyProcessor {
  constructor() {
    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize the emergency processor
   */
  async initialize() {
    try {
      // Test SNS connectivity if enabled
      if (config.enableSNSPushNotifications && snsService && typeof snsService.testConnectivity === 'function') {
        const snsWorking = await snsService.testConnectivity();
        if (snsWorking) {
          logger.info('SNS service connectivity verified');
        } else {
          logger.warn('SNS service connectivity test failed, push notifications may not work');
        }
      }

      this.isInitialized = true;
      logger.info('Emergency processor initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize emergency processor:', error);
      // Don't throw - allow service to continue without full initialization
    }
  }

  /**
   * Process a patient utterance for emergency detection
   * @param {string} patientId - Patient ID
   * @param {string} text - Patient utterance text
   * @param {number} timestamp - Timestamp of utterance (defaults to now)
   * @returns {Promise<Object>} - Processing result
   */
  async processUtterance(patientId, text, timestamp = Date.now()) {
    try {
      // Validate inputs
      if (!patientId || !text) {
        return this.createErrorResponse('Invalid input: patientId and text are required');
      }

      if (typeof text !== 'string' || text.trim().length === 0) {
        return this.createErrorResponse('Invalid input: text must be a non-empty string');
      }

      // Get patient information to determine language
      let patientLanguage = 'en'; // Default to English
      try {
        const patient = await Patient.findById(patientId).select('preferredLanguage');
        if (patient && patient.preferredLanguage) {
          patientLanguage = patient.preferredLanguage;
        }
      } catch (error) {
        logger.warn(`Could not fetch patient language for ${patientId}, using default: ${error.message}`);
      }

      // Step 0: Add utterance to context window for context-aware processing
      const contextWindow = getConversationContextWindow();
      contextWindow.addUtterance(patientId, text, 'user', timestamp);

      // Step 1: Detect emergency patterns using localized detector
      let emergencyResult = await localizedEmergencyDetector.detectEmergency(text, patientLanguage);
      
      // CRITICAL FIX: Fallback to basic detector if localized detector has no phrases
      // This ensures emergencies are detected even if database phrases aren't loaded
      if (!emergencyResult.isEmergency && !emergencyResult.error && emergencyResult.fallbackNeeded) {
        logger.warn(`[Emergency Detection] No phrases found for language ${patientLanguage}, falling back to basic detector`);
        // Fallback to basic emergency detector
        const basicDetector = require('../utils/emergencyDetector');
        const basicResult = basicDetector.detectEmergency(text);
        if (basicResult.isEmergency) {
          logger.info(`[Emergency Detection] ✅ Basic detector found emergency: ${basicResult.matchedPhrase} (${basicResult.severity} ${basicResult.category})`);
          // Convert basic detector result to match localized detector format
          emergencyResult = {
            isEmergency: true,
            severity: basicResult.severity,
            matchedPhrase: basicResult.matchedPhrase,
            phrase: basicResult.matchedPhrase,
            category: basicResult.category,
            language: patientLanguage
          };
        } else {
          logger.debug(`[Emergency Detection] Basic detector also found no emergency for: "${text.substring(0, 50)}"`);
        }
      }
      
      if (config.logging.logAllDetections) {
        logger.info(`[Emergency Detection] Processing utterance for emergency detection`, {
          patientId,
          text: text.substring(0, 100),
          language: patientLanguage,
          result: emergencyResult
        });
      }

      // Step 2: Context-aware false positive filtering
      let falsePositiveResult = { isFalsePositive: false, reason: null };
      if (config.enableFalsePositiveFilter && emergencyResult.isEmergency) {
        // First, check basic false positives
        falsePositiveResult = filterFalsePositives(text, emergencyResult);
        
        // If not a basic false positive, check context window for narrative vs present-tense
        // NOTE: We err on the side of sending alerts - only filter if VERY confident it's narrative
        if (!falsePositiveResult.isFalsePositive && config.enableContextAwareFiltering !== false) {
          const narrativeClassification = contextWindow.classifyNarrativeVsPresent(patientId, text);
          
          // Only filter if VERY high confidence (>0.85) that it's narrative (past story)
          // This ensures we send alerts even for ambiguous cases
          if (narrativeClassification.isNarrative && narrativeClassification.confidence > 0.85) {
            falsePositiveResult = {
              isFalsePositive: true,
              reason: `Narrative context detected: ${narrativeClassification.reason}`
            };
            
            if (config.logging.logFalsePositives) {
              logger.info(`Context-aware false positive for patient ${patientId}: ${falsePositiveResult.reason}`);
            }
          } else if (config.logging.logAllDetections) {
            logger.debug(`Context classification for patient ${patientId}: ${narrativeClassification.reason} (confidence: ${narrativeClassification.confidence.toFixed(2)})`);
          }
        }
        
        if (config.logging.logFalsePositives && falsePositiveResult.isFalsePositive) {
          logger.info(`False positive detected for patient ${patientId}: ${falsePositiveResult.reason}`);
        }
      }

      // Step 3: Check deduplication with enhanced multi-signal support
      let deduplicationResult = { shouldAlert: true, reason: 'No deduplication check performed' };
      if (emergencyResult.isEmergency && !falsePositiveResult.isFalsePositive) {
        deduplicationResult = getAlertDeduplicator().shouldAlert(
          patientId, 
          emergencyResult.category, 
          text, 
          timestamp,
          {
            severity: emergencyResult.severity,
            contextWindow: contextWindow.getRecentContext(patientId, 5) // Last 5 minutes
          }
        );
      }

      // Step 4: Determine if we should alert
      const shouldAlert = emergencyResult.isEmergency && 
                         !falsePositiveResult.isFalsePositive && 
                         deduplicationResult.shouldAlert;

      // Step 5: Calculate confidence score
      const confidence = this.calculateConfidence(emergencyResult, falsePositiveResult);

      // Step 6: Create alert data if we should alert
      let alertData = null;
      if (shouldAlert) {
        alertData = {
          severity: emergencyResult.severity,
          category: emergencyResult.category,
          phrase: emergencyResult.matchedPhrase,
          confidence: confidence,
          responseTimeSeconds: config.severityResponseTimes[emergencyResult.severity] || 900
        };

        // Record the alert in deduplicator with severity
        const deduplicator = getAlertDeduplicator();
        const alertRecord = deduplicator.recordAlert(patientId, emergencyResult.category, timestamp, text);
        if (alertRecord) {
          alertRecord.severity = emergencyResult.severity;
        }
      }

      // Step 7: Create response
      const response = {
        shouldAlert,
        alertData,
        reason: this.getReason(emergencyResult, falsePositiveResult, deduplicationResult),
        processing: {
          emergencyDetected: emergencyResult.isEmergency,
          falsePositive: falsePositiveResult.isFalsePositive,
          deduplicationPassed: deduplicationResult.shouldAlert,
          confidence: confidence
        }
      };

      // Step 8: Log alert decision
      if (config.logging.logAlertDecisions || shouldAlert) {
        logger.info(`[Emergency Detection] Emergency detection result - shouldAlert: ${shouldAlert}`, {
          patientId,
          shouldAlert,
          reason: response.reason,
          severity: alertData?.severity,
          category: alertData?.category,
          processing: response.processing
        });
      }

      return response;
    } catch (error) {
      logger.error('Error processing utterance:', error);
      return this.createErrorResponse(`Processing error: ${error.message}`);
    }
  }

  /**
   * Create an alert in the system
   * @param {string} patientId - Patient ID
   * @param {Object} alertData - Alert data from processUtterance
   * @param {string} originalText - Original patient utterance
   * @returns {Promise<Object>} - Alert creation result
   */
  async createAlert(patientId, alertData, originalText) {
    try {
      // Get patient information
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return { success: false, error: 'Patient not found' };
      }

      // Create alert message (stored in English, will be translated when fetched)
      const alertMessage = this.createAlertMessage(patient, alertData, originalText);

      // Create alert in database
      const alertRecord = {
        message: alertMessage,
        importance: this.mapSeverityToImportance(alertData.severity),
        alertType: 'patient',
        relatedPatient: patientId,
        createdBy: patientId, // Patient created this alert
        createdModel: 'Patient',
        visibility: 'assignedCaregivers',
        relevanceUntil: new Date(Date.now() + (alertData.responseTimeSeconds * 1000))
      };

      const alert = await alertService.createAlert(alertRecord);

      // Send push notifications if enabled
      let notificationResult = null;
      
      // COMPREHENSIVE DIAGNOSTICS: Log all relevant config and environment variables
      logger.info(`[Emergency Processor] ===== SMS NOTIFICATION DIAGNOSTICS =====`);
      logger.info(`[Emergency Processor] NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
      logger.info(`[Emergency Processor] AWS_REGION: ${process.env.AWS_REGION || 'NOT SET'}`);
      logger.info(`[Emergency Processor] enableSNSPushNotifications: ${config.enableSNSPushNotifications}`);
      logger.info(`[Emergency Processor] snsService available: ${!!snsService}`);
      if (snsService) {
        const snsStatus = snsService.getStatus();
        logger.info(`[Emergency Processor] snsService status:`, JSON.stringify(snsStatus, null, 2));
      }
      logger.info(`[Emergency Processor] ==========================================`);
      
      if (config.enableSNSPushNotifications) {
        if (!snsService) {
          logger.error(`[Emergency Processor] ❌ CRITICAL: snsService is not available! SMS cannot be sent.`);
          logger.error(`[Emergency Processor] This is a code issue - snsService should be imported and available.`);
        } else {
          const caregivers = await this.getPatientCaregivers(patientId);
          logger.info(`[Emergency Processor] Found ${caregivers.length} caregiver(s) with phone numbers for patient ${patientId}`);
          
          if (caregivers.length === 0) {
            logger.warn(`[Emergency Processor] ⚠️ No caregivers with phone numbers found for patient ${patientId} - SMS will not be sent`);
            logger.warn(`[Emergency Processor] Patient ID: ${patientId}`);
            // Try to get patient info for debugging
            try {
              const patientDebug = await Patient.findById(patientId).populate('caregivers').select('name preferredName caregivers');
              logger.warn(`[Emergency Processor] Patient debug info:`, {
                name: patientDebug?.name,
                preferredName: patientDebug?.preferredName,
                caregiverCount: patientDebug?.caregivers?.length || 0,
                caregiversWithPhones: patientDebug?.caregivers?.filter(c => c?.phone)?.length || 0,
                caregiverPhones: patientDebug?.caregivers?.map(c => ({ id: c?._id, phone: c?.phone || 'MISSING' })) || []
              });
            } catch (debugErr) {
              logger.error(`[Emergency Processor] Error getting patient debug info: ${debugErr.message}`);
            }
          } else {
            logger.info(`[Emergency Processor] ✅ Sending emergency SMS alerts to ${caregivers.length} caregiver(s)`);
            logger.info(`[Emergency Processor] Caregiver phone numbers:`, caregivers.map(c => ({ id: c._id, phone: c.phone, name: c.name })));
            
            try {
              notificationResult = await snsService.sendEmergencyAlert(
                {
                  patientId,
                  patientName: patient.name || patient.preferredName || 'Unknown Patient',
                  severity: alertData.severity,
                  category: alertData.category,
                  phrase: alertData.phrase
                },
                caregivers
              );
              logger.info(`[Emergency Processor] ✅ SMS notification result:`, JSON.stringify(notificationResult, null, 2));
              
              if (!notificationResult || !notificationResult.success) {
                logger.error(`[Emergency Processor] ❌ SMS notification FAILED!`);
                logger.error(`[Emergency Processor] Result:`, notificationResult);
              } else {
                logger.info(`[Emergency Processor] ✅ SMS sent successfully: ${notificationResult.successful || 0} successful, ${notificationResult.failed || 0} failed`);
              }
            } catch (smsError) {
              logger.error(`[Emergency Processor] ❌ EXCEPTION while sending SMS:`, smsError);
              logger.error(`[Emergency Processor] Error stack:`, smsError.stack);
              notificationResult = { success: false, error: smsError.message };
            }
          }
        }
      } else {
        logger.error(`[Emergency Processor] ❌ CRITICAL ERROR: SMS notifications should ALWAYS be enabled but config.enableSNSPushNotifications = ${config.enableSNSPushNotifications}`);
        logger.error(`[Emergency Processor] This is a configuration error - emergency SMS should never be disabled!`);
      }

      return {
        success: true,
        alert,
        notificationResult,
        patient: {
          id: patientId,
          name: patient.name,
          preferredName: patient.preferredName
        }
      };
    } catch (error) {
      logger.error('Error creating alert:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get caregivers assigned to a patient
   * @private
   */
  async getPatientCaregivers(patientId) {
    try {
      const patient = await Patient.findById(patientId).populate('caregivers');
      if (!patient || !patient.caregivers) {
        return [];
      }

      return patient.caregivers.filter(caregiver => caregiver && caregiver.phone);
    } catch (error) {
      logger.error('Error getting patient caregivers:', error);
      return [];
    }
  }

  /**
   * Calculate confidence score for the alert
   * @private
   */
  calculateConfidence(emergencyResult, falsePositiveResult) {
    if (!emergencyResult.isEmergency) {
      return 0;
    }

    if (falsePositiveResult.isFalsePositive) {
      return 0;
    }

    let confidence = config.confidence.baseConfidence;

    // Apply severity multiplier
    const severityMultiplier = config.confidence.severityMultiplier[emergencyResult.severity] || 1.0;
    confidence *= severityMultiplier;

    // Apply category multiplier
    const categoryMultiplier = config.confidence.categoryMultiplier[emergencyResult.category] || 1.0;
    confidence *= categoryMultiplier;

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Create alert message text
   * @private
   */
  createAlertMessage(patient, alertData, originalText) {
    const patientName = patient.preferredName || patient.name || 'Patient';
    const urgency = this.getUrgencyText(alertData.severity);
    
    return `${urgency} ${alertData.category} Emergency: ${patientName} reported "${alertData.phrase}". ` +
           `Original message: "${originalText.substring(0, 100)}${originalText.length > 100 ? '...' : ''}"`;
  }

  /**
   * Get urgency text based on severity
   * @private
   */
  getUrgencyText(severity) {
    const urgencyMap = {
      CRITICAL: '🚨 CRITICAL',
      HIGH: '⚠️ HIGH PRIORITY',
      MEDIUM: '📢 ALERT'
    };
    return urgencyMap[severity] || '📢 ALERT';
  }

  /**
   * Map severity to alert importance
   * @private
   */
  mapSeverityToImportance(severity) {
    const importanceMap = {
      CRITICAL: 'urgent',
      HIGH: 'high',
      MEDIUM: 'medium'
    };
    return importanceMap[severity] || 'medium';
  }

  /**
   * Get reason for alert decision
   * @private
   */
  getReason(emergencyResult, falsePositiveResult, deduplicationResult) {
    if (!emergencyResult.isEmergency) {
      return 'No emergency patterns detected';
    }

    if (falsePositiveResult.isFalsePositive) {
      return `False positive detected: ${falsePositiveResult.reason}`;
    }

    if (!deduplicationResult.shouldAlert) {
      return `Deduplication blocked: ${deduplicationResult.reason}`;
    }

    return `Emergency detected: ${emergencyResult.severity} ${emergencyResult.category} - ${emergencyResult.matchedPhrase}`;
  }

  /**
   * Create error response
   * @private
   */
  createErrorResponse(message) {
    return {
      shouldAlert: false,
      alertData: null,
      reason: message,
      error: true,
      processing: {
        emergencyDetected: false,
        falsePositive: false,
        deduplicationPassed: false,
        confidence: 0
      }
    };
  }

  /**
   * Get processor status
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      config: {
        enableFalsePositiveFilter: config.enableFalsePositiveFilter,
        enableAlertsAPI: config.enableAlertsAPI,
        enableSNSPushNotifications: config.enableSNSPushNotifications
      },
      snsStatus: snsService.getStatus(),
      deduplicatorStats: getAlertDeduplicator().getStats()
    };
  }
}

// Create singleton instance
const emergencyProcessor = new EmergencyProcessor();

module.exports = {
  EmergencyProcessor,
  emergencyProcessor // Singleton instance
};
