/**
 * Configuration Domain Modules
 * 
 * This file aggregates all domain-specific configuration modules
 * and provides a unified interface for building and applying secrets.
 */

const authConfig = require('./auth.config');
const databaseConfig = require('./database.config');
const emailConfig = require('./email.config');
const asteriskConfig = require('./asterisk.config');
const openaiConfig = require('./openai.config');
const twilioConfig = require('./twilio.config');
const stripeConfig = require('./stripe.config');
const cacheConfig = require('./cache.config');

/**
 * Build all domain configurations
 */
const buildAllConfigs = (envVars) => {
  return {
    ...authConfig.buildAuthConfig(envVars),
    ...databaseConfig.buildDatabaseConfig(envVars),
    ...emailConfig.buildEmailConfig(envVars),
    ...asteriskConfig.buildAsteriskConfig(envVars),
    ...openaiConfig.buildOpenAIConfig(envVars),
    ...twilioConfig.buildTwilioConfig(envVars),
    ...stripeConfig.buildStripeConfig(envVars),
    ...cacheConfig.buildCacheConfig(envVars),
  };
};

/**
 * Apply all secrets to configuration
 */
const applyAllSecrets = (config, secrets) => {
  authConfig.applyAuthSecrets(config, secrets);
  databaseConfig.applyDatabaseSecrets(config, secrets);
  emailConfig.applyEmailSecrets(config, secrets);
  asteriskConfig.applyAsteriskSecrets(config, secrets);
  openaiConfig.applyOpenAISecrets(config, secrets);
  twilioConfig.applyTwilioSecrets(config, secrets);
  stripeConfig.applyStripeSecrets(config, secrets);
  cacheConfig.applyCacheSecrets(config, secrets);
  return config;
};

module.exports = {
  buildAllConfigs,
  applyAllSecrets,
  // Export individual modules for direct access if needed
  authConfig,
  databaseConfig,
  emailConfig,
  asteriskConfig,
  openaiConfig,
  twilioConfig,
  stripeConfig,
  cacheConfig,
};

