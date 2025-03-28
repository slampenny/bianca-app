// config/config.js
const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');
const AWS = require('aws-sdk');

// Load .env file (if present)
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Define the environment variable schema
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
  JWT_SECRET: Joi.string().required(),
  MONGODB_URL: Joi.string(),
  SMTP_USERNAME: Joi.string(),
  SMTP_PASSWORD: Joi.string(),
  TWILIO_PHONENUMBER: Joi.string(),
  TWILIO_ACCOUNTSID: Joi.string(),
  TWILIO_AUTHTOKEN: Joi.string(),
  TWILIO_VOICEURL: Joi.string(),
  OPENAI_API_KEY: Joi.string(),
  STRIPE_SECRET_KEY: Joi.string()
}).unknown();

const { value: envVars, error } = envVarsSchema.validate(process.env, { errors: { label: 'key' } });
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Build a baseline configuration object synchronously.
const baselineConfig = {
  env: envVars.NODE_ENV,
  port: 3000,
  authEnabled: true,
  apiUrl: 'http://localhost:3000/v1',
  mongoose: {
    url: (envVars.MONGODB_URL || 'mongodb://localhost:27017/bianca-app') + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      useCreateIndex: true,
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  billing: { ratePerMinute: 0.1 },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: 30,
    refreshExpirationDays: 30,
    resetPasswordExpirationMinutes: 10,
    verifyEmailExpirationMinutes: 10,
    inviteExpirationMinutes: 10080
  },
  email: {
    smtp: {
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD
      }
    },
    from: 'support@myphonefriend.com'
  },
  google: {
    language: 'en-US',
    name: 'en-US-News-L',
    gender: 'FEMALE',
    encoding: 'MP3'
  },
  multer: { dest: path.join(__dirname, '../../uploads') },
  twilio: {
    phone: envVars.TWILIO_PHONENUMBER,
    apiUrl: 'https://505b-174-4-88-96.ngrok-free.app',
    accountSid: envVars.TWILIO_ACCOUNTSID,
    authToken: envVars.TWILIO_AUTHTOKEN,
    // In production, we may override this via secrets.
    playbackUrl: 'https://default-playback-url.com'
  },
  openai: {
    apiKey: envVars.OPENAI_API_KEY,
    model: 'gpt-3.5-turbo'
  },
  stripe: { secretKey: envVars.STRIPE_SECRET_KEY }
};

// If in production, further override baseline values with secrets from AWS Secrets Manager.
baselineConfig.loadSecrets = async () => {
  if (baselineConfig.env !== 'production') return;
  try {
    const client = new AWS.SecretsManager({ region: 'us-east-2' });
    const data = await client.getSecretValue({ SecretId: 'MySecretsManagerSecret' }).promise();
    const secrets = JSON.parse(data.SecretString || '{}');
    // For example, you might want to override the API URL, Mongoose URL, email settings, etc.
    Object.assign(baselineConfig, secrets);
  } catch (err) {
    console.error('Failed to load secrets:', err);
    throw err;
  }
};

// In production, we export the async loader; in non-production, the baseline is enough.
// You can use this same file in both cases—just remember that in production you must await loadSecrets() first.
module.exports = baselineConfig;
