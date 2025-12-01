// src/services/sns.service.js

const { config: emergencyConfig } = require('../config/emergency.config');
const { twilioSmsService } = require('./twilioSms.service');
const logger = require('../config/logger');
const i18n = require('i18n');

// Configure i18n for emergency alerts (same config as email service)
i18n.configure({
  locales: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ko', 'ar'],
  directory: `${__dirname}/../locales`,
  objectNotation: true,
  defaultLocale: 'en',
  logWarnFn(msg) {
    // do nothing
  },
});

/**
 * Emergency Alert Service (uses Twilio for SMS)
 * NOTE: This service now uses Twilio for SMS sending instead of AWS SNS
 * The name "SNSService" is kept for backward compatibility with existing code
 */
class SNSService {
  constructor() {
    this.isInitialized = false;
    this.initialize();
  }

  /**
   * Initialize service (checks Twilio SMS availability)
   */
  async initialize() {
    try {
      if (!emergencyConfig.enableSNSPushNotifications) {
        logger.info('Emergency push notifications disabled in configuration');
        return;
      }

      // Service is initialized if Twilio SMS is available
      if (twilioSmsService && twilioSmsService.isInitialized) {
        this.isInitialized = true;
        logger.info('Emergency alert service initialized (using Twilio SMS)');
      } else {
        logger.warn('Emergency alert service: Twilio SMS not yet initialized');
        // Will initialize lazily when first used
        this.isInitialized = false;
      }
    } catch (error) {
      logger.error('Failed to initialize emergency alert service:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Send emergency alert to caregivers
   * @param {Object} alertData - Alert information
   * @param {string} alertData.patientId - Patient ID
   * @param {string} alertData.patientName - Patient name
   * @param {string} alertData.severity - Alert severity (CRITICAL, HIGH, MEDIUM)
   * @param {string} alertData.category - Alert category
   * @param {string} alertData.phrase - Matched emergency phrase
   * @param {Array} caregivers - Array of caregiver objects with phone numbers
   * @returns {Promise<Object>} - Send result
   */
  async sendEmergencyAlert(alertData, caregivers = []) {
    try {
      logger.info(`[SNS Service] sendEmergencyAlert called for patient ${alertData?.patientId}, severity: ${alertData?.severity}`);
      logger.info(`[SNS Service] enableSNSPushNotifications: ${emergencyConfig.enableSNSPushNotifications}, caregivers count: ${caregivers?.length || 0}`);
      
      if (!emergencyConfig.enableSNSPushNotifications) {
        logger.warn('[SNS Service] Emergency notifications disabled in config');
        return { success: false, reason: 'Emergency notifications disabled in config' };
      }

      if (!twilioSmsService) {
        logger.error('[SNS Service] Twilio SMS service not available');
        return { success: false, reason: 'Twilio SMS service not available' };
      }

      // Try to initialize Twilio if not already initialized (lazy init)
      if (!twilioSmsService.isInitialized) {
        logger.info('[SNS Service] Twilio SMS not initialized, attempting to reinitialize...');
        twilioSmsService.reinitialize();
        if (!twilioSmsService.isInitialized) {
          logger.error('[SNS Service] Twilio SMS service failed to initialize');
          return { success: false, reason: 'Twilio SMS service not initialized' };
        }
        logger.info('[SNS Service] Twilio SMS service initialized successfully');
      }

      if (!caregivers || caregivers.length === 0) {
        logger.warn('[SNS Service] No caregivers provided for emergency alert');
        return { success: false, reason: 'No caregivers to notify' };
      }

      // Get unique phone numbers from caregivers using Twilio service
      const phoneNumbers = twilioSmsService.extractPhoneNumbers(caregivers);
      logger.info(`[SNS Service] Extracted ${phoneNumbers.length} valid phone number(s) from ${caregivers.length} caregiver(s)`);
      
      if (phoneNumbers.length === 0) {
        logger.warn('[SNS Service] No valid phone numbers found in caregiver list');
        caregivers.forEach((cg, idx) => {
          logger.warn(`[SNS Service] Caregiver ${idx + 1}: phone="${cg.phone || 'MISSING'}"`);
        });
        return { success: false, reason: 'No valid phone numbers' };
      }

      // Create a map of phone number to caregiver for locale lookup
      const phoneToCaregiver = new Map();
      caregivers.forEach(caregiver => {
        const phone = twilioSmsService.formatPhoneNumber(caregiver.phone);
        if (phone) {
          phoneToCaregiver.set(phone, caregiver);
        }
      });

      // Send to each phone number using Twilio with localized messages
      const previousLocale = i18n.getLocale();
      const results = await Promise.allSettled(
        phoneNumbers.map(phoneNumber => {
          // Get caregiver's preferred language for this phone number
          const caregiver = phoneToCaregiver.get(phoneNumber);
          const locale = caregiver?.preferredLanguage || 'en';
          
          // Create localized message for this caregiver (createMessage handles locale internally)
          const message = this.createMessage(alertData, locale);
          
          return twilioSmsService.sendSMS(phoneNumber, message, {
            severity: alertData?.severity,
            category: alertData?.category,
            patientId: alertData?.patientId,
            alertType: 'emergency',
            locale: locale
          });
        })
      );
      
      // Restore previous locale
      i18n.setLocale(previousLocale);

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      logger.info(`[SNS Service] Emergency alert sent via Twilio: ${successful} successful, ${failed} failed`);
      
      // Log detailed results for debugging
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          logger.info(`[SNS Service] SMS sent successfully to ${twilioSmsService.maskPhoneNumber(phoneNumbers[index])}, SID: ${result.value.messageSid}`);
        } else {
          logger.error(`[SNS Service] SMS failed to ${twilioSmsService.maskPhoneNumber(phoneNumbers[index])}: ${result.reason?.message || result.reason}`);
        }
      });

      return {
        success: successful > 0,
        successful,
        failed,
        total: phoneNumbers.length,
        results: results.map((result, index) => ({
          phoneNumber: twilioSmsService.maskPhoneNumber(phoneNumbers[index]),
          success: result.status === 'fulfilled',
          error: result.status === 'rejected' ? result.reason.message : null,
          messageSid: result.status === 'fulfilled' ? result.value.messageSid : null
        }))
      };
    } catch (error) {
      logger.error('Error sending emergency alert:', error);
      return { success: false, error: error.message };
    }
  }


  /**
   * Create message text based on alert data
   * @param {Object} alertData - Alert information
   * @param {string} [locale='en'] - Locale for message
   * @private
   */
  createMessage(alertData, locale = 'en') {
    const patientName = alertData.patientName || 'Unknown Patient';
    const category = alertData.category || 'Unknown';
    const phrase = alertData.phrase || 'Emergency detected';
    const severityKey = alertData.severity || 'MEDIUM';
    
    // Try to use localized template from i18n
    if (i18n.__) {
      const previousLocale = i18n.getLocale();
      i18n.setLocale(locale);
      const template = i18n.__(`emergencyAlert.${severityKey}`);
      i18n.setLocale(previousLocale);
      
      // If template found and valid (not the key itself), use it
      if (template && !template.includes('emergencyAlert.')) {
        // Replace placeholders in order: patientName, category, phrase
        return template
          .replace('%s', patientName)
          .replace('%s', category)
          .replace('%s', phrase);
      }
    }
    
    // Fallback to config template or default
    const template = emergencyConfig.sns.messageTemplate[severityKey] || 
                     emergencyConfig.sns.messageTemplate.MEDIUM;

    return template
      .replace('{patientName}', patientName)
      .replace('{category}', category)
      .replace('{phrase}', phrase)
      .replace('{timestamp}', new Date().toLocaleString());
  }


  /**
   * Test SMS connectivity (tests Twilio)
   * @returns {Promise<boolean>} - Whether SMS is working
   */
  async testConnectivity() {
    if (!emergencyConfig.enableSNSPushNotifications) {
      logger.info('Emergency push notifications disabled, skipping connectivity test.');
      return false;
    }
    
    if (!twilioSmsService) {
      logger.error('Twilio SMS service not available for connectivity test.');
      return false;
    }
    
    // Check if testConnectivity method exists (it may not be available in all contexts)
    if (typeof twilioSmsService.testConnectivity === 'function') {
      return twilioSmsService.testConnectivity();
    }
    
    // Fallback: just check if service is initialized
    return twilioSmsService.isInitialized;
  }

  /**
   * Get service status
   * @returns {Object} - Service status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: emergencyConfig.enableSNSPushNotifications,
      smsProvider: 'Twilio',
      twilioSmsServiceStatus: twilioSmsService ? twilioSmsService.getStatus() : null
    };
  }
}

// Create singleton instance
const snsService = new SNSService();

module.exports = {
  SNSService,
  snsService // Singleton instance
};
