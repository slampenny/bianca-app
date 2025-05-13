// config/config.js
// Complete configuration file including Realtime API additions and restored production block

const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');
const AWS = require('aws-sdk');
const logger = require('./logger'); // Assuming logger is available for loadSecrets

// Load .env file (if present)
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Define the environment variable schema, including new variables
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
  JWT_SECRET: Joi.string(),
  MONGODB_URL: Joi.string(),

  ARI_PASSWORD: Joi.string(),
  BIANCA_PASSWORD: Joi.string(),
  ASTERISK_URL: Joi.string(),
  EXTERNAL_ADDRESS: Joi.string(),
  EXTERNAL_PORT: Joi.number(),

  SMTP_USERNAME: Joi.string(),
  SMTP_PASSWORD: Joi.string(),
  SMTP_HOST: Joi.string(), // Added for consistency
  SMTP_PORT: Joi.number(), // Added for consistency
  SMTP_SECURE: Joi.boolean(), // Added for consistency
  SMTP_REQUIRETLS: Joi.boolean(), // Added for consistency
  SMTP_FROM: Joi.string(), // Added for consistency
  TWILIO_PHONENUMBER: Joi.string(),
  TWILIO_ACCOUNTSID: Joi.string().required(),
  TWILIO_AUTHTOKEN: Joi.string().required(),
  TWILIO_VOICEURL: Joi.string(), // Keep if used elsewhere
  PUBLIC_TUNNEL_URL: Joi.string(), // Used for twilio.apiUrl in dev/testing
  WEBSOCKET_URL: Joi.string(), // WebSocket URL for Twilio Media Streams
  API_BASE_URL: Joi.string(), // Alternative base URL for APIs/webhooks
  AWS_SECRET_ID: Joi.string(), // Added for consistency
  AWS_REGION: Joi.string(), // Added for consistency
  PORT: Joi.number().default(3000), // Added for consistency
  OPENAI_API_KEY: Joi.string(),
  STRIPE_SECRET_KEY: Joi.string(),
  STRIPE_PUBLISHABLE_KEY: Joi.string(),
  // **NEW:** Realtime API specific variables
  OPENAI_REALTIME_MODEL: Joi.string().default('gpt-4o-realtime-preview-2024-12-17'),
  WEBSOCKET_URL: Joi.string().default('wss://app.myphonefriend.com'), // URL your WebSocket server listens on
}).unknown();

// Validate environment variables
const { value: envVars, error } = envVarsSchema.validate(process.env, { errors: { label: 'key' } });
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Build a baseline configuration object based on environment variables
const baselineConfig = {
  env: envVars.NODE_ENV,
  port: envVars.PORT, // Use validated PORT
  authEnabled: true, // Assuming auth is generally enabled
  baseUrl: envVars.API_BASE_URL || `http://localhost:${envVars.PORT}`, // Default base URL
  apiUrl: (envVars.API_BASE_URL || `http://localhost:${envVars.PORT}`) + '/v1', // Default API URL
  mongoose: {
    url: (envVars.MONGODB_URL || 'mongodb://localhost:27017/bianca-app') + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      // useCreateIndex: true, // Deprecated
      // useNewUrlParser: true, // Default in new Mongoose versions
      // useUnifiedTopology: true // Default in new Mongoose versions
    }
  },
  billing: { ratePerMinute: 0.1 }, // Example billing rate
  jwt: {
    secret: envVars.JWT_SECRET || 'default-secret-please-change', // Provide a default or ensure it's set via env/secrets
    accessExpirationMinutes: 30,
    refreshExpirationDays: 30,
    resetPasswordExpirationMinutes: 10,
    verifyEmailExpirationMinutes: 10,
    inviteExpirationMinutes: 10080 // 7 days
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST || 'smtp.ethereal.email', // Use env var or default
      port: envVars.SMTP_PORT || 587, // Use env var or default
      secure: envVars.SMTP_SECURE === true || false, // Default to false unless explicitly true via env
      requireTLS: envVars.SMTP_REQUIRETLS === true || true, // Default to true unless explicitly false via env
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD
      }
    },
    from: envVars.SMTP_FROM || 'support@myphonefriend.com' // Use env var or default
  },
  asterisk: {
    enabled: envVars.ASTERISK_ENABLED, // Assuming this is disabled by default
    url: envVars.ASTERISK_URL || 'http://asterisk:8088', // Example URL, replace with actual
    externalPort: envVars.EXTERNAL_PORT || 5061, // Example port, replace with actual
    sipUserName: envVars.SIP_USER_NAME || 'bianca', // Example SIP username, replace with actual
    username: envVars.ASTERISK_USERNAME || 'myphonefriend', // Example username, replace with actual
    password: envVars.BIANCA_PASSWORD
  },
  google: { // Assuming this was for Google TTS, keep if used elsewhere
    language: 'en-US',
    name: 'en-US-News-L',
    gender: 'FEMALE',
    encoding: 'MP3'
  },
  multer: { dest: path.join(__dirname, '../../uploads') }, // File upload destination
  twilio: {
    phone: envVars.TWILIO_PHONENUMBER,
    // Use PUBLIC_TUNNEL_URL primarily for local dev webhook testing, otherwise use API_BASE_URL
    // This determines the URL Twilio calls back to for webhooks.
    apiUrl: envVars.PUBLIC_TUNNEL_URL || envVars.API_BASE_URL || `http://localhost:${envVars.PORT}`,
    accountSid: envVars.TWILIO_ACCOUNTSID,
    authToken: envVars.TWILIO_AUTHTOKEN,
    playbackUrl: 'https://default-playback-url.com', // Keep if used elsewhere
    // **NEW:** WebSocket URL for your backend server handling Twilio Media Streams
    // Ensure this includes the protocol (wss:// for secure production/tunnels, ws:// for local insecure)
    websocketUrl: envVars.WEBSOCKET_URL,
  },
  openai: {
    apiKey: envVars.OPENAI_API_KEY,
    // **NEW:** Realtime model used for the live interaction via WebSocket
    realtimeModel: envVars.OPENAI_REALTIME_MODEL,
  },
  stripe: {
    secretKey: envVars.STRIPE_SECRET_KEY,
    publishableKey: envVars.STRIPE_PUBLISHABLE_KEY,
    // Determine Stripe mode based on key prefix
    mode: envVars.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'live'
  }
};

// Set production-specific overrides (Restored and updated)
if (envVars.NODE_ENV === 'production') {
  // Restore user's original production overrides
  
  baselineConfig.baseUrl = 'https://app.myphonefriend.com'; // Example - VERIFY
  baselineConfig.apiUrl = `${baselineConfig.baseUrl}/v1`; // User's original value
  baselineConfig.mongoose.url = 'mongodb://localhost:27017/bianca-app'; // User's original value
  baselineConfig.email.smtp.secure = true; // User's original value
  baselineConfig.twilio.apiUrl = baselineConfig.baseUrl; // User's original value (Ensure this is HTTPS)

  // **NEW/UPDATED:** Add necessary production overrides for WebSocket URL
  // Ensure this uses wss:// and points to your correct production WebSocket endpoint
  baselineConfig.twilio.websocketUrl = 'wss://app.myphonefriend.com'; // Example - **VERIFY THIS URL**
  baselineConfig.asterisk.url = 'http://sip.myphonefriend.com:8088'; // Example - **VERIFY THIS URL**

  // Ensure baseUrl is also correct for production if used elsewhere
}

// Add method to load secrets from AWS Secrets Manager (if used)
baselineConfig.loadSecrets = async () => {
  // Skip in non-production environments or if AWS SDK isn't configured/needed
  if (baselineConfig.env !== 'production') {
    logger.info('Skipping AWS Secrets Manager in non-production environment.');
    return baselineConfig;
  }

  const secretId = process.env.AWS_SECRET_ID || 'MySecretsManagerSecret'; // Use env var for secret name
  const region = process.env.AWS_REGION || 'us-east-2'; // Use env var for region

  try {
    logger.info(`Attempting to load secrets from AWS Secrets Manager (Region: ${region}, SecretId: ${secretId})`);
    const client = new AWS.SecretsManager({ region: region });
    const data = await client.getSecretValue({ SecretId: secretId }).promise();

    if (!data.SecretString) {
        logger.warn(`SecretString is empty for SecretId: ${secretId}`);
        return baselineConfig;
    }

    const secrets = JSON.parse(data.SecretString);
    logger.info(`Successfully loaded secrets from AWS Secrets Manager.`);

    // Update process.env first - important if other modules read directly from process.env
    // Be cautious about overriding existing env vars if not intended
    for (const key in secrets) {
        if (!(key in process.env)) { // Optional: only set if not already set by system env
            process.env[key] = secrets[key];
        }
    }

    // Update baselineConfig with specific mappings, preferring secrets over initial envVars
    // JWT
    if (secrets.JWT_SECRET) baselineConfig.jwt.secret = secrets.JWT_SECRET;
    // Email
    if (secrets.SMTP_USERNAME) baselineConfig.email.smtp.auth.user = secrets.SMTP_USERNAME;
    if (secrets.SMTP_PASSWORD) baselineConfig.email.smtp.auth.pass = secrets.SMTP_PASSWORD;
    if (secrets.SMTP_HOST) baselineConfig.email.smtp.host = secrets.SMTP_HOST;
    if (secrets.SMTP_PORT) baselineConfig.email.smtp.port = secrets.SMTP_PORT;
    if (secrets.SMTP_FROM) baselineConfig.email.from = secrets.SMTP_FROM;
    if (typeof secrets.SMTP_SECURE !== 'undefined') baselineConfig.email.smtp.secure = secrets.SMTP_SECURE;
    if (typeof secrets.SMTP_REQUIRETLS !== 'undefined') baselineConfig.email.smtp.requireTLS = secrets.SMTP_REQUIRETLS;
    // Twilio
    if (secrets.TWILIO_PHONENUMBER) baselineConfig.twilio.phone = secrets.TWILIO_PHONENUMBER;
    if (secrets.TWILIO_ACCOUNTSID) baselineConfig.twilio.accountSid = secrets.TWILIO_ACCOUNTSID;
    if (secrets.TWILIO_AUTHTOKEN) baselineConfig.twilio.authToken = secrets.TWILIO_AUTHTOKEN;
    if (secrets.TWILIO_VOICEURL) baselineConfig.twilio.voiceUrl = secrets.TWILIO_VOICEURL; // If still used
    // Ensure production apiUrl and websocketUrl are loaded from secrets if available, overriding the hardcoded production values
    // if (secrets.API_BASE_URL) { // Assuming secret name matches env var name
    //     baselineConfig.twilio.apiUrl = secrets.API_BASE_URL;
    //     baselineConfig.baseUrl = secrets.API_BASE_URL;
    //     baselineConfig.apiUrl = secrets.API_BASE_URL + '/v1';
    // }
    //if (secrets.WEBSOCKET_URL) baselineConfig.twilio.websocketUrl = secrets.WEBSOCKET_URL; // Load WS URL from secrets
    // OpenAI
    if (secrets.OPENAI_API_KEY) baselineConfig.openai.apiKey = secrets.OPENAI_API_KEY;
    if (secrets.OPENAI_REALTIME_MODEL) baselineConfig.openai.realtimeModel = secrets.OPENAI_REALTIME_MODEL; // Load Realtime model from secrets
    // Stripe
    if (secrets.STRIPE_SECRET_KEY) {
      baselineConfig.stripe.secretKey = secrets.STRIPE_SECRET_KEY;
      baselineConfig.stripe.mode = secrets.STRIPE_SECRET_KEY.startsWith('sk_test_') ? 'test' : 'live';
    }
    if (secrets.STRIPE_PUBLISHABLE_KEY) baselineConfig.stripe.publishableKey = secrets.STRIPE_PUBLISHABLE_KEY;
    // Mongoose URL
    // if (secrets.MONGODB_URL) {
    //     baselineConfig.mongoose.url = secrets.MONGODB_URL + (baselineConfig.env === 'test' ? '-test' : '');
    // }
    // // Port
    // if (secrets.PORT) baselineConfig.port = secrets.PORT;


    // Add other mappings as needed...
    logger.info('Configuration updated with values from AWS Secrets Manager.');
    return baselineConfig;
  } catch (err) {
    // Log error but return baseline config to allow app to potentially start with defaults/env vars
    logger.error(`Error retrieving secret from AWS Secrets Manager (SecretId: ${secretId}): ${err.code} - ${err.message}`);
    return baselineConfig;
  }
};

// Export the configuration object
module.exports = baselineConfig;
