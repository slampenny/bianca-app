// src/services/twilioSms.service.js

const twilio = require('twilio');
const config = require('../config/config');
const logger = require('../config/logger');

/**
 * Twilio SMS Service
 * Handles all SMS sending via Twilio (emergency alerts, verification codes, etc.)
 */
class TwilioSMSService {
  constructor() {
    this.twilioClient = null;
    this.isInitialized = false;
    this.initializeTwilio();
  }

  /**
   * Initialize Twilio client
   */
  initializeTwilio() {
    try {
      if (!config.twilio?.accountSid || !config.twilio?.authToken) {
        logger.warn('[Twilio SMS] Twilio credentials not available - SMS will not work');
        logger.warn(`[Twilio SMS] Missing - accountSid: ${!config.twilio?.accountSid}, authToken: ${!config.twilio?.authToken}`);
        return;
      }

      this.twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
      this.isInitialized = true;
      logger.info('[Twilio SMS] Twilio SMS client initialized successfully');
    } catch (error) {
      logger.error('[Twilio SMS] Failed to initialize Twilio client:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Re-initialize Twilio client (useful after secrets are loaded)
   */
  reinitialize() {
    logger.info('[Twilio SMS] Re-initializing Twilio client...');
    logger.info(`[Twilio SMS] Config check - accountSid: ${!!config.twilio?.accountSid}, authToken: ${!!config.twilio?.authToken}, phone: ${config.twilio?.phone || 'null'}`);
    this.isInitialized = false;
    this.twilioClient = null;
    this.initializeTwilio();
  }

  /**
   * Format phone number for Twilio (E.164 format)
   * @param {string} phone - Phone number in any format
   * @returns {string|null} Formatted phone number or null if invalid
   */
  formatPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Add +1 if it's a 10-digit US/Canada number
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // Add + if it's an 11-digit number starting with 1
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    // Return as-is if it already has country code
    if (phone.startsWith('+') && digits.length >= 10) {
      return phone;
    }
    
    return null; // Invalid format
  }

  /**
   * Validate phone number format
   * @param {string} phone - Phone number
   * @returns {boolean} True if valid
   */
  isValidPhoneNumber(phone) {
    if (!phone) return false;
    const formatted = this.formatPhoneNumber(phone);
    if (!formatted) return false;
    
    // Basic validation - should start with + and have 10-15 digits
    const phoneRegex = /^\+[1-9]\d{9,14}$/;
    return phoneRegex.test(formatted);
  }

  /**
   * Send SMS to a phone number
   * @param {string} phoneNumber - Phone number (will be formatted)
   * @param {string} message - Message text
   * @param {Object} options - Optional metadata
   * @returns {Promise<Object>} Twilio message response
   */
  async sendSMS(phoneNumber, message, options = {}) {
    try {
      // Lazy initialization - try to initialize if not already done
      if (!this.isInitialized || !this.twilioClient) {
        this.initializeTwilio();
        if (!this.isInitialized || !this.twilioClient) {
          throw new Error('Twilio SMS service not initialized');
        }
      }

      if (!config.twilio?.phone) {
        throw new Error('Twilio phone number not configured');
      }

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      if (!formattedPhone) {
        throw new Error(`Invalid phone number format: ${phoneNumber}`);
      }

      // Send SMS via Twilio
      const twilioMessage = await this.twilioClient.messages.create({
        to: formattedPhone,
        from: config.twilio.phone,
        body: message
      });

      logger.info(`[Twilio SMS] SMS sent to ${formattedPhone}, SID: ${twilioMessage.sid}`);
      
      return {
        success: true,
        messageSid: twilioMessage.sid,
        status: twilioMessage.status,
        phoneNumber: formattedPhone
      };
    } catch (error) {
      logger.error(`[Twilio SMS] Failed to send SMS to ${phoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Send SMS to multiple phone numbers
   * @param {Array<string>} phoneNumbers - Array of phone numbers
   * @param {string} message - Message text
   * @param {Object} options - Optional metadata
   * @returns {Promise<Object>} Results with success/failure counts
   */
  async sendBulkSMS(phoneNumbers, message, options = {}) {
    try {
      if (!phoneNumbers || phoneNumbers.length === 0) {
        return { success: false, reason: 'No phone numbers provided' };
      }

      // Send to each phone number
      const results = await Promise.allSettled(
        phoneNumbers.map(phoneNumber => this.sendSMS(phoneNumber, message, options))
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      logger.info(`[Twilio SMS] Bulk SMS sent: ${successful} successful, ${failed} failed`);

      return {
        success: successful > 0,
        successful,
        failed,
        total: phoneNumbers.length,
        results: results.map((result, index) => ({
          phoneNumber: phoneNumbers[index],
          success: result.status === 'fulfilled',
          error: result.status === 'rejected' ? result.reason.message : null,
          messageSid: result.status === 'fulfilled' ? result.value.messageSid : null
        }))
      };
    } catch (error) {
      logger.error('[Twilio SMS] Error sending bulk SMS:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mask phone number for display (privacy)
   * @param {string} phone - Phone number
   * @returns {string} Masked phone number
   */
  maskPhoneNumber(phone) {
    if (!phone) return '';
    
    const formatted = this.formatPhoneNumber(phone);
    if (!formatted) return phone;
    
    // Format: +1234567890 -> +1 (234) ***-7890
    const match = formatted.match(/^(\+\d{1,2})(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `${match[1]} (${match[2]}) ***-${match[4]}`;
    }
    
    return formatted;
  }

  /**
   * Extract and validate phone numbers from caregivers
   * @param {Array} caregivers - Array of caregiver objects with phone numbers
   * @returns {Array<string>} Array of unique, formatted phone numbers
   */
  extractPhoneNumbers(caregivers) {
    const phoneNumbers = new Set();
    
    caregivers.forEach(caregiver => {
      if (caregiver.phone) {
        const formattedPhone = this.formatPhoneNumber(caregiver.phone);
        if (formattedPhone && this.isValidPhoneNumber(formattedPhone)) {
          phoneNumbers.add(formattedPhone);
        }
      }
    });

    return Array.from(phoneNumbers);
  }

  /**
   * Get service status
   * @returns {Object} Service status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: !!config.twilio?.accountSid && !!config.twilio?.authToken && !!config.twilio?.phone,
      phoneNumber: config.twilio?.phone || null
    };
  }
}

// Create singleton instance
const twilioSmsService = new TwilioSMSService();

module.exports = {
  TwilioSMSService,
  twilioSmsService
};

