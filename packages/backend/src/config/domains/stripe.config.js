/**
 * Stripe Configuration
 */

const Joi = require('joi');

const buildStripeConfig = (envVars) => ({
  stripe: {
    secretKey: envVars.STRIPE_SECRET_KEY,
    publishableKey: envVars.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: envVars.STRIPE_WEBHOOK_SECRET,
    mode: envVars.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'live',
  },
});

const validateStripeEnvVars = (envVars) => {
  const schema = Joi.object({
    STRIPE_SECRET_KEY: Joi.string().optional(),
    STRIPE_PUBLISHABLE_KEY: Joi.string().optional(),
    STRIPE_WEBHOOK_SECRET: Joi.string().optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyStripeSecrets = (config, secrets) => {
  // Apply Stripe secrets from AWS Secrets Manager (for staging/production)
  // These will override any .env values that were loaded initially
  if (secrets.STRIPE_SECRET_KEY) {
    config.stripe.secretKey = secrets.STRIPE_SECRET_KEY;
    config.stripe.mode = secrets.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live';
    // Also update process.env so other modules can read it
    process.env.STRIPE_SECRET_KEY = secrets.STRIPE_SECRET_KEY;
  }
  if (secrets.STRIPE_PUBLISHABLE_KEY) {
    config.stripe.publishableKey = secrets.STRIPE_PUBLISHABLE_KEY;
    process.env.STRIPE_PUBLISHABLE_KEY = secrets.STRIPE_PUBLISHABLE_KEY;
  }
  if (secrets.STRIPE_WEBHOOK_SECRET) {
    config.stripe.webhookSecret = secrets.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = secrets.STRIPE_WEBHOOK_SECRET;
  }
  return config;
};

module.exports = {
  buildStripeConfig,
  validateStripeEnvVars,
  applyStripeSecrets,
};

