/**
 * Telnyx voice configuration (Call Control / TeXML).
 */
const Joi = require('joi');

const buildTelnyxConfig = (envVars) => {
  const shouldRecord =
    envVars.NODE_ENV === 'staging' || envVars.NODE_ENV === 'development';

  return {
    telnyx: {
      apiKey: envVars.TELNYX_API_KEY,
      connectionId: envVars.TELNYX_CONNECTION_ID,
      phone: envVars.TELNYX_PHONE_NUMBER || envVars.TELNYX_PHONENUMBER,
      publicKey: envVars.TELNYX_PUBLIC_KEY,
      recordCalls: shouldRecord,
      apiBaseUrl: envVars.TELNYX_API_BASE_URL || 'https://api.telnyx.com/v2',
    },
  };
};

const validateTelnyxEnvVars = (envVars) => {
  const schema = Joi.object({
    TELNYX_API_KEY: Joi.string().optional(),
    TELNYX_CONNECTION_ID: Joi.string().optional(),
    TELNYX_PHONE_NUMBER: Joi.string().optional(),
    TELNYX_PHONENUMBER: Joi.string().optional(),
    TELNYX_PUBLIC_KEY: Joi.string().optional(),
    TELNYX_API_BASE_URL: Joi.string().uri().optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyTelnyxSecrets = (config, secrets) => {
  if (secrets.TELNYX_API_KEY) config.telnyx.apiKey = secrets.TELNYX_API_KEY;
  if (secrets.TELNYX_CONNECTION_ID) config.telnyx.connectionId = secrets.TELNYX_CONNECTION_ID;
  if (secrets.TELNYX_PUBLIC_KEY) config.telnyx.publicKey = secrets.TELNYX_PUBLIC_KEY;
  if (secrets.TELNYX_PHONE_NUMBER) config.telnyx.phone = secrets.TELNYX_PHONE_NUMBER;
  return config;
};

module.exports = {
  buildTelnyxConfig,
  validateTelnyxEnvVars,
  applyTelnyxSecrets,
};
