/**
 * Twilio Configuration
 */

const buildTwilioConfig = (envVars) => ({
  twilio: {
    phone: envVars.TWILIO_PHONENUMBER,
    apiUrl: envVars.PUBLIC_TUNNEL_URL || envVars.API_BASE_URL || `http://localhost:${envVars.PORT}`,
    accountSid: envVars.TWILIO_ACCOUNTSID,
    authToken: envVars.TWILIO_AUTHTOKEN,
    playbackUrl: 'https://default-playback-url.com',
    websocketUrl: envVars.WEBSOCKET_URL,
  },
});

const validateTwilioEnvVars = (envVars) => {
  const schema = Joi.object({
    TWILIO_PHONENUMBER: Joi.string().optional(),
    TWILIO_ACCOUNTSID: Joi.string().optional(),
    TWILIO_AUTHTOKEN: Joi.string().optional(),
    PUBLIC_TUNNEL_URL: Joi.string().uri().optional(),
    API_BASE_URL: Joi.string().uri().optional(),
    WEBSOCKET_URL: Joi.string().uri().optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyTwilioSecrets = (config, secrets) => {
  if (secrets.TWILIO_ACCOUNTSID) config.twilio.accountSid = secrets.TWILIO_ACCOUNTSID;
  if (secrets.TWILIO_AUTHTOKEN) config.twilio.authToken = secrets.TWILIO_AUTHTOKEN;
  if (secrets.TWILIO_VOICEURL) config.twilio.voiceUrl = secrets.TWILIO_VOICEURL;
  return config;
};

module.exports = {
  buildTwilioConfig,
  validateTwilioEnvVars,
  applyTwilioSecrets,
};

