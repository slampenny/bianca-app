const twilio = require('twilio');
const config = require('../config/config');

const validateTwilioRequest = (req, res, next) => {
    const twilioSignature = req.headers['x-twilio-signature'];
    const requestUrl = config.twilio.voiceUrl;
    const params = req.body;

    if (twilio.validateRequest(config.twilio.authToken, twilioSignature, requestUrl, params)) {
        next();
    } else {
        res.status(401).send('Invalid Twilio Signature');
    }
};

module.exports = validateTwilioRequest;
