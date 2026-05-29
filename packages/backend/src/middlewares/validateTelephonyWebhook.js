const config = require('../config/config');
const validateTwilioRequest = require('./validateTwilioRequest');
const bypassTelephonyWebhookValidation = require('./bypassTelephonyWebhookValidation');

/**
 * Validates inbound voice telephony webhooks for the active provider.
 * Twilio routes use signature validation when not bypassed; Telnyx validation is added at cutover.
 */
const validateTelephonyWebhook = (req, res, next) => {
  if (
    process.env.BYPASS_TELEPHONY_WEBHOOK_VALIDATION === 'true' ||
    process.env.BYPASS_TWILIO_VALIDATION === 'true'
  ) {
    return bypassTelephonyWebhookValidation(req, res, next);
  }

  const provider = config.telephony?.provider || 'twilio';
  if (provider === 'twilio') {
    return validateTwilioRequest(req, res, next);
  }

  return bypassTelephonyWebhookValidation(req, res, next);
};

module.exports = validateTelephonyWebhook;
