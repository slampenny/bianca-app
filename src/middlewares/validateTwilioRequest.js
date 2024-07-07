const twilio = require('twilio');
const config = require('../config/config');
const logger = require('../config/logger');
const crypto = require('crypto');

const getExpectedTwilioSignature = (authToken, url, params) => {
  const sortedParams = Object.keys(params).sort().map(key => `${key}${params[key]}`).join('');
  const data = url + sortedParams;
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf-8')).digest('base64');
};

const validateTwilioRequest = (req, res, next) => {
  const twilioSignature = req.headers['x-twilio-signature'];
  const requestUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  logger.info(`Validating Twilio request with signature: ${twilioSignature}`);
  logger.info(`Request URL: ${requestUrl}`);
  logger.info(`Request body: ${JSON.stringify(req.body)}`);
  logger.info(`Headers: ${JSON.stringify(req.headers)}`);

  const isValid = twilio.validateRequestWithBody(config.twilio.authToken, twilioSignature, requestUrl, req.body);

  if (!isValid) {
    const expectedSignature = getExpectedTwilioSignature(config.twilio.authToken, requestUrl, req.body);
    logger.error('Invalid Twilio Signature');
    logger.error(`Expected Signature: ${expectedSignature}`);
    logger.error(`Twilio Signature: ${twilioSignature}`);
    return res.status(401).send({ message: 'Invalid Twilio Signature' });
  }

  next();
};

module.exports = validateTwilioRequest;
