/**
 * Email Configuration (SES, SMTP)
 */

const buildEmailConfig = (envVars) => ({
  email: {
    from: envVars.EMAIL_FROM || 'no-replay@myphonefriend.com',
    ses: {
      region: envVars.AWS_SES_REGION || envVars.AWS_REGION || 'us-east-2',
    },
    sns: {
      region: envVars.AWS_REGION || 'us-east-2',
      topicArn: envVars.EMERGENCY_SNS_TOPIC_ARN,
    },
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      secure: envVars.SMTP_SECURE === true,
      requireTLS: envVars.SMTP_REQUIRETLS === true,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
  },
});

const validateEmailEnvVars = (envVars) => {
  const schema = Joi.object({
    EMAIL_FROM: Joi.string().email().optional(),
    AWS_SES_REGION: Joi.string().optional(),
    SMTP_HOST: Joi.string().optional(),
    SMTP_PORT: Joi.number().optional(),
    SMTP_USERNAME: Joi.string().optional(),
    SMTP_PASSWORD: Joi.string().optional(),
    SMTP_SECURE: Joi.boolean().optional(),
    SMTP_REQUIRETLS: Joi.boolean().optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyEmailSecrets = (config, secrets) => {
  if (secrets.EMAIL_FROM) config.email.from = secrets.EMAIL_FROM;
  if (secrets.AWS_SES_REGION) config.email.ses.region = secrets.AWS_SES_REGION;
  if (secrets.SMTP_HOST) config.email.smtp.host = secrets.SMTP_HOST;
  if (secrets.SMTP_PORT) config.email.smtp.port = secrets.SMTP_PORT;
  if (secrets.SMTP_USERNAME) config.email.smtp.auth.user = secrets.SMTP_USERNAME;
  if (secrets.SMTP_PASSWORD) config.email.smtp.auth.pass = secrets.SMTP_PASSWORD;
  if (typeof secrets.SMTP_SECURE !== 'undefined') config.email.smtp.secure = secrets.SMTP_SECURE;
  if (typeof secrets.SMTP_REQUIRETLS !== 'undefined') config.email.smtp.requireTLS = secrets.SMTP_REQUIRETLS;
  return config;
};

module.exports = {
  buildEmailConfig,
  validateEmailEnvVars,
  applyEmailSecrets,
};

