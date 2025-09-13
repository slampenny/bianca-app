// config/config.js
// Complete configuration file including Realtime API additions and restored production block

const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const logger = require('./logger'); // Assuming logger is available for loadSecrets
const { AwsContext } = require('twilio/lib/rest/accounts/v1/credential/aws');

// Load .env file (if present)
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Define the environment variable schema, including new variables
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string().valid('production', 'development', 'test', 'staging').required(),
  JWT_SECRET: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('staging', 'production'),
    then: Joi.string().optional(), // Allow missing in staging/production as it will be loaded from secrets
    otherwise: Joi.string().required() // Required in dev/test environments
  }),
  MONGODB_URL: Joi.string(),

  ARI_PASSWORD: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('staging', 'production'),
    then: Joi.string().optional(), // Allow missing in staging/production as it will be loaded from secrets
    otherwise: Joi.string().optional() // Optional in dev/test environments
  }),
  BIANCA_PASSWORD: Joi.string(),
  ASTERISK_URL: Joi.string(),
  EXTERNAL_ADDRESS: Joi.string(),
  EXTERNAL_PORT: Joi.number(),

  // --- Email Variables ---
  // Primary 'from' address for all emails
  EMAIL_FROM: Joi.string().email().description('Default "from" email address for all outgoing emails'),
  // SES specific
  AWS_SES_REGION: Joi.string().description('AWS Region for SES (e.g., us-east-1)'),
  
  // SNS specific for emergency notifications
  EMERGENCY_SNS_TOPIC_ARN: Joi.string().description('SNS Topic ARN for emergency notifications'),
  
  // Base URL configuration (should be set by Terraform)
  API_BASE_URL: Joi.string().uri().description('Base API URL (e.g., https://api.myphonefriend.com)'),
  BASE_URL: Joi.string().uri().description('Base URL (alternative to API_BASE_URL)'),
  FRONTEND_URL: Joi.string().uri().description('Frontend URL for email links (e.g., https://app.myphonefriend.com)'),
  WEBSOCKET_URL: Joi.string().uri().description('WebSocket URL (e.g., wss://api.myphonefriend.com)'),
  
  // Generic SMTP (can be used for Ethereal if manually configured, or other SMTP services)
  SMTP_HOST: Joi.string().description('SMTP host'),
  SMTP_PORT: Joi.number().description('SMTP port'),
  SMTP_USERNAME: Joi.string().description('SMTP username'),
  SMTP_PASSWORD: Joi.string().description('SMTP password'),
  SMTP_SECURE: Joi.boolean().description('Whether to use SMTPS (TLS direct)'),
  SMTP_REQUIRETLS: Joi.boolean().description('Whether to require STARTTLS'),
  // Note: SMTP_FROM was present in user's original, but EMAIL_FROM is now the primary 'from' address.

  TWILIO_PHONENUMBER: Joi.string(),
  TWILIO_ACCOUNTSID: Joi.string().required(),
  TWILIO_AUTHTOKEN: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('staging', 'production'),
    then: Joi.string().optional(), // Allow missing in staging/production as it will be loaded from secrets
    otherwise: Joi.string().required() // Required in dev/test environments
  }),
  TWILIO_VOICEURL: Joi.string(), // Keep if used elsewhere
  PUBLIC_TUNNEL_URL: Joi.string(), // Used for twilio.apiUrl in dev/testing
  API_BASE_URL: Joi.string(), // Alternative base URL for APIs/webhooks
  AWS_SECRET_ID: Joi.string(), // Added for consistency
  AWS_REGION: Joi.string(), // Added for consistency
  PORT: Joi.number().default(3000), // Added for consistency
  OPENAI_API_KEY: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('staging', 'production'),
    then: Joi.string().optional(), // Allow missing in staging/production as it will be loaded from secrets
    otherwise: Joi.string().optional() // Optional in dev/test environments
  }),
  STRIPE_SECRET_KEY: Joi.string(),
  STRIPE_PUBLISHABLE_KEY: Joi.string(),
  // **NEW:** Realtime API specific variables
  OPENAI_REALTIME_MODEL: Joi.string().default('gpt-4o-realtime-preview-2024-12-17'),
  OPENAI_REALTIME_VOICE: Joi.string().default('alloy'),
  OPENAI_REALTIME_SESSION_CONFIG: Joi.string().default('{}'),
  OPENAI_IDLE_TIMEOUT: Joi.number().default(300000),
  OPENAI_MODEL: Joi.string().default('gpt-4o'),
  WEBSOCKET_URL: Joi.string().default('wss://api.myphonefriend.com'), // URL your WebSocket server listens on
}).unknown();

// Validate environment variables
const { value: envVars, error } = envVarsSchema.validate(process.env, { errors: { label: 'key' } });
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const defaultAsteriskHost = envVars.ASTERISK_HOST || 'asterisk';

// Build a baseline configuration object based on environment variables
const baselineConfig = {
  env: envVars.NODE_ENV,
  port: envVars.PORT, // Use validated PORT
  aws: {
    accessKeyId: envVars.AWS_SECRET_ID,
    secretAccessKey: envVars.AWS_SECRET_KEY, // Optional, if using AWS SDK directly
    region: envVars.AWS_REGION || 'us-east-2', // Default to us-east-2 if not set
    s3: {
      bucketName: 'bianca-audio-debug', // Example S3 bucket for audio files
    },
  },
  authEnabled: true, // Assuming auth is generally enabled
  baseUrl: envVars.API_BASE_URL || `http://localhost:${envVars.PORT}`, // Default base URL
  apiUrl: (envVars.API_BASE_URL || `http://localhost:${envVars.PORT}`) + '/v1', // Default API URL
  frontendUrl: envVars.FRONTEND_URL || 'https://app.myphonefriend.com', // Frontend URL for invite links
  mongoose: {
    url: (envVars.MONGODB_URL || 'mongodb://localhost:27017/bianca-app') + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: 30000,           // How long to wait for initial connection
      socketTimeoutMS: 60000,            // How long to wait on operations after connection
      keepAlive: true,                   // Enable TCP keep-alive
      keepAliveInitialDelay: 300000,     // Wait 5 min before first keepalive ping
      maxPoolSize: 10,                   // Allow for more concurrent queries (esp. during seed)
      retryWrites: true,                 // Safe to retry inserts on transient network errors
      w: 'majority'                      // Write concern for retryWrites
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
    ses: { // Configuration for AWS SES (used in production/test by email.service.js)
      region: envVars.AWS_SES_REGION || envVars.AWS_REGION || 'us-east-2', // Default to AWS_REGION if AWS_SES_REGION not set
    },
    sns: { // Configuration for AWS SNS (used for emergency notifications)
      region: envVars.AWS_REGION || 'us-east-2',
      topicArn: envVars.EMERGENCY_SNS_TOPIC_ARN,
    },
    smtp: { // Fallback or alternative SMTP settings (Ethereal in dev is handled by createTestAccount)
      host: envVars.SMTP_HOST, // Example: 'smtp.ethereal.email' if you want to pin it
      port: envVars.SMTP_PORT,
      secure: envVars.SMTP_SECURE === true, // Coerce to boolean, default false if undefined
      requireTLS: envVars.SMTP_REQUIRETLS === true, // Coerce to boolean, default false if undefined
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM || 'support@myphonefriend.com', // Primary 'from' address
  },
  app: {
    rtpPortRange: process.env.APP_RTP_PORT_RANGE || '20002-30000'
  },
  asterisk: {
    maxRetries: process.env.ARI_MAX_RETRIES || 10,
    retryDelay: process.env.ARI_RETRY_DELAY || 3000,
    maxRetryDelay: process.env.ARI_MAX_RETRY_DELAY || 30000,
    operationTimeout: process.env.ARI_OPERATION_TIMEOUT || 30000,

    enabled: envVars.ASTERISK_ENABLED, // Assuming this is disabled by default
    host: defaultAsteriskHost, // Example URL, replace with actual
    url: `http://${defaultAsteriskHost}:8088`, // Example URL, replace with actual
    rtpBiancaHost: envVars.RTP_BIANCA_HOST || 'bianca-app', // Example RTP URL, replace with actual
    rtpAsteriskHost: envVars.RTP_ASTERISK_HOST || 'asterisk', // Example RTP sender URL, replace with actual
    externalPort: envVars.EXTERNAL_PORT || 5061, // Example port, replace with actual
    sipUserName: envVars.SIP_USER_NAME || 'bianca', // Example SIP username, replace with actual
    username: envVars.ASTERISK_USERNAME || 'myphonefriend', // Example username, replace with actual
    password: envVars.ARI_PASSWORD
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
    realtimeVoice: envVars.OPENAI_REALTIME_VOICE || 'alloy',
    realtimeSessionConfig: envVars.OPENAI_REALTIME_SESSION_CONFIG || {},
    idleTimeout: envVars.OPENAI_IDLE_TIMEOUT || 300000, // 5 minutes default
    model: envVars.OPENAI_MODEL || 'gpt-4o',
    debugAudio: true, // Enable debug audio for testing
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
  // Use environment variables set by Terraform
  const apiBaseUrl = envVars.API_BASE_URL || envVars.BASE_URL || 'https://api.myphonefriend.com';
  
  baselineConfig.baseUrl = apiBaseUrl;
  baselineConfig.apiUrl = `${apiBaseUrl}/v1`;
  baselineConfig.mongoose.url = envVars.MONGODB_URL || 'mongodb://mongodb.myphonefriend.internal:27017/bianca-app';
  baselineConfig.email.smtp.secure = true;
  baselineConfig.twilio.apiUrl = apiBaseUrl;

  // **NEW/UPDATED:** Add necessary production overrides for WebSocket URL
  // Ensure this uses wss:// and points to your correct production WebSocket endpoint
  baselineConfig.twilio.websocketUrl = envVars.WEBSOCKET_URL || `wss://${apiBaseUrl.replace('https://', '')}`;

  // Ensure baseUrl is also correct for production if used elsewhere
  // Ensure Asterisk ARI URL points to the internal service discovery name in production
  baselineConfig.asterisk.enabled = true; // Always enable Asterisk
  baselineConfig.asterisk.host = envVars.ASTERISK_HOST || `asterisk.myphonefriend.internal`;
  baselineConfig.asterisk.url = envVars.ASTERISK_URL || `http://${baselineConfig.asterisk.host}:8088`;
  baselineConfig.asterisk.rtpBiancaHost = envVars.RTP_BIANCA_HOST || `bianca-app.myphonefriend.internal`;
  baselineConfig.asterisk.rtpAsteriskHost = envVars.RTP_ASTERISK_HOST || `asterisk.myphonefriend.internal`;
}

// Set staging-specific overrides
if (envVars.NODE_ENV === 'staging') {
  // Use environment variables from docker-compose
  const apiBaseUrl = envVars.API_BASE_URL || 'https://staging-api.myphonefriend.com';
  
  baselineConfig.baseUrl = apiBaseUrl;
  baselineConfig.apiUrl = `${apiBaseUrl}/v1`;
  baselineConfig.frontendUrl = envVars.FRONTEND_URL || 'https://staging.myphonefriend.com';
  baselineConfig.mongoose.url = envVars.MONGODB_URL || 'mongodb://mongodb:27017/bianca-service';
  baselineConfig.email.smtp.secure = true;
  baselineConfig.twilio.apiUrl = apiBaseUrl;
  baselineConfig.twilio.websocketUrl = envVars.WEBSOCKET_URL || `wss://${apiBaseUrl.replace('https://', '')}`;
}

// Add method to load secrets from AWS Secrets Manager (if used)
baselineConfig.loadSecrets = async () => {
  // Skip in development and test, but load for staging and production
  if (baselineConfig.env === 'development' || baselineConfig.env === 'test') {
    logger.info('Skipping AWS Secrets Manager in development/test environment.');
    return baselineConfig;
  }

  // Use the same production secrets for staging (real API keys, etc.)
  const secretId = process.env.AWS_SECRET_ID || 'MySecretsManagerSecret';
  const region = process.env.AWS_REGION || 'us-east-2'; // Use env var for region

  try {
    logger.info(`Attempting to load secrets from AWS Secrets Manager (Region: ${region}, SecretId: ${secretId})`);
    // Create an SDK v3 SecretsManagerClient instance
    const client = new SecretsManagerClient({ region: region });
    
    // Create the command
    const command = new GetSecretValueCommand({ SecretId: secretId });
    
    // Send the command
    const data = await client.send(command);

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

    // Email secrets
    if (secrets.EMAIL_FROM) baselineConfig.email.from = secrets.EMAIL_FROM;
    if (secrets.AWS_SES_REGION) baselineConfig.email.ses.region = secrets.AWS_SES_REGION;
    // Load SMTP specific secrets if they exist and are used for other purposes
    if (secrets.SMTP_HOST) baselineConfig.email.smtp.host = secrets.SMTP_HOST;
    if (secrets.SMTP_PORT) baselineConfig.email.smtp.port = secrets.SMTP_PORT;
    if (secrets.SMTP_USERNAME) baselineConfig.email.smtp.auth.user = secrets.SMTP_USERNAME;
    if (secrets.SMTP_PASSWORD) baselineConfig.email.smtp.auth.pass = secrets.SMTP_PASSWORD;
    if (typeof secrets.SMTP_SECURE !== 'undefined') baselineConfig.email.smtp.secure = secrets.SMTP_SECURE;
    if (typeof secrets.SMTP_REQUIRETLS !== 'undefined') baselineConfig.email.smtp.requireTLS = secrets.SMTP_REQUIRETLS;


    // Asterisk secrets
    baselineConfig.asterisk.enabled = true; // Always enable Asterisk
    if (secrets.ASTERISK_ARI_URL) baselineConfig.asterisk.url = secrets.ASTERISK_ARI_URL; // Use a specific ARI URL from secrets
    else if (secrets.ASTERISK_HOST) baselineConfig.asterisk.url = `http://${secrets.ASTERISK_HOST}:8088`;
    if (secrets.RTP_BIANCA_HOST) baselineConfig.asterisk.rtpBiancaHost = secrets.RTP_BIANCA_HOST;
    // ... other Asterisk secrets like ARI username/password if stored in secrets
    if (secrets.ASTERISK_USERNAME) baselineConfig.asterisk.username = secrets.ASTERISK_USERNAME;
    if (secrets.ARI_PASSWORD) baselineConfig.asterisk.password = secrets.ARI_PASSWORD; // Assuming ARI_PASSWORD is for ARI user

    if (secrets.JWT_SECRET) baselineConfig.jwt.secret = secrets.JWT_SECRET;
    // Email
    if (secrets.SMTP_USERNAME) baselineConfig.email.smtp.auth.user = secrets.SMTP_USERNAME;
    if (secrets.SMTP_PASSWORD) baselineConfig.email.smtp.auth.pass = secrets.SMTP_PASSWORD;
    if (secrets.SMTP_HOST) baselineConfig.email.smtp.host = secrets.SMTP_HOST;
    if (secrets.SMTP_PORT) baselineConfig.email.smtp.port = secrets.SMTP_PORT;
    if (secrets.SMTP_FROM) baselineConfig.email.from = secrets.SMTP_FROM;
    if (typeof secrets.SMTP_SECURE !== 'undefined') baselineConfig.email.smtp.secure = secrets.SMTP_SECURE;
    if (typeof secrets.SMTP_REQUIRETLS !== 'undefined') baselineConfig.email.smtp.requireTLS = secrets.SMTP_REQUIRETLS;
    // Twilio - Phone number comes from environment variables, not secrets
    // if (secrets.TWILIO_PHONENUMBER) baselineConfig.twilio.phone = secrets.TWILIO_PHONENUMBER;
    if (secrets.TWILIO_ACCOUNTSID) baselineConfig.twilio.accountSid = secrets.TWILIO_ACCOUNTSID;
    if (secrets.TWILIO_AUTHTOKEN) baselineConfig.twilio.authToken = secrets.TWILIO_AUTHTOKEN;
    if (secrets.TWILIO_VOICEURL) baselineConfig.twilio.voiceUrl = secrets.TWILIO_VOICEURL; // If still used
    // URLs should come from environment variables set by Terraform, not secrets
    // if (secrets.API_BASE_URL) { 
    //     baselineConfig.twilio.apiUrl = secrets.API_BASE_URL;
    //     baselineConfig.baseUrl = secrets.API_BASE_URL;
    //     baselineConfig.apiUrl = secrets.API_BASE_URL + '/v1';
    // }
    // if (secrets.WEBSOCKET_URL) baselineConfig.twilio.websocketUrl = secrets.WEBSOCKET_URL;
    // OpenAI
    if (secrets.OPENAI_API_KEY) baselineConfig.openai.apiKey = secrets.OPENAI_API_KEY;
    //if (secrets.OPENAI_REALTIME_MODEL) baselineConfig.openai.realtimeModel = secrets.OPENAI_REALTIME_MODEL; // Load Realtime model from secrets
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
