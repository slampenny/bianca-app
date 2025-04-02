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
  JWT_SECRET: Joi.string(),
  MONGODB_URL: Joi.string(),
  SMTP_USERNAME: Joi.string(),
  SMTP_PASSWORD: Joi.string(),
  TWILIO_PHONENUMBER: Joi.string(),
  TWILIO_ACCOUNTSID: Joi.string(),
  TWILIO_AUTHTOKEN: Joi.string(),
  TWILIO_VOICEURL: Joi.string(),
  OPENAI_API_KEY: Joi.string(),
  STRIPE_SECRET_KEY: Joi.string(),
  STRIPE_PUBLISHABLE_KEY: Joi.string()
}).unknown();

const { value: envVars, error } = envVarsSchema.validate(process.env, { errors: { label: 'key' } });
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Build a baseline configuration object based on environment variables
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
    playbackUrl: 'https://default-playback-url.com'
  },
  openai: {
    apiKey: envVars.OPENAI_API_KEY,
    model: 'gpt-3.5-turbo'
  },
  stripe: { 
    secretKey: envVars.STRIPE_SECRET_KEY,
    publishableKey: envVars.STRIPE_PUBLISHABLE_KEY,
    // Determine Stripe mode based on key prefix
    mode: envVars.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'live'
  }
};

// Set production-specific defaults
if (envVars.NODE_ENV === 'production') {
  baselineConfig.apiUrl = 'http://app.myphonefriend.com/v1';
  baselineConfig.mongoose.url = 'mongodb://localhost:27017/bianca-app';
  baselineConfig.email.smtp.secure = true;
  baselineConfig.twilio.apiUrl = 'https://app.myphonefriend.com';
  baselineConfig.jwt.secret = 'your-production-secret'; // Replace with your production secret
}

// Add method to load secrets from AWS Secrets Manager
baselineConfig.loadSecrets = async () => {
  // Skip in non-production environments
  if (baselineConfig.env !== 'production') {
    return baselineConfig;
  }

  try {
    // Create a Secrets Manager client
    const client = new AWS.SecretsManager({ region: 'us-east-2' });
    
    // Get the secret value
    const data = await client.getSecretValue({ SecretId: 'MySecretsManagerSecret' }).promise();
    
    // Parse the secret JSON
    const secrets = JSON.parse(data.SecretString || '{}');
    
    // First update process.env with the secrets
    Object.assign(process.env, secrets);
    
    // Then update config with specific mappings
    // JWT
    if (secrets.JWT_SECRET) {
      baselineConfig.jwt.secret = secrets.JWT_SECRET;
    }
    
    // Email
    if (secrets.SMTP_USERNAME) {
      baselineConfig.email.smtp.auth.user = secrets.SMTP_USERNAME;
    }
    if (secrets.SMTP_PASSWORD) {
      baselineConfig.email.smtp.auth.pass = secrets.SMTP_PASSWORD;
    }
    
    // Twilio
    if (secrets.TWILIO_PHONENUMBER) {
      baselineConfig.twilio.phone = secrets.TWILIO_PHONENUMBER;
    }
    if (secrets.TWILIO_ACCOUNTSID) {
      baselineConfig.twilio.accountSid = secrets.TWILIO_ACCOUNTSID;
    }
    if (secrets.TWILIO_AUTHTOKEN) {
      baselineConfig.twilio.authToken = secrets.TWILIO_AUTHTOKEN;
    }
    if (secrets.TWILIO_VOICEURL) {
      baselineConfig.twilio.voiceUrl = secrets.TWILIO_VOICEURL;
    }
    
    // OpenAI
    if (secrets.OPENAI_API_KEY) {
      baselineConfig.openai.apiKey = secrets.OPENAI_API_KEY;
    }
    
    // Stripe
    if (secrets.STRIPE_SECRET_KEY) {
      baselineConfig.stripe.secretKey = secrets.STRIPE_SECRET_KEY;
      // Update mode based on the new key
      baselineConfig.stripe.mode = secrets.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live';
    }
    if (secrets.STRIPE_PUBLISHABLE_KEY) {
      baselineConfig.stripe.publishableKey = secrets.STRIPE_PUBLISHABLE_KEY;
    }
    
    // Add additional mappings as needed for other secret values
    
    return baselineConfig;
  } catch (err) {
    console.error('Error retrieving secret:', err.code, err.message);
    return baselineConfig;
  }
};

module.exports = baselineConfig;