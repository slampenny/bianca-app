// src/services/sns.service.js

const { config: emergencyConfig } = require('../config/emergency.config');
const { twilioSmsService } = require('./twilioSms.service');
const logger = require('../config/logger');

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
      if (!emergencyConfig.enableSNSPushNotifications) {
        return { success: false, reason: 'Emergency notifications disabled in config' };
      }

      if (!twilioSmsService) {
        return { success: false, reason: 'Twilio SMS service not available' };
      }

      // Try to initialize Twilio if not already initialized (lazy init)
      if (!twilioSmsService.isInitialized) {
        twilioSmsService.reinitialize();
        if (!twilioSmsService.isInitialized) {
          return { success: false, reason: 'Twilio SMS service not initialized' };
        }
      }

      if (!caregivers || caregivers.length === 0) {
        logger.warn('No caregivers provided for emergency alert');
        return { success: false, reason: 'No caregivers to notify' };
      }

      // Create message based on severity
      const message = this.createMessage(alertData);
      
      // Get unique phone numbers from caregivers using Twilio service
      const phoneNumbers = twilioSmsService.extractPhoneNumbers(caregivers);
      
      if (phoneNumbers.length === 0) {
        logger.warn('No valid phone numbers found in caregiver list');
        return { success: false, reason: 'No valid phone numbers' };
      }

      // Send to each phone number using Twilio
      const results = await Promise.allSettled(
        phoneNumbers.map(phoneNumber => 
          twilioSmsService.sendSMS(phoneNumber, message, {
            severity: alertData?.severity,
            category: alertData?.category,
            patientId: alertData?.patientId,
            alertType: 'emergency'
          })
        )
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      logger.info(`Emergency alert sent via Twilio: ${successful} successful, ${failed} failed`);

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
   * @private
   */
  createMessage(alertData) {
    const template = emergencyConfig.sns.messageTemplate[alertData.severity] || 
                    emergencyConfig.sns.messageTemplate.MEDIUM;

    return template
      .replace('{patientName}', alertData.patientName || 'Unknown Patient')
      .replace('{category}', alertData.category || 'Unknown')
      .replace('{phrase}', alertData.phrase || 'Emergency detected')
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
    
    return twilioSmsService.testConnectivity();
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
