// bypassTwilioValidation.js
const logger = require('../config/logger');

const bypassTwilioValidation = (req, res, next) => {
  // Log request details for debugging
  logger.info(`[Twilio] Request to ${req.originalUrl}`);
  logger.info(`[Twilio] Headers: ${JSON.stringify(req.headers)}`);
  logger.debug(`[Twilio] Body: ${JSON.stringify(req.body)}`);
  
  // Always continue to the next middleware
  next();
};

module.exports = bypassTwilioValidation;