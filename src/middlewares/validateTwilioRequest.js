// validateTwilioRequest.js
const twilio = require('twilio');
const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../config/logger'); // Your updated logger

const validateTwilioRequest = (req, res, next) => {
  logger.info('>>> ENTERING validateTwilioRequest middleware');
  const twilioSignature = req.headers['x-twilio-signature'];

  // --- URL Reconstruction ---
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const { originalUrl } = req;
  const fullRequestUrl = `${protocol}://${host}${originalUrl}`; // Keep original with query if present

  // --- ADJUSTMENT: Create URL *without* query string specifically for validation ---
  // Based on comparison between app logs and Twilio debugger, Twilio might be signing
  // POST webhooks without including the query string in the signature base.
  const validationUrl = fullRequestUrl.split('?')[0];
  // --- END ADJUSTMENT ---

  logger.info(`Validating Twilio request. Signature Header: ${twilioSignature ? 'Present' : 'MISSING'}`);
  logger.info(`Full Request URL Seen by App: ${fullRequestUrl}`); // Log the full URL seen
  logger.info(`URL Used for Validation Check: ${validationUrl}`); // Log the URL we'll actually use

  if (!twilioSignature) {
    logger.error('Invalid Twilio Request: Missing X-Twilio-Signature header.');
    res.status(403).type('text/xml').send('<Response><Say>Authentication Error: Missing signature.</Say></Response>');
    return;
  }

  const params = req.body || {};

  // --- DETAILED LOGGING BEFORE VALIDATION ---
  logger.debug('Validating Twilio request', {
    authTokenStatus: config.twilio.authToken && config.twilio.authToken.length > 10 ? 'LOADED' : 'MISSING or Invalid Length',
    receivedSignature: twilioSignature,
    validationUrl,
    validationParams: params
  });
  // --- END DETAILED LOGGING ---

  const isValid = twilio.validateRequestWithBody(
    config.twilio.authToken,
    twilioSignature,
    validationUrl, // <<< Use the URL WITHOUT the query string
    params
  );

  // --- LOG VALIDATION RESULT ---
  logger.debug('Twilio validation result', {
    isValid,
    validationUrl
  });
  // --- END RESULT LOG ---

  if (!isValid) {
    logger.error('Invalid Twilio Signature (Official Validator Returned False)');
    logger.error(`Full Request URL was: ${fullRequestUrl}`); // Log original URL for context
    logger.error(`Validation URL Used: ${validationUrl}`);
    logger.error(`Failed Signature: ${twilioSignature}`);
    logger.error(`Failed Params: ${JSON.stringify(params)}`);

    res.status(403).type('text/xml').send('<Response><Say>Authentication Error: Invalid signature.</Say></Response>');
    return;
  }

  logger.info('>>> Twilio validation successful.');
  next();
};

module.exports = validateTwilioRequest;
