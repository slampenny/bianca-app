/**
 * Outbound SMS channel selection (Twilio vs Amazon SNS direct-to-phone Publish).
 *
 * SNS sandbox: new accounts may only SMS verified destinations until you request
 * production SMS in the AWS console (SNS → Text messaging) and adjust spending limits.
 * Twilio has a similar trial/verify flow. Set SMS_PROVIDER=sns only when IAM allows sns:Publish.
 */
const Joi = require('joi');

const buildSmsConfig = (envVars) => {
  const raw = (envVars.SMS_PROVIDER || 'twilio').toLowerCase();
  /** @type {'twilio'|'sns'} */
  const provider = raw === 'sns' ? 'sns' : 'twilio';
  return {
    sms: {
      provider,
      snsRegion: envVars.SMS_SNS_REGION || envVars.AWS_REGION || 'us-east-2',
    },
  };
};

const validateSmsEnvVars = (envVars) => {
  const schema = Joi.object({
    SMS_PROVIDER: Joi.string().valid('twilio', 'sns').optional(),
    SMS_SNS_REGION: Joi.string().optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applySmsSecrets = (config, _secrets) => config;

module.exports = {
  buildSmsConfig,
  validateSmsEnvVars,
  applySmsSecrets,
};
