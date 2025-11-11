/**
 * Stripe Configuration
 */

const buildStripeConfig = (envVars) => ({
  stripe: {
    secretKey: envVars.STRIPE_SECRET_KEY,
    publishableKey: envVars.STRIPE_PUBLISHABLE_KEY,
    mode: envVars.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'live',
  },
});

const validateStripeEnvVars = (envVars) => {
  const schema = Joi.object({
    STRIPE_SECRET_KEY: Joi.string().optional(),
    STRIPE_PUBLISHABLE_KEY: Joi.string().optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyStripeSecrets = (config, secrets) => {
  if (secrets.STRIPE_SECRET_KEY) {
    config.stripe.secretKey = secrets.STRIPE_SECRET_KEY;
    config.stripe.mode = secrets.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live';
  }
  if (secrets.STRIPE_PUBLISHABLE_KEY) config.stripe.publishableKey = secrets.STRIPE_PUBLISHABLE_KEY;
  return config;
};

module.exports = {
  buildStripeConfig,
  validateStripeEnvVars,
  applyStripeSecrets,
};

