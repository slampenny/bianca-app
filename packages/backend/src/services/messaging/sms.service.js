/**
 * SMS facade: Twilio (default) or Amazon SNS (SMS_PROVIDER=sns).
 * Prefer this module or services.smsService / services.twilioSmsService (alias).
 */
const config = require('../../config/config');
const logger = require('../../config/logger');

let cachedImpl;
let cachedProviderId;

function clearImplementationCache() {
  cachedImpl = null;
  cachedProviderId = null;
}

function getProviderId() {
  return config.sms?.provider || 'twilio';
}

function getImplementation() {
  const providerId = getProviderId();
  if (cachedImpl && cachedProviderId === providerId) {
    return cachedImpl;
  }
  cachedProviderId = providerId;

  if (providerId === 'sns') {
    const SnsSmsProvider = require('./providers/sns.sms.provider');
    cachedImpl = new SnsSmsProvider();
    logger.info('[SMS] Active provider: sns (Amazon SNS)');
    return cachedImpl;
  }

  const TwilioSmsProvider = require('./providers/twilio.sms.provider');
  cachedImpl = new TwilioSmsProvider();
  logger.info('[SMS] Active provider: twilio');
  return cachedImpl;
}

const facade = {
  get providerId() {
    return getProviderId();
  },
  getImplementation,
  get isInitialized() {
    return getImplementation().isInitialized;
  },
  reinitialize() {
    clearImplementationCache();
    const impl = getImplementation();
    if (typeof impl.reinitialize === 'function') {
      impl.reinitialize();
    }
  },
  formatPhoneNumber: (...args) => getImplementation().formatPhoneNumber(...args),
  isValidPhoneNumber: (...args) => getImplementation().isValidPhoneNumber(...args),
  maskPhoneNumber: (...args) => getImplementation().maskPhoneNumber(...args),
  extractPhoneNumbers: (...args) => getImplementation().extractPhoneNumbers(...args),
  sendSMS: (...args) => getImplementation().sendSMS(...args),
  sendBulkSMS: (...args) => getImplementation().sendBulkSMS(...args),
  testConnectivity: (...args) => getImplementation().testConnectivity(...args),
  getStatus: (...args) => getImplementation().getStatus(...args),
};

module.exports = facade;
