const config = require('../config/config');
const validateTwilioRequest = require('./validateTwilioRequest');
const validateTelnyxRequest = require('./validateTelnyxRequest');
const bypassTelephonyWebhookValidation = require('./bypassTelephonyWebhookValidation');

/**
 * Validates inbound voice telephony webhooks for the active provider.
 */
const validateTelephonyWebhook = (req, res, next) => {
  if (
    process.env.BYPASS_TELEPHONY_WEBHOOK_VALIDATION === 'true' ||
    process.env.BYPASS_TWILIO_VALIDATION === 'true'
  ) {
    return bypassTelephonyWebhookValidation(req, res, next);
  }

  const provider = config.telephony?.provider || 'twilio';
  if (provider === 'telnyx') {
    return validateTelnyxRequest(req, res, next);
  }

  return validateTwilioRequest(req, res, next);
};

module.exports = validateTelephonyWebhook;
