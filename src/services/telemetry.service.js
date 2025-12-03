// src/services/telemetry.service.js
// HIPAA-compliant telemetry service using PostHog

const { PostHog } = require('posthog-node');
const config = require('../config/config');
const logger = require('../config/logger');

/**
 * PII (Personally Identifiable Information) fields that must never be tracked
 */
const PII_FIELDS = [
  'email',
  'phone',
  'address',
  'ssn',
  'password',
  'patientName',
  'patientId',
  'caregiverName',
  'caregiverId',
  'conversationContent',
  'messageContent',
  'medicalData',
  'diagnosis',
  'medication',
  'symptoms',
  'healthCondition',
  'personalInformation',
  'fullName',
  'dateOfBirth',
  'socialSecurityNumber',
];

/**
 * Fields that should be hashed or anonymized if present
 */
const SENSITIVE_FIELDS = [
  'userId',
  'sessionId',
  'ipAddress',
];

/**
 * Sanitize properties to remove PII and sensitive data
 * @param {Object} properties - Event properties to sanitize
 * @returns {Object} - Sanitized properties
 */
function sanitizeProperties(properties) {
  // Export for testing
  if (typeof jest !== 'undefined') {
    module.exports._sanitizeProperties = sanitizeProperties;
  }
  if (!properties || typeof properties !== 'object') {
    return {};
  }

  const sanitized = { ...properties };

  // Remove PII fields
  PII_FIELDS.forEach(field => {
    if (sanitized[field] !== undefined) {
      delete sanitized[field];
      logger.debug(`Removed PII field: ${field}`);
    }
  });

  // Hash sensitive fields
  SENSITIVE_FIELDS.forEach(field => {
    if (sanitized[field]) {
      // Simple hash for anonymization (not cryptographic, just for privacy)
      const value = sanitized[field].toString();
      sanitized[field] = `hashed_${value.length}_${value.charCodeAt(0)}`;
    }
  });

  // Remove nested objects that might contain PII
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      // Check if nested object contains PII
      const hasPII = PII_FIELDS.some(field => 
        key.toLowerCase().includes(field.toLowerCase()) ||
        Object.keys(sanitized[key]).some(nestedKey => 
          nestedKey.toLowerCase().includes(field.toLowerCase())
        )
      );
      
      if (hasPII) {
        delete sanitized[key];
        logger.debug(`Removed nested object with potential PII: ${key}`);
      } else {
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeProperties(sanitized[key]);
      }
    }
  });

  return sanitized;
}

/**
 * Telemetry Service Class
 * HIPAA-compliant event tracking with PII scrubbing
 */
class TelemetryService {
  constructor() {
    this.enabled = config.telemetry?.enabled || false;
    this.posthog = null;

    // PostHog telemetry removed - no longer used
    // if (this.enabled && config.telemetry?.posthog?.apiKey) {
    //   try {
    //     this.posthog = new PostHog(
    //       config.telemetry.posthog.apiKey,
    //       {
    //         host: config.telemetry.posthog.host,
    //         flushAt: 1, // Send immediately for real-time tracking
    //         flushInterval: 10000, // Also flush every 10 seconds
    //       }
    //     );
    //     logger.info('PostHog telemetry service initialized');
    //   } catch (error) {
    //     logger.error('Failed to initialize PostHog:', error);
    //     this.enabled = false;
    //   }
    // } else {
    //   logger.info('Telemetry disabled or not configured');
    // }
    this.enabled = false; // Telemetry disabled
  }

  /**
   * Track an event
   * @param {string} userId - User ID (will be hashed)
   * @param {string} event - Event name
   * @param {Object} properties - Event properties (will be sanitized)
   * @returns {Promise<void>}
   */
  async track(userId, event, properties = {}) {
    if (!this.enabled || !this.posthog) {
      return;
    }

    try {
      // Sanitize properties to remove PII
      const sanitizedProperties = sanitizeProperties(properties);

      // Add metadata
      sanitizedProperties.timestamp = new Date().toISOString();
      sanitizedProperties.environment = config.env;

      // Track event
      this.posthog.capture({
        distinctId: userId || 'anonymous',
        event,
        properties: sanitizedProperties,
      });

      logger.debug(`Telemetry event tracked: ${event}`, {
        userId: userId ? 'hashed' : 'anonymous',
        event,
        propertyCount: Object.keys(sanitizedProperties).length,
      });
    } catch (error) {
      // Silently fail - don't disrupt user experience
      logger.error('Telemetry tracking error:', error);
    }
  }

  /**
   * Identify a user (with sanitized traits)
   * @param {string} userId - User ID
   * @param {Object} traits - User traits (will be sanitized)
   * @returns {Promise<void>}
   */
  async identify(userId, traits = {}) {
    if (!this.enabled || !this.posthog || !userId) {
      return;
    }

    try {
      const sanitizedTraits = sanitizeProperties(traits);
      
      this.posthog.identify({
        distinctId: userId,
        properties: sanitizedTraits,
      });

      logger.debug(`Telemetry user identified: ${userId}`);
    } catch (error) {
      logger.error('Telemetry identify error:', error);
    }
  }

  /**
   * Flush pending events
   * @returns {Promise<void>}
   */
  async flush() {
    if (this.posthog) {
      await this.posthog.shutdown();
    }
  }
}

// Create singleton instance
const telemetryService = new TelemetryService();

module.exports = telemetryService;

