// src/services/emergencyProcessor.service.js

const { detectEmergency, filterFalsePositives } = require('../utils/emergencyDetector');
const { localizedEmergencyDetector } = require('./localizedEmergencyDetector.service');
const emergencyEmbeddingPipeline = require('./emergencyEmbeddingPipeline.service');
const { getAlertDeduplicator } = require('../utils/alertDeduplicator');
const { getConversationContextWindow } = require('../utils/conversationContextWindow');
const { useKeywordBasedDetectors } = require('../utils/detectionMode');
const { config } = require('../config/emergency.config');
const appConfig = require('../config/config');
const { snsService } = require('./sns.service');
const alertService = require('./alert.service');
const mongoose = require('mongoose');
const { Client, Caregiver } = require('../models');
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
          if (process.env.NODE_ENV === 'test') {
            logger.debug('SNS service connectivity test failed, push notifications may not work');
          } else {
            logger.warn('SNS service connectivity test failed, push notifications may not work');
          }
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
   * @param {string} clientId - Client ID
   * @param {string} text - Patient utterance text
   * @param {number} timestamp - Timestamp of utterance (defaults to now)
   * @returns {Promise<Object>} - Processing result
   */
  async processUtterance(clientId, text, timestamp = Date.now(), conversationId = null) {
    try {
      // Validate inputs
      if (!clientId || !text) {
        return this.createErrorResponse('Invalid input: clientId and text are required');
      }

      if (typeof text !== 'string' || text.trim().length === 0) {
        return this.createErrorResponse('Invalid input: text must be a non-empty string');
      }

      // Get client information to determine language
      let clientLanguage = 'en'; // Default to English
      try {
        const client = await Client.findById(clientId).select('preferredLanguage');
        if (client && client.preferredLanguage) {
          clientLanguage = client.preferredLanguage;
        }
      } catch (error) {
        logger.warn(`Could not fetch client language for ${clientId}, using default: ${error.message}`);
      }

      // Step 0: Add utterance to context window for context-aware processing
      const contextWindow = getConversationContextWindow();
      contextWindow.addUtterance(clientId, text, 'user', timestamp);

      // Step 1: Optional embedding + LLM tense pipeline (off in Jest unless FORCE_EMBEDDING_PIPELINE=true)
      const useEmbeddingPipeline =
        appConfig.openai?.apiKey &&
        (process.env.NODE_ENV !== 'test' || process.env.FORCE_EMBEDDING_PIPELINE === 'true');

      let emergencyResult = null;
      /** When true, embedding + tense pipeline confirmed emergency — skip keyword false-positive filters */
      let embeddingPipelinePositive = false;
      if (useEmbeddingPipeline) {
        try {
          const pipeline = await emergencyEmbeddingPipeline.evaluateEmergencyEmbedding(text);
          if (pipeline.evaluated) {
            if (pipeline.isEmergency) {
              embeddingPipelinePositive = true;
              emergencyResult = {
                isEmergency: true,
                severity: pipeline.severity,
                matchedPhrase: pipeline.matchedPhrase,
                category: pipeline.category,
                language: clientLanguage,
              };
            } else {
              // Includes empty buckets: embedding ran and did not match; do not fall through to
              // phrase/regex match unless USE_KEYWORD_BASED_DETECTORS is enabled.
              emergencyResult = {
                isEmergency: false,
                severity: null,
                matchedPhrase: null,
                category: null,
                language: clientLanguage,
              };
            }
          }
        } catch (pipeErr) {
          logger.warn(`[Emergency] Embedding pipeline error, falling back: ${pipeErr.message}`);
        }
      }

      // When embeddings are off or failed, or keyword path is off: explicit non-emergency
      if (!emergencyResult && !useKeywordBasedDetectors()) {
        emergencyResult = {
          isEmergency: false,
          severity: null,
          matchedPhrase: null,
          category: null,
          language: clientLanguage,
        };
      }

      // Step 1b: Phrase/DB and basic regex (feature-flagged) when pipeline did not set a result
      if (!emergencyResult && useKeywordBasedDetectors()) {
        emergencyResult = await localizedEmergencyDetector.detectEmergency(text, clientLanguage);
      }
      
      // CRITICAL FIX: Fallback to basic detector if localized detector has no phrases
      // This ensures emergencies are detected even if database phrases aren't loaded
      if (!emergencyResult.isEmergency && !emergencyResult.error && emergencyResult.fallbackNeeded) {
        logger.warn(`[Emergency Detection] No phrases found for language ${clientLanguage}, falling back to basic detector`);
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
            language: clientLanguage
          };
        } else {
          logger.debug(`[Emergency Detection] Basic detector also found no emergency for: "${text.substring(0, 50)}"`);
        }
      }

      // Generic ultra-short "Help me" without other context — avoid false Request-tier alerts (corpus EDGE-003)
      const strippedForShort = text.replace(/^Client:\s*/i, '').trim();
      if (
        emergencyResult.isEmergency &&
        emergencyResult.category === 'Request' &&
        /^(help me|i need help)([!.\s]|$)/i.test(strippedForShort) &&
        strippedForShort.split(/\s+/).filter(Boolean).length <= 3
      ) {
        emergencyResult = {
          isEmergency: false,
          severity: null,
          matchedPhrase: null,
          category: null,
          language: clientLanguage,
        };
      }

      if (config.logging.logAllDetections) {
        logger.info(`[Emergency Detection] Processing utterance for emergency detection`, {
          clientId,
          text: text.substring(0, 100),
          language: clientLanguage,
          result: emergencyResult
        });
      }

      // Step 2: Context-aware false positive filtering
      let falsePositiveResult = { isFalsePositive: false, reason: null };
      if (config.enableFalsePositiveFilter && emergencyResult.isEmergency && !embeddingPipelinePositive) {
        // First, check basic false positives (skipped when embedding pipeline already validated)
        falsePositiveResult = filterFalsePositives(text, emergencyResult);
        
        // If not a basic false positive, check context window for narrative vs present-tense
        // NOTE: We err on the side of sending alerts - only filter if VERY confident it's narrative
        if (!falsePositiveResult.isFalsePositive && config.enableContextAwareFiltering !== false) {
          const narrativeClassification = contextWindow.classifyNarrativeVsPresent(clientId, text);
          
          // Only filter if VERY high confidence (>0.85) that it's narrative (past story)
          // This ensures we send alerts even for ambiguous cases
          if (narrativeClassification.isNarrative && narrativeClassification.confidence > 0.85) {
            falsePositiveResult = {
              isFalsePositive: true,
              reason: `Narrative context detected: ${narrativeClassification.reason}`
            };
            
            if (config.logging.logFalsePositives) {
              logger.info(`Context-aware false positive for client ${clientId}: ${falsePositiveResult.reason}`);
            }
          } else if (config.logging.logAllDetections) {
            logger.debug(`Context classification for client ${clientId}: ${narrativeClassification.reason} (confidence: ${narrativeClassification.confidence.toFixed(2)})`);
          }
        }
        
        if (config.logging.logFalsePositives && falsePositiveResult.isFalsePositive) {
          logger.info(`False positive detected for client ${clientId}: ${falsePositiveResult.reason}`);
        }
      }

      // Step 3: Check deduplication with enhanced multi-signal support
      let deduplicationResult = { shouldAlert: true, reason: 'No deduplication check performed' };
      if (emergencyResult.isEmergency && !falsePositiveResult.isFalsePositive) {
        deduplicationResult = getAlertDeduplicator().shouldAlert(
          clientId, 
          emergencyResult.category, 
          text, 
          timestamp,
          {
            severity: emergencyResult.severity,
            contextWindow: contextWindow.getRecentContext(clientId, 5) // Last 5 minutes
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
        const alertRecord = deduplicator.recordAlert(clientId, emergencyResult.category, timestamp, text);
        if (alertRecord) {
          alertRecord.severity = emergencyResult.severity;
        }
      }

      const detectionSource = embeddingPipelinePositive ? 'embedding_pipeline' : 'phrase_match';

      // Step 7: Create response
      const response = {
        shouldAlert,
        alertData,
        severity: alertData?.severity ?? null,
        category: emergencyResult?.category ?? null,
        reason: this.getReason(emergencyResult, falsePositiveResult, deduplicationResult),
        detectionSource,
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
          clientId,
          shouldAlert,
          reason: response.reason,
          severity: alertData?.severity,
          category: alertData?.category,
          processing: response.processing
        });
      }

      if (shouldAlert) {
        try {
          const { writeUrgentFact } = require('./clientMemory.service');
          const factText = `Emergency/safety signal detected during call: "${text.substring(0, 200)}"`;
          await writeUrgentFact(clientId, factText, conversationId || null);
        } catch (memErr) {
          logger.warn(`[Emergency] Failed to write urgent memory fact: ${memErr.message}`);
        }
      }

      return response;
    } catch (error) {
      logger.error('Error processing utterance:', error);
      return this.createErrorResponse(`Processing error: ${error.message}`);
    }
  }

  /**
   * Suggested staff next steps (US-7); labelKey is for app i18n.
   * @param {string} severity
   * @param {string} [category]
   */
  buildRecommendedActions(severity, category) {
    const actions = [
      { id: 'review_conversation', labelKey: 'alertActions.reviewConversation', actionType: 'review_conversation' },
      { id: 'notify_team', labelKey: 'alertActions.notifyCareTeam', actionType: 'notify_care_team' },
      { id: 'document', labelKey: 'alertActions.documentInRecord', actionType: 'document' },
    ];
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      actions.unshift({
        id: 'emergency_services',
        labelKey: 'alertActions.callEmergencyServices',
        actionType: 'call_emergency',
      });
    }
    const cat = (category || '').toLowerCase();
    if (cat.includes('financial') || cat.includes('fraud') || cat.includes('abuse')) {
      actions.push({
        id: 'review_risk_report',
        labelKey: 'alertActions.openRiskReport',
        actionType: 'open_fraud_report',
      });
    }
    return actions;
  }

  /**
   * Create an alert in the system
   * @param {string} clientId - Client ID
   * @param {Object} alertData - Alert data from processUtterance
   * @param {string} originalText - Original client utterance
   * @param {Object} [meta] - Optional: conversationId, detectionSource (US-3)
   * @returns {Promise<Object>} - Alert creation result
   */
  async createAlert(clientId, alertData, originalText, meta = {}) {
    try {
      // Validate client ID to avoid CastError and noisy logs in tests
      if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
        return { success: false, error: 'Invalid client ID' };
      }
      // Get client information
      const client = await Client.findById(clientId);
      if (!client) {
        return { success: false, error: 'Client not found' };
      }

      // Create alert message (stored in English, will be translated when fetched)
      const alertMessage = this.createAlertMessage(client, alertData, originalText);

      const convId =
        meta.conversationId && mongoose.Types.ObjectId.isValid(meta.conversationId)
          ? new mongoose.Types.ObjectId(meta.conversationId)
          : null;

      const snippet =
        originalText.length > 400 ? `${originalText.substring(0, 400)}…` : originalText;

      const messageIds = [];
      if (meta.messageId && mongoose.Types.ObjectId.isValid(meta.messageId)) {
        messageIds.push(new mongoose.Types.ObjectId(meta.messageId));
      }
      if (Array.isArray(meta.messageIds)) {
        for (const id of meta.messageIds) {
          if (id && mongoose.Types.ObjectId.isValid(id)) {
            const oid = new mongoose.Types.ObjectId(id);
            if (!messageIds.some((x) => x.equals(oid))) messageIds.push(oid);
          }
        }
      }

      const alertRecord = {
        message: alertMessage,
        importance: this.mapSeverityToImportance(alertData.severity),
        alertType: convId ? 'conversation' : 'client',
        relatedClient: clientId,
        ...(convId ? { relatedConversation: convId } : {}),
        createdBy: clientId,
        createdModel: 'Client',
        visibility: 'assignedCaregivers',
        relevanceUntil: new Date(Date.now() + (alertData.responseTimeSeconds * 1000)),
        evidence: {
          snippet,
          ...(convId ? { conversationId: convId } : {}),
          ...(messageIds.length ? { messageIds } : {}),
          detector: meta.detectionSource || 'phrase_match',
          confidence: typeof alertData.confidence === 'number' ? alertData.confidence : undefined,
          language: client.preferredLanguage || 'en',
        },
        recommendedActions: this.buildRecommendedActions(alertData.severity, alertData.category),
      };

      const alert = await alertService.createAlert(alertRecord);

      // Send push notifications if enabled
      let notificationResult = null;
      logger.info(`[Emergency Processor] Checking SMS notifications - enableSNSPushNotifications: ${config.enableSNSPushNotifications}`);
      
      if (config.enableSNSPushNotifications) {
        const caregivers = await this.getClientCaregivers(clientId);
        logger.info(`[Emergency Processor] Found ${caregivers.length} caregiver(s) with phone numbers for client ${clientId}`);
        
        if (caregivers.length === 0) {
          logger.warn(`[Emergency Processor] No caregivers with phone numbers found for client ${clientId} - SMS will not be sent`);
        } else {
          logger.info(`[Emergency Processor] Sending emergency SMS alerts to ${caregivers.length} caregiver(s)`);
          notificationResult = await snsService.sendEmergencyAlert(
            {
              clientId,
              clientName: client.name || client.preferredName || 'Unknown Client',
              severity: alertData.severity,
              category: alertData.category,
              phrase: alertData.phrase
            },
            caregivers
          );
          logger.info(`[Emergency Processor] SMS notification result:`, notificationResult);
        }
      } else {
        logger.warn(`[Emergency Processor] SMS notifications are DISABLED in config - no SMS will be sent`);
        logger.warn(`[Emergency Processor] To enable, set NODE_ENV=staging/production or set AWS_REGION env var`);
      }

      return {
        success: true,
        alert,
        notificationResult,
        client: {
          id: clientId,
          name: client.name,
          preferredName: client.preferredName
        }
      };
    } catch (error) {
      logger.error('Error creating alert:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get caregivers assigned to a client
   * @private
   */
  async getClientCaregivers(clientId) {
    try {
      const client = await Client.findById(clientId).populate('caregivers');
      if (!client || !client.caregivers) {
        return [];
      }

      return client.caregivers.filter(caregiver => caregiver && caregiver.phone);
    } catch (error) {
      logger.error('Error getting client caregivers:', error);
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
  createAlertMessage(client, alertData, originalText) {
    const clientName = client.preferredName || client.name || 'Client';
    const urgency = this.getUrgencyText(alertData.severity);
    
    return `${urgency} ${alertData.category} Emergency: ${clientName} reported "${alertData.phrase}". ` +
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
      detectionSource: null,
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
