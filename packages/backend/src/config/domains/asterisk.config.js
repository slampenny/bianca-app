/**
 * Asterisk/ARI Configuration
 */

const buildAsteriskConfig = (envVars) => {
  const defaultAsteriskHost = envVars.ASTERISK_HOST || 'asterisk';
  
  return {
    asterisk: {
      maxRetries: process.env.ARI_MAX_RETRIES || 10,
      retryDelay: process.env.ARI_RETRY_DELAY || 3000,
      maxRetryDelay: process.env.ARI_MAX_RETRY_DELAY || 30000,
      operationTimeout: process.env.ARI_OPERATION_TIMEOUT || 30000,
      enabled: envVars.ASTERISK_ENABLED,
      host: defaultAsteriskHost,
      url: `http://${defaultAsteriskHost}:8088`,
      rtpBiancaHost: envVars.RTP_BIANCA_HOST || 'bianca-app',
      rtpAsteriskHost: envVars.RTP_ASTERISK_HOST || 'asterisk',
      externalPort: envVars.EXTERNAL_PORT || 5061,
      sipUserName: envVars.SIP_USER_NAME || 'bianca',
      username: envVars.ASTERISK_USERNAME || 'myphonefriend',
      password: envVars.ARI_PASSWORD,
    },
  };
};

const validateAsteriskEnvVars = (envVars) => {
  const schema = Joi.object({
    ASTERISK_HOST: Joi.string().optional(),
    ASTERISK_URL: Joi.string().optional(),
    ASTERISK_USERNAME: Joi.string().optional(),
    ARI_PASSWORD: Joi.string().when('NODE_ENV', {
      is: Joi.string().valid('staging', 'production'),
      then: Joi.string().optional(),
      otherwise: Joi.string().optional(),
    }),
    RTP_BIANCA_HOST: Joi.string().optional(),
    RTP_ASTERISK_HOST: Joi.string().optional(),
    EXTERNAL_PORT: Joi.number().optional(),
    SIP_USER_NAME: Joi.string().optional(),
    ARI_MAX_RETRIES: Joi.number().optional(),
    ARI_RETRY_DELAY: Joi.number().optional(),
    ARI_MAX_RETRY_DELAY: Joi.number().optional(),
    ARI_OPERATION_TIMEOUT: Joi.number().optional(),
    ASTERISK_ENABLED: Joi.boolean().optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyAsteriskSecrets = (config, secrets) => {
  config.asterisk.enabled = true; // Always enable Asterisk
  if (secrets.ASTERISK_ARI_URL) {
    config.asterisk.url = secrets.ASTERISK_ARI_URL;
  } else if (secrets.ASTERISK_HOST) {
    config.asterisk.url = `http://${secrets.ASTERISK_HOST}:8088`;
  }
  if (secrets.RTP_BIANCA_HOST) config.asterisk.rtpBiancaHost = secrets.RTP_BIANCA_HOST;
  if (secrets.ASTERISK_USERNAME) config.asterisk.username = secrets.ASTERISK_USERNAME;
  if (secrets.ARI_PASSWORD) config.asterisk.password = secrets.ARI_PASSWORD;
  return config;
};

module.exports = {
  buildAsteriskConfig,
  validateAsteriskEnvVars,
  applyAsteriskSecrets,
};

