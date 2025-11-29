// config/config.js
// Complete configuration file including Realtime API additions and restored production block

const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const logger = require('./logger'); // Assuming logger is available for loadSecrets
const { AwsContext } = require('twilio/lib/rest/accounts/v1/credential/aws');
const { buildAllConfigs, applyAllSecrets } = require('./domains');

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
  // Admin email for security alerts (breach notifications)
  ADMIN_EMAIL: Joi.string().email().description('Admin email address for security breach notifications'),
  // SES specific
  AWS_SES_REGION: Joi.string().description('AWS Region for SES (e.g., us-east-1)'),
  
  // SNS specific for emergency notifications
  EMERGENCY_SNS_TOPIC_ARN: Joi.string().description('SNS Topic ARN for emergency notifications'),
  
  // Domain configuration (single source of truth)
  PRIMARY_DOMAIN: Joi.string().description('Primary domain name (e.g., biancawellness.com). Used to construct URLs if not explicitly set.'),
  
  // Base URL configuration (should be set by Terraform, or constructed from PRIMARY_DOMAIN)
  API_BASE_URL: Joi.string().uri().description('Base API URL (e.g., https://api.biancawellness.com). If not set, constructed from PRIMARY_DOMAIN.'),
  BASE_URL: Joi.string().uri().description('Base URL (alternative to API_BASE_URL)'),
  FRONTEND_URL: Joi.string().uri().description('Frontend URL for email links (e.g., https://app.biancawellness.com). If not set, constructed from PRIMARY_DOMAIN.'),
  WEBSOCKET_URL: Joi.string().uri().description('WebSocket URL (e.g., wss://api.biancawellness.com). If not set, constructed from PRIMARY_DOMAIN.'),
  
  // Generic SMTP (can be used for Ethereal if manually configured, or other SMTP services)
  SMTP_HOST: Joi.string().description('SMTP host'),
  SMTP_PORT: Joi.number().description('SMTP port'),
  SMTP_USERNAME: Joi.string().description('SMTP username'),
  SMTP_PASSWORD: Joi.string().description('SMTP password'),
  SMTP_SECURE: Joi.boolean().description('Whether to use SMTPS (TLS direct)'),
  SMTP_REQUIRETLS: Joi.boolean().description('Whether to require STARTTLS'),
  // Note: SMTP_FROM was present in user's original, but EMAIL_FROM is now the primary 'from' address.

  TWILIO_PHONENUMBER: Joi.string(),
  TWILIO_ACCOUNTSID: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('staging', 'production'),
    then: Joi.string().optional(), // Allow missing in staging/production as it will be loaded from secrets
    otherwise: Joi.string().optional() // Optional in dev/test environments (can use placeholder values)
  }),
  TWILIO_AUTHTOKEN: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('staging', 'production'),
    then: Joi.string().optional(), // Allow missing in staging/production as it will be loaded from secrets
    otherwise: Joi.string().optional() // Optional in dev/test environments (can use placeholder values)
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
  STRIPE_SECRET_KEY: Joi.string().optional(),
  STRIPE_PUBLISHABLE_KEY: Joi.string().optional(),
  STRIPE_WEBHOOK_SECRET: Joi.string().optional(),
  MFA_ENCRYPTION_KEY: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('staging', 'production'),
    then: Joi.string().optional(), // Allow missing in staging/production as it will be loaded from secrets
    otherwise: Joi.string().optional() // Optional in dev/test environments (can use default for testing)
  }),
  // **NEW:** Realtime API specific variables
  OPENAI_REALTIME_MODEL: Joi.string().default('gpt-4o-realtime-preview-2024-12-17'),
  OPENAI_REALTIME_VOICE: Joi.string().default('alloy'),
  OPENAI_REALTIME_SESSION_CONFIG: Joi.string().default('{}'),
  OPENAI_IDLE_TIMEOUT: Joi.number().default(300000),
  OPENAI_MODEL: Joi.string().default('gpt-4o'),
  
  // Cache configuration (optional - defaults to in-memory)
  CACHE_TYPE: Joi.string().valid('memory', 'redis').default('memory'),
  REDIS_URL: Joi.string().optional(), // Redis connection URL (e.g., redis://endpoint:6379)
  REDIS_ENDPOINT: Joi.string().optional(), // Redis endpoint (alternative to REDIS_URL)
  REDIS_PORT: Joi.number().optional().default(6379),
  
  // PostHog Telemetry Configuration (HIPAA-compliant, self-hosted)
  POSTHOG_API_KEY: Joi.string().optional().description('PostHog API key for telemetry'),
  POSTHOG_HOST: Joi.string().uri().optional().description('PostHog host URL (self-hosted instance)'),
  TELEMETRY_ENABLED: Joi.boolean().default(false).description('Enable telemetry tracking'),
}).unknown();

// Validate environment variables
const { value: envVars, error } = envVarsSchema.validate(process.env, { errors: { label: 'key' } });
if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Helper function to construct URLs from primary domain
const getUrlFromDomain = (subdomain, domain, protocol = 'https') => {
  if (!domain) return null;
  return `${protocol}://${subdomain ? `${subdomain}.` : ''}${domain}`;
};

// Get primary domain (single source of truth)
const primaryDomain = envVars.PRIMARY_DOMAIN || 'biancawellness.com';

// Build a baseline configuration object based on environment variables
// Base configuration (not domain-specific)
const baselineConfig = {
  env: envVars.NODE_ENV,
  primaryDomain: primaryDomain,  // Expose primary domain in config,
  port: envVars.PORT,
  aws: {
    accessKeyId: envVars.AWS_SECRET_ID,
    secretAccessKey: envVars.AWS_SECRET_KEY,
    region: envVars.AWS_REGION || 'us-east-2',
    s3: {
      bucketName: 'bianca-audio-debug',
    },
  },
  authEnabled: true,
  baseUrl: envVars.API_BASE_URL || (envVars.NODE_ENV === 'development' ? `http://localhost:${envVars.PORT}` : (envVars.NODE_ENV === 'staging' ? getUrlFromDomain('staging-api', primaryDomain) : getUrlFromDomain('api', primaryDomain))),
  apiUrl: (envVars.API_BASE_URL || (envVars.NODE_ENV === 'development' ? `http://localhost:${envVars.PORT}` : (envVars.NODE_ENV === 'staging' ? getUrlFromDomain('staging-api', primaryDomain) : getUrlFromDomain('api', primaryDomain)))) + '/v1',
  frontendUrl: envVars.FRONTEND_URL || (envVars.NODE_ENV === 'development' ? 'http://localhost:8081' : (envVars.NODE_ENV === 'staging' ? getUrlFromDomain('staging', primaryDomain) : getUrlFromDomain('app', primaryDomain))),
  billing: { 
    ratePerMinute: 0.1,
    minimumBillableDuration: 30,
    enableDailyBilling: true,
    billingTime: '02:00',
    autoCharge: true,
    gracePeriodDays: 30
  },
  app: {
    rtpPortRange: process.env.APP_RTP_PORT_RANGE || '20002-30000'
  },
  audio: {
    noiseReduction: {
      noiseGateEnabled: process.env.AUDIO_NOISE_GATE_ENABLED !== 'false', // Default: true
      noiseGateThreshold: parseFloat(process.env.AUDIO_NOISE_GATE_THRESHOLD) || 0.1, // Default: 0.1 (10% energy)
      primarySpeakerEnabled: process.env.AUDIO_PRIMARY_SPEAKER_ENABLED === 'true', // Default: false
      primarySpeakerHistorySize: parseInt(process.env.AUDIO_PRIMARY_SPEAKER_HISTORY_SIZE) || 50, // Default: 50 packets (~1 second)
      primarySpeakerFocusThreshold: parseFloat(process.env.AUDIO_PRIMARY_SPEAKER_FOCUS_THRESHOLD) || 0.7, // Default: 0.7 (70% of max)
      primarySpeakerEnergyMultiplier: parseFloat(process.env.AUDIO_PRIMARY_SPEAKER_ENERGY_MULTIPLIER) || 1.5, // Default: 1.5x average
      primarySpeakerVolumeReduction: parseFloat(process.env.AUDIO_PRIMARY_SPEAKER_VOLUME_REDUCTION) || 0.3, // Default: 0.3 (30% volume for non-primary)
      adaptiveNoiseReductionEnabled: process.env.AUDIO_ADAPTIVE_NOISE_REDUCTION_ENABLED === 'true', // Default: false
    }
  },
  google: {
    language: 'en-US',
    name: 'en-US-News-L',
    gender: 'FEMALE',
    encoding: 'MP3'
  },
  multer: { dest: path.join(__dirname, '../../uploads') },
  telemetry: {
    enabled: envVars.TELEMETRY_ENABLED || false,
    posthog: {
      apiKey: envVars.POSTHOG_API_KEY,
      host: envVars.POSTHOG_HOST || 'http://posthog:8000', // Self-hosted PostHog. For cloud: https://us.i.posthog.com
    },
  },
  // Merge domain-specific configurations
  ...buildAllConfigs(envVars),
};

// Set production-specific overrides (Restored and updated)
if (envVars.NODE_ENV === 'production') {
  // Use environment variables set by Terraform, or construct from PRIMARY_DOMAIN
  const apiBaseUrl = envVars.API_BASE_URL || envVars.BASE_URL || getUrlFromDomain('api', primaryDomain);
  const internalDomain = primaryDomain.replace('.', '-');  // biancawellness.com -> biancawellness-com
  
  baselineConfig.baseUrl = apiBaseUrl;
  baselineConfig.apiUrl = `${apiBaseUrl}/v1`;
  baselineConfig.mongoose.url = envVars.MONGODB_URL || `mongodb://mongodb.${internalDomain}.internal:27017/bianca-app`;
  baselineConfig.email.smtp.secure = true;
  baselineConfig.twilio.apiUrl = apiBaseUrl;

  // **NEW/UPDATED:** Add necessary production overrides for WebSocket URL
  // Ensure this uses wss:// and points to your correct production WebSocket endpoint
  baselineConfig.twilio.websocketUrl = envVars.WEBSOCKET_URL || `wss://${apiBaseUrl.replace('https://', '')}`;

  // Ensure baseUrl is also correct for production if used elsewhere
  // Ensure Asterisk ARI URL points to the internal service discovery name in production
  baselineConfig.asterisk.enabled = true; // Always enable Asterisk
  baselineConfig.asterisk.host = envVars.ASTERISK_HOST || `asterisk.${internalDomain}.internal`;
  baselineConfig.asterisk.url = envVars.ASTERISK_URL || `http://${baselineConfig.asterisk.host}:8088`;
  baselineConfig.asterisk.rtpBiancaHost = envVars.RTP_BIANCA_HOST || `bianca-app.${internalDomain}.internal`;
  baselineConfig.asterisk.rtpAsteriskHost = envVars.RTP_ASTERISK_HOST || `asterisk.${internalDomain}.internal`;
}

// Set staging-specific overrides
if (envVars.NODE_ENV === 'staging') {
  // Use environment variables from docker-compose, or construct from PRIMARY_DOMAIN
  const apiBaseUrl = envVars.API_BASE_URL || getUrlFromDomain('staging-api', primaryDomain);
  
  baselineConfig.baseUrl = apiBaseUrl;
  baselineConfig.apiUrl = `${apiBaseUrl}/v1`;
  // On staging, frontend is at staging.biancawellness.com, API is at staging-api.biancawellness.com
  baselineConfig.frontendUrl = envVars.FRONTEND_URL || getUrlFromDomain('staging', primaryDomain);
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
    logger.info('Using Stripe keys from .env file for localhost/dev.');
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
    logger.info('Using Stripe keys from AWS Secrets Manager for staging/production.');

    // Update process.env first - important if other modules read directly from process.env
    // In staging/production, AWS secrets should override .env values
    for (const key in secrets) {
        // Override process.env with AWS secrets for staging/production
        // This ensures AWS secrets take precedence over .env values
        process.env[key] = secrets[key];
    }

    // Apply secrets using domain modules (this will override config with AWS secrets)
    applyAllSecrets(baselineConfig, secrets);
    
    // MFA Encryption Key (special case - sets process.env)
    if (secrets.MFA_ENCRYPTION_KEY) {
      process.env.MFA_ENCRYPTION_KEY = secrets.MFA_ENCRYPTION_KEY;
    }
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
