const twilio = require('twilio');
const config = require('../../../config/config');
const logger = require('../../../config/logger');
const phoneUtils = require('../phoneUtils');

/**
 * Twilio-backed SMS (verification codes, emergency SMS, etc.)
 */
class TwilioSmsProvider {
  constructor() {
    this.twilioClient = null;
    this.isInitialized = false;
    this.initializeTwilio();
  }

  initializeTwilio() {
    try {
      if (!config.twilio?.accountSid || !config.twilio?.authToken) {
        logger.warn('[Twilio SMS] Twilio credentials not available - SMS will not work');
        logger.warn(
          `[Twilio SMS] Missing - accountSid: ${!config.twilio?.accountSid}, authToken: ${!config.twilio?.authToken}`
        );
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

  reinitialize() {
    logger.info('[Twilio SMS] Re-initializing Twilio client...');
    logger.info(
      `[Twilio SMS] Config check - accountSid: ${!!config.twilio?.accountSid}, authToken: ${!!config.twilio?.authToken}, phone: ${config.twilio?.phone || 'null'}`
    );
    this.isInitialized = false;
    this.twilioClient = null;
    this.initializeTwilio();
  }

  formatPhoneNumber(phone) {
    return phoneUtils.formatPhoneNumber(phone);
  }

  isValidPhoneNumber(phone) {
    return phoneUtils.isValidPhoneNumber(phone);
  }

  maskPhoneNumber(phone) {
    return phoneUtils.maskPhoneNumber(phone);
  }

  extractPhoneNumbers(caregivers) {
    return phoneUtils.extractPhoneNumbers(caregivers);
  }

  async sendSMS(phoneNumber, message, options = {}) {
    try {
      if (!this.isInitialized || !this.twilioClient) {
        this.initializeTwilio();
        if (!this.isInitialized || !this.twilioClient) {
          throw new Error('Twilio SMS service not initialized');
        }
      }

      if (!config.twilio?.phone) {
        throw new Error('Twilio phone number not configured');
      }

      const formattedPhone = phoneUtils.formatPhoneNumber(phoneNumber);
      if (!formattedPhone) {
        throw new Error(`Invalid phone number format: ${phoneNumber}`);
      }

      const twilioMessage = await this.twilioClient.messages.create({
        to: formattedPhone,
        from: config.twilio.phone,
        body: message,
      });

      logger.info(`[Twilio SMS] SMS sent to ${formattedPhone}, SID: ${twilioMessage.sid}`);

      return {
        success: true,
        messageSid: twilioMessage.sid,
        status: twilioMessage.status,
        phoneNumber: formattedPhone,
      };
    } catch (error) {
      logger.error(`[Twilio SMS] Failed to send SMS to ${phoneNumber}:`, error);
      throw error;
    }
  }

  async sendBulkSMS(phoneNumbers, message, options = {}) {
    try {
      if (!phoneNumbers || phoneNumbers.length === 0) {
        return { success: false, reason: 'No phone numbers provided' };
      }

      const results = await Promise.allSettled(
        phoneNumbers.map((phoneNumber) => this.sendSMS(phoneNumber, message, options))
      );

      const successful = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.filter((result) => result.status === 'rejected').length;

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
          messageSid: result.status === 'fulfilled' ? result.value.messageSid : null,
        })),
      };
    } catch (error) {
      logger.error('[Twilio SMS] Error sending bulk SMS:', error);
      return { success: false, error: error.message };
    }
  }

  async testConnectivity() {
    try {
      if (!this.isInitialized) {
        logger.warn('[Twilio SMS] Connectivity test skipped: Service not initialized.');
        return false;
      }
      await this.twilioClient.api.v2010.accounts(config.twilio.accountSid).fetch();
      logger.info('[Twilio SMS] Connectivity test passed: Twilio client can access account.');
      return true;
    } catch (error) {
      const isAuthError = error.code === 20003 || error.status === 401;

      if (isAuthError) {
        logger.warn(
          `[Twilio SMS] Connectivity test skipped: Authentication failed (credentials not available). SMS functionality will be disabled.`
        );
        logger.debug(`[Twilio SMS] Auth error details: ${error.message}`);
      } else {
        logger.error(`[Twilio SMS] Connectivity test failed: ${error.message}`, error);
      }

      return false;
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: !!config.twilio?.accountSid && !!config.twilio?.authToken && !!config.twilio?.phone,
      phoneNumber: config.twilio?.phone || null,
    };
  }
}

module.exports = TwilioSmsProvider;
