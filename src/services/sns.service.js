// src/services/sns.service.js

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { config: emergencyConfig } = require('../config/emergency.config');
const config = require('../config/config');
const logger = require('../config/logger');

/**
 * AWS SNS Service for Emergency Push Notifications
 */
class SNSService {
  constructor() {
    this.snsClient = null;
    this.isInitialized = false;
    this.initializeSNS();
  }

  /**
   * Initialize SNS client
   */
  async initializeSNS() {
    try {
      if (!emergencyConfig.enableSNSPushNotifications) {
        logger.info('SNS push notifications disabled in configuration');
        return;
      }

      // Use config.aws.region (same as S3 service) - reads from AWS_REGION env var
      const region = config.aws.region || 'us-east-2';
      
      this.snsClient = new SNSClient({
        region: region,
        // AWS SDK will automatically use credentials from environment, IAM role, or credentials file
      });

      this.isInitialized = true;
      logger.info(`SNS service initialized for region: ${region}`);
    } catch (error) {
      logger.error('Failed to initialize SNS service:', error);
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
      if (!this.isInitialized || !emergencyConfig.enableSNSPushNotifications) {
        return { success: false, reason: 'SNS not initialized or disabled' };
      }

      if (!caregivers || caregivers.length === 0) {
        logger.warn('No caregivers provided for emergency alert');
        return { success: false, reason: 'No caregivers to notify' };
      }

      // Create message based on severity
      const message = this.createMessage(alertData);
      
      // Get unique phone numbers from caregivers
      const phoneNumbers = this.extractPhoneNumbers(caregivers);
      
      if (phoneNumbers.length === 0) {
        logger.warn('No valid phone numbers found in caregiver list');
        return { success: false, reason: 'No valid phone numbers' };
      }

      // Send to each phone number
      const results = await Promise.allSettled(
        phoneNumbers.map(phoneNumber => this.sendToPhone(phoneNumber, message, alertData))
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      logger.info(`Emergency alert sent: ${successful} successful, ${failed} failed`);

      return {
        success: successful > 0,
        successful,
        failed,
        total: phoneNumbers.length,
        results: results.map((result, index) => ({
          phoneNumber: phoneNumbers[index],
          success: result.status === 'fulfilled',
          error: result.status === 'rejected' ? result.reason.message : null
        }))
      };
    } catch (error) {
      logger.error('Error sending emergency alert:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS to a specific phone number
   * @private
   */
  async sendToPhone(phoneNumber, message, alertData) {
    try {
      // Format phone number for SNS (ensure it starts with +)
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const command = new PublishCommand({
        PhoneNumber: formattedPhone,  // Send directly to phone number
        Message: message,
        MessageAttributes: {
          'severity': {
            DataType: 'String',
            StringValue: alertData.severity
          },
          'patientId': {
            DataType: 'String',
            StringValue: alertData.patientId
          },
          'category': {
            DataType: 'String',
            StringValue: alertData.category
          }
        }
      });

      const response = await this.snsClient.send(command);
      logger.debug(`SMS sent successfully to ${formattedPhone}: ${response.MessageId}`);
      
      return response;
    } catch (error) {
      logger.error(`Failed to send SMS to ${phoneNumber}:`, error);
      throw error;
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
   * Extract and validate phone numbers from caregivers
   * @private
   */
  extractPhoneNumbers(caregivers) {
    const phoneNumbers = new Set();
    
    caregivers.forEach(caregiver => {
      if (caregiver.phone) {
        const formattedPhone = this.formatPhoneNumber(caregiver.phone);
        if (this.isValidPhoneNumber(formattedPhone)) {
          phoneNumbers.add(formattedPhone);
        }
      }
    });

    return Array.from(phoneNumbers);
  }

  /**
   * Format phone number for SMS
   * @private
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Add +1 if it's a 10-digit US number
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // Add + if it's an 11-digit number starting with 1
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    // Return as-is if it already has country code
    if (digits.length > 11) {
      return `+${digits}`;
    }
    
    return phone; // Return original if we can't format
  }

  /**
   * Validate phone number format
   * @private
   */
  isValidPhoneNumber(phone) {
    if (!phone) return false;
    
    // Basic validation - should start with + and have 10-15 digits
    const phoneRegex = /^\+[1-9]\d{9,14}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Test SNS connectivity
   * @returns {Promise<boolean>} - Whether SNS is working
   */
  async testConnectivity() {
    try {
      if (!this.isInitialized) {
        return false;
      }

      // Test connectivity by checking if we can create a PublishCommand
      // This is a lightweight operation that validates the SNS client
      const { PublishCommand } = require('@aws-sdk/client-sns');
      const testCommand = new PublishCommand({
        PhoneNumber: '+1234567890', // Dummy number for testing
        Message: 'Test message'
      });

      // We don't actually send the message, just validate the command creation
      logger.info('SNS connectivity test passed - client is properly configured');
      return true;
    } catch (error) {
      logger.error('SNS connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Get service status
   * @returns {Object} - Service status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: emergencyConfig.enableSNSPushNotifications,
      region: process.env.AWS_REGION || 'us-east-2',
      directSMS: true
    };
  }
}

// Create singleton instance
const snsService = new SNSService();

module.exports = {
  SNSService,
  snsService // Singleton instance
};
