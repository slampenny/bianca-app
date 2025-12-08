/**
 * Authentication & Authorization Configuration
 */

const Joi = require('joi');

const buildAuthConfig = (envVars) => ({
  jwt: {
    secret: envVars.JWT_SECRET || 'default-secret-please-change',
    accessExpirationMinutes: 30,
    refreshExpirationDays: 30,
    resetPasswordExpirationMinutes: 10,
    verifyEmailExpirationMinutes: 1440, // 24 hours
    inviteExpirationMinutes: 10080, // 7 days
  },
  roles: require('../roles'), // Import roles configuration
});

const validateAuthEnvVars = (envVars) => {
  const schema = Joi.object({
    JWT_SECRET: Joi.string().when('NODE_ENV', {
      is: Joi.string().valid('staging', 'production'),
      then: Joi.string().optional(),
      otherwise: Joi.string().required(),
    }),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyAuthSecrets = (config, secrets) => {
  if (secrets.JWT_SECRET) config.jwt.secret = secrets.JWT_SECRET;
  return config;
};

module.exports = {
  buildAuthConfig,
  validateAuthEnvVars,
  applyAuthSecrets,
};

