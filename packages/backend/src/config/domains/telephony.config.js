/**
 * Voice telephony provider selection (Twilio, Telnyx, etc.)
 */
const Joi = require('joi');

const buildTelephonyConfig = (envVars) => {
  const provider = (envVars.VOICE_TELEPHONY_PROVIDER || 'twilio').toLowerCase();
  return {
    telephony: {
      /** @type {'twilio'|'telnyx'} */
      provider: provider === 'telnyx' ? 'telnyx' : 'twilio',
    },
  };
};

const validateTelephonyEnvVars = (envVars) => {
  const schema = Joi.object({
    VOICE_TELEPHONY_PROVIDER: Joi.string().valid('twilio', 'telnyx').optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyTelephonySecrets = (config) => config;

module.exports = {
  buildTelephonyConfig,
  validateTelephonyEnvVars,
  applyTelephonySecrets,
};
