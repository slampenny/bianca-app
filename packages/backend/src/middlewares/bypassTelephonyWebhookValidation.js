const logger = require('../config/logger');
const config = require('../config/config');

const bypassTelephonyWebhookValidation = (req, res, next) => {
  const provider = config.telephony?.provider || 'twilio';
  logger.info(`[Telephony:${provider}] Request to ${req.originalUrl}`);
  logger.debug(`[Telephony:${provider}] Headers: ${JSON.stringify(req.headers)}`);
  logger.debug(`[Telephony:${provider}] Body: ${JSON.stringify(req.body)}`);
  next();
};

module.exports = bypassTelephonyWebhookValidation;
