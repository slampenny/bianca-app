const { SNSClient, PublishCommand, ListTopicsCommand } = require('@aws-sdk/client-sns');
const config = require('../../../config/config');
const logger = require('../../../config/logger');
const phoneUtils = require('../phoneUtils');

/**
 * Amazon SNS direct SMS (Publish to PhoneNumber). Uses default AWS credential chain.
 */
class SnsSmsProvider {
  constructor() {
    this.snsClient = null;
    this.isInitialized = false;
    this.initializeClient();
  }

  getRegion() {
    return config.sms?.snsRegion || config.aws?.region || 'us-east-2';
  }

  initializeClient() {
    try {
      const region = this.getRegion();
      if (!region) {
        logger.warn('[SMS SNS] No region configured (sms.snsRegion / AWS_REGION) — SMS disabled');
        return;
      }
      this.snsClient = new SNSClient({ region });
      this.isInitialized = true;
      logger.info(`[SMS SNS] SNS client initialized (region=${region})`);
    } catch (error) {
      logger.error('[SMS SNS] Failed to initialize SNS client:', error);
      this.isInitialized = false;
    }
  }

  reinitialize() {
    logger.info('[SMS SNS] Re-initializing SNS client...');
    this.isInitialized = false;
    this.snsClient = null;
    this.initializeClient();
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
    if (!this.isInitialized || !this.snsClient) {
      this.initializeClient();
      if (!this.isInitialized || !this.snsClient) {
        throw new Error('SNS SMS service not initialized');
      }
    }

    const formattedPhone = phoneUtils.formatPhoneNumber(phoneNumber);
    if (!formattedPhone) {
      throw new Error(`Invalid phone number format: ${phoneNumber}`);
    }

    const attrs = {
      'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
    };

    try {
      const out = await this.snsClient.send(
        new PublishCommand({
          PhoneNumber: formattedPhone,
          Message: message,
          MessageAttributes: attrs,
        })
      );

      logger.info(`[SMS SNS] SMS published to ${formattedPhone}, MessageId: ${out.MessageId}`);

      return {
        success: true,
        messageSid: out.MessageId,
        status: 'published',
        phoneNumber: formattedPhone,
      };
    } catch (error) {
      logger.error(`[SMS SNS] Failed to send SMS to ${phoneNumber}:`, error);
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

      logger.info(`[SMS SNS] Bulk SMS: ${successful} successful, ${failed} failed`);

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
      logger.error('[SMS SNS] Error sending bulk SMS:', error);
      return { success: false, error: error.message };
    }
  }

  async testConnectivity() {
    if (!this.isInitialized || !this.snsClient) {
      logger.warn('[SMS SNS] Connectivity test skipped: client not initialized.');
      return false;
    }
    try {
      await this.snsClient.send(new ListTopicsCommand({ MaxResults: 1 }));
      logger.info('[SMS SNS] Connectivity test passed (ListTopics).');
      return true;
    } catch (error) {
      logger.warn(`[SMS SNS] Connectivity test failed: ${error.message}`);
      return false;
    }
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: this.isInitialized,
      phoneNumber: null,
      provider: 'sns',
      region: this.getRegion(),
    };
  }
}

module.exports = SnsSmsProvider;
