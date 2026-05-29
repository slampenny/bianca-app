/**
 * Voice telephony provider selection (Twilio, Telnyx, etc.)
 */
const Joi = require('joi');

const buildTelephonyConfig = (envVars) => {
  const provider = (envVars.VOICE_TELEPHONY_PROVIDER || 'twilio').toLowerCase();
  const port = envVars.PORT || 3000;
  return {
    telephony: {
      /** @type {'twilio'|'telnyx'} */
      provider: provider === 'telnyx' ? 'telnyx' : 'twilio',
      apiUrl:
        envVars.PUBLIC_TUNNEL_URL || envVars.API_BASE_URL || `http://localhost:${port}`,
      /** Webhook route prefix; defaults to /v1/twilio for existing Twilio console config */
      webhookPathPrefix: envVars.TELEPHONY_WEBHOOK_PATH || '/v1/twilio',
    },
  };
};

const validateTelephonyEnvVars = (envVars) => {
  const schema = Joi.object({
    VOICE_TELEPHONY_PROVIDER: Joi.string().valid('twilio', 'telnyx').optional(),
    TELEPHONY_WEBHOOK_PATH: Joi.string().optional(),
    PUBLIC_TUNNEL_URL: Joi.string().uri().optional(),
    API_BASE_URL: Joi.string().uri().optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyTelephonySecrets = (config) => config;

module.exports = {
  buildTelephonyConfig,
  validateTelephonyEnvVars,
  applyTelephonySecrets,
};
