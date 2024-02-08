const twilio = require('twilio');
const config = require('../config/config');
const logger = require('../config/logger');

const validateTwilioRequest = (req, res, next) => {
    const twilioSignature = req.headers['x-twilio-signature'];
    const requestUrl = 'https://' + req.get('host') + req.originalUrl;
    const params = req.body;
    
    logger.info(`Token: ${config.twilio.authToken}`);
    logger.info(`Twilio Signature: ${twilioSignature}`);
    logger.info(`Request URL: ${requestUrl}`);
    logger.info(`Params: ${JSON.stringify(params)}`);

    if (twilio.validateRequest(config.twilio.authToken, twilioSignature, requestUrl, params)) {
        next();
    } else {
        res.status(401).send('Invalid Twilio Signature');
    }
};

module.exports = validateTwilioRequest;
