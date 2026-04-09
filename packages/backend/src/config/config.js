// config/config.js
// Complete configuration file including Realtime API additions and restored production block

const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const logger = require('./logger'); // Assuming logger is available for loadSecrets
const { AwsContext } = require('twilio/lib/rest/accounts/v1/credential/aws');
const { buildAllConfigs, applyAllSecrets } = require('./domains');

// Load .env file only in development and test. In staging/production we use process.env (CodeBuild/Docker) + AWS Secrets only.
const nodeEnv = process.env.NODE_ENV;
if (nodeEnv === 'development' || nodeEnv === 'test' || !nodeEnv) {
  const nodeEnvBeforeDotenv = process.env.NODE_ENV;
  dotenv.config({ path: path.join(__dirname, '../../.env'), override: false });
  if (nodeEnvBeforeDotenv && process.env.NODE_ENV !== nodeEnvBeforeDotenv) {
    logger.warn(`[Config] dotenv tried to override NODE_ENV from "${nodeEnvBeforeDotenv}" to "${process.env.NODE_ENV}". Restoring original value.`);
    process.env.NODE_ENV = nodeEnvBeforeDotenv;
  }
} else {
  // staging / production: do not load .env; use only process.env and AWS Secrets Manager
  if (nodeEnv === 'staging' || nodeEnv === 'production') {
    logger.info(`[Config] NODE_ENV=${nodeEnv}: skipping .env file; using process.env and AWS Secrets only.`);
  }
}

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
  ADMIN_FRONTEND_URL: Joi.string()
    .uri()
    .description(
      'Optional override for super-admin console origin (like FRONTEND_URL for facility web). If unset, config.adminFrontendUrl is built from PRIMARY_DOMAIN + NODE_ENV in this file.'
    ),
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
  /** Outbound/inbound voice: twilio (default) | telnyx (stub until implemented) */
  VOICE_TELEPHONY_PROVIDER: Joi.string().valid('twilio', 'telnyx').optional(),
  /** Outbound SMS: twilio (default) | sns (Amazon SNS Publish to phone) */
  SMS_PROVIDER: Joi.string().valid('twilio', 'sns').optional(),
  SMS_SNS_REGION: Joi.string().optional(),
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
  APP_STORE_REVIEW_PASSWORD: Joi.string().when('NODE_ENV', {
    is: Joi.string().valid('staging', 'production'),
    then: Joi.string().optional(), // Allow missing in staging/production as it will be loaded from secrets
    otherwise: Joi.string().optional() // Optional in dev/test environments
  }),
  // Google OAuth credentials
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().optional(),
  // Microsoft OAuth credentials
  MICROSOFT_CLIENT_ID: Joi.string().optional(),
  MICROSOFT_CLIENT_SECRET: Joi.string().optional(),
  MICROSOFT_TENANT_ID: Joi.string().optional(),
  // **NEW:** Realtime API specific variables
  // Always uses GA API ('gpt-realtime' model) - old Beta/preview models are offline
  // Can be overridden via OPENAI_REALTIME_MODEL env var
  OPENAI_REALTIME_MODEL: Joi.string().optional(),
  OPENAI_REALTIME_VOICE: Joi.string().default('alloy'),
  OPENAI_REALTIME_SESSION_CONFIG: Joi.string().default('{}'),
  // 0 = no idle disconnect (calls run until hangup). Set ms to re-enable (e.g. 300000).
  OPENAI_IDLE_TIMEOUT: Joi.number().default(0),
  OPENAI_MODEL: Joi.string().default('gpt-4o-2025-01-12'),
  // Transcription model: 'gpt-4o-mini-transcribe' (latest, faster) or 'gpt-4o-transcribe' (higher accuracy) or 'whisper-1' (legacy)
  OPENAI_REALTIME_TRANSCRIPTION_MODEL: Joi.string().default('gpt-4o-mini-transcribe'),
  /** Set to "true" so OpenAI server_vad auto response.create on turn end (A/B vs our scheduler). Default unset = false in code. */
  OPENAI_REALTIME_VAD_CREATE_RESPONSE: Joi.string().valid('true', 'false').optional(),
  
  // Cache configuration (optional - defaults to in-memory)
  CACHE_TYPE: Joi.string().valid('memory', 'redis').default('memory'),
  REDIS_URL: Joi.string().optional(), // Redis connection URL (e.g., redis://endpoint:6379)
  REDIS_ENDPOINT: Joi.string().optional(), // Redis endpoint (alternative to REDIS_URL)
  REDIS_PORT: Joi.number().optional().default(6379),

  /** If set, GET /metrics requires Authorization: Bearer <token> in production and staging */
  METRICS_SCRAPE_TOKEN: Joi.string().optional().allow(''),
  
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
// CRITICAL: Always use process.env.NODE_ENV directly to ensure runtime value is used
// This prevents issues where .env file or cached values might be used instead of container env vars

// Store a private env value that can be overridden (for tests)
// But by default, always read from process.env.NODE_ENV at runtime
let _envOverride = null;

const baselineConfig = {
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
  // Facility web + super-admin SPA: defaults live here (no .env required). FRONTEND_URL / ADMIN_FRONTEND_URL override when set.
  frontendUrl: envVars.FRONTEND_URL || (envVars.NODE_ENV === 'development' || envVars.NODE_ENV === 'test' ? 'http://localhost:8082' : (envVars.NODE_ENV === 'staging' ? getUrlFromDomain('staging', primaryDomain) : getUrlFromDomain('app', primaryDomain))),
  adminFrontendUrl:
    envVars.ADMIN_FRONTEND_URL ||
    (envVars.NODE_ENV === 'development' || envVars.NODE_ENV === 'test'
      ? 'http://localhost:5174'
      : envVars.NODE_ENV === 'staging'
        ? getUrlFromDomain('staging-admin', primaryDomain)
        : getUrlFromDomain('admin', primaryDomain)),
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
      frequencyFilteringEnabled: process.env.AUDIO_FREQUENCY_FILTERING_ENABLED !== 'false', // Default: true (Stage 2: band-pass filter 300-3400Hz) - can be disabled with AUDIO_FREQUENCY_FILTERING_ENABLED=false
      frequencyFilterLowCutoff: parseInt(process.env.AUDIO_FREQUENCY_FILTER_LOW_CUTOFF) || 300, // Default: 300Hz
      frequencyFilterHighCutoff: parseInt(process.env.AUDIO_FREQUENCY_FILTER_HIGH_CUTOFF) || 3400, // Default: 3400Hz
      primarySpeakerEnabled: process.env.AUDIO_PRIMARY_SPEAKER_ENABLED === 'true', // Default: false
      primarySpeakerHistorySize: parseInt(process.env.AUDIO_PRIMARY_SPEAKER_HISTORY_SIZE) || 50, // Default: 50 packets (~1 second)
      primarySpeakerFocusThreshold: parseFloat(process.env.AUDIO_PRIMARY_SPEAKER_FOCUS_THRESHOLD) || 0.7, // Default: 0.7 (70% of max)
      primarySpeakerEnergyMultiplier: parseFloat(process.env.AUDIO_PRIMARY_SPEAKER_ENERGY_MULTIPLIER) || 1.5, // Default: 1.5x average
      primarySpeakerVolumeReduction: parseFloat(process.env.AUDIO_PRIMARY_SPEAKER_VOLUME_REDUCTION) || 0.3, // Default: 0.3 (30% volume for non-primary)
      adaptiveNoiseReductionEnabled: process.env.AUDIO_ADAPTIVE_NOISE_REDUCTION_ENABLED === 'true', // Default: false (Stage 4)
    },
    // OpenAI built-in noise reduction (for gpt-realtime GA model); API expects { type: 'near_field' | 'far_field' }
    openaiNoiseReduction: process.env.AUDIO_OPENAI_NOISE_REDUCTION || 'near_field', // near_field | far_field; use 'null' to disable (env string)
    // Turn detection settings (controls when Bianca responds after user stops speaking)
    turnDetection: {
      threshold: parseFloat(process.env.AUDIO_TURN_DETECTION_THRESHOLD) || 0.6, // Default: 0.6 (higher = more selective, ignores quiet background)
      prefixPaddingMs: parseInt(process.env.AUDIO_TURN_DETECTION_PREFIX_PADDING_MS) || 200, // Default: 200ms (captures speech start)
      // OpenAI server_vad: min 1000ms silence before end-of-speech (env cannot set below 1000)
      silenceDurationMs: (() => {
        const raw = parseInt(process.env.AUDIO_TURN_DETECTION_SILENCE_DURATION_MS, 10);
        const base = Number.isFinite(raw) && raw > 0 ? raw : 1000;
        return Math.max(1000, base);
      })(),
      // OpenAI turn_detection.create_response — only "true" enables auto response on VAD stop (see OPENAI_REALTIME_VAD_CREATE_RESPONSE).
      createResponse: process.env.OPENAI_REALTIME_VAD_CREATE_RESPONSE === 'true',
    },
  },
  google: {
    language: 'en-US',
    name: 'en-US-News-L',
    gender: 'FEMALE',
    encoding: 'MP3'
  },
  multer: { dest: path.join(__dirname, '../../uploads') },
  // App Store Review Account Configuration
  appStoreReview: {
    email: 'appreview@biancatechnologies.com',
    password: envVars.APP_STORE_REVIEW_PASSWORD || null, // Must be set in AWS Secrets Manager or .env file
    name: 'App Review Tester',
    phone: '+16045624263',
  },
  // Google OAuth Configuration (loaded from AWS Secrets Manager)
  googleOAuth: {
    clientId: envVars.GOOGLE_CLIENT_ID || null,
    clientSecret: envVars.GOOGLE_CLIENT_SECRET || null,
    tokenUri: 'https://oauth2.googleapis.com/token',
  },
  // Microsoft OAuth Configuration (loaded from AWS Secrets Manager)
  microsoftOAuth: {
    clientId: envVars.MICROSOFT_CLIENT_ID || null,
    clientSecret: envVars.MICROSOFT_CLIENT_SECRET || null,
    tenantId: envVars.MICROSOFT_TENANT_ID || 'common',
    tokenUri: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
  },
  // Merge domain-specific configurations
  ...buildAllConfigs(envVars),

  metricsScrapeToken:
    typeof envVars.METRICS_SCRAPE_TOKEN === 'string' && envVars.METRICS_SCRAPE_TOKEN.trim() !== ''
      ? envVars.METRICS_SCRAPE_TOKEN.trim()
      : null,
};

// CRITICAL: Ensure config.env always matches runtime NODE_ENV immediately after creation
// (baselineConfig.env is undefined here because the getter is defined later via defineProperty)
if (process.env.NODE_ENV) {
  _envOverride = process.env.NODE_ENV;
}
// Only warn when we had a defined env that mismatched. Never warn in test or when env was undefined (getter not yet defined).
const initialEnv = baselineConfig.env;
if (process.env.NODE_ENV !== 'test' && initialEnv !== undefined && initialEnv !== process.env.NODE_ENV) {
  logger.warn(`Initial config env (${initialEnv}) does not match runtime NODE_ENV (${process.env.NODE_ENV}). Using runtime value.`);
}

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
  baselineConfig.asterisk.enabled = true; // Always enable Asterisk
  // EC2/Docker Compose: ASTERISK_URL is http://asterisk:8088 — use it and Docker service names for RTP
  // ECS/other: use env or internal domain fallbacks
  if (envVars.ASTERISK_URL && envVars.ASTERISK_URL.includes('://asterisk:')) {
    baselineConfig.asterisk.url = envVars.ASTERISK_URL;
    baselineConfig.asterisk.host = 'asterisk';
    baselineConfig.asterisk.rtpBiancaHost = envVars.RTP_BIANCA_HOST || 'app';
    baselineConfig.asterisk.rtpAsteriskHost = envVars.RTP_ASTERISK_HOST || 'asterisk';
  } else {
    baselineConfig.asterisk.host = envVars.ASTERISK_HOST || `asterisk.${internalDomain}.internal`;
    baselineConfig.asterisk.url = envVars.ASTERISK_URL || `http://${baselineConfig.asterisk.host}:8088`;
    baselineConfig.asterisk.rtpBiancaHost = envVars.RTP_BIANCA_HOST || `bianca-app.${internalDomain}.internal`;
    baselineConfig.asterisk.rtpAsteriskHost = envVars.RTP_ASTERISK_HOST || `asterisk.${internalDomain}.internal`;
  }
}

// Set staging-specific overrides
if (envVars.NODE_ENV === 'staging') {
  // Use environment variables from docker-compose, or construct from PRIMARY_DOMAIN
  const apiBaseUrl = envVars.API_BASE_URL || getUrlFromDomain('staging-api', primaryDomain);
  
  baselineConfig.baseUrl = apiBaseUrl;
  baselineConfig.apiUrl = `${apiBaseUrl}/v1`;
  // On staging, frontend is at staging.biancawellness.com, API is at staging-api.biancawellness.com
  baselineConfig.frontendUrl = envVars.FRONTEND_URL || getUrlFromDomain('staging', primaryDomain);
  baselineConfig.adminFrontendUrl = envVars.ADMIN_FRONTEND_URL || getUrlFromDomain('staging-admin', primaryDomain);
  baselineConfig.mongoose.url = envVars.MONGODB_URL || 'mongodb://mongodb:27017/bianca-service';
  baselineConfig.email.smtp.secure = true;
  baselineConfig.twilio.apiUrl = apiBaseUrl;
  baselineConfig.twilio.websocketUrl = envVars.WEBSOCKET_URL || `wss://${apiBaseUrl.replace('https://', '')}`;
}

// Helper function to ensure config.env always matches runtime NODE_ENV
// This is critical to prevent staging/production config from being used in test mode
// Note: With the getter/setter approach, this function is mainly for logging/debugging
const ensureEnvMatchesRuntime = () => {
  if (process.env.NODE_ENV && _envOverride !== null && _envOverride !== process.env.NODE_ENV) {
    logger.warn(`Config env override (${_envOverride}) does not match runtime NODE_ENV (${process.env.NODE_ENV}). Clearing override to use runtime value.`);
    _envOverride = null;
  }
  // Verify the getter is returning the correct value (for logging/debugging)
  if (process.env.NODE_ENV && baselineConfig.env !== process.env.NODE_ENV) {
    logger.warn(`Config env getter returned (${baselineConfig.env}) but runtime NODE_ENV is (${process.env.NODE_ENV}). This should not happen.`);
  }
};

// Add method to load secrets from AWS Secrets Manager (if used)
baselineConfig.loadSecrets = async () => {
  // CRITICAL: Always ensure env matches runtime NODE_ENV at the start
  // This prevents issues where config was initialized with wrong env value
  ensureEnvMatchesRuntime();
  
  // Skip in development and test, but load for staging and production
  // CRITICAL: In test mode, always skip loading secrets (even if present) to match local test behavior
  // This ensures pipeline tests work the same way as local tests - no real Stripe/AWS calls
  if (baselineConfig.env === 'development' || baselineConfig.env === 'test') {
    logger.info('Skipping AWS Secrets Manager in development/test environment.');
    logger.info('Using keys from .env file for localhost/dev (or defaults if not set).');
    // Note: If secrets are in process.env (from CodeBuild), they'll be available but not applied to config
    // This means Stripe won't be initialized with real keys, matching local test behavior
    // Ensure env is still correct before returning
    ensureEnvMatchesRuntime();
    return baselineConfig;
  }

  // Use environment-specific secrets
  // Staging should use test keys, production uses live keys
  // Default to production secret for backwards compatibility
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
        // Ensure env is still correct before returning
        ensureEnvMatchesRuntime();
        return baselineConfig;
    }

    const secrets = JSON.parse(data.SecretString);
    logger.info(`Successfully loaded secrets from AWS Secrets Manager.`);
    logger.info('Using Stripe keys from AWS Secrets Manager for staging/production.');

    // Update process.env first - important if other modules read directly from process.env
    // In staging/production, AWS secrets should override .env values
    // CRITICAL: Never override NODE_ENV from secrets - it must come from runtime environment
    for (const key in secrets) {
        // Skip NODE_ENV - it must always come from the runtime environment (Docker, CodeBuild, etc.)
        if (key === 'NODE_ENV') {
            logger.warn('NODE_ENV found in secrets - ignoring it. NODE_ENV must come from runtime environment.');
            continue;
        }
        // Override process.env with AWS secrets for staging/production
        // This ensures AWS secrets take precedence over .env values
        process.env[key] = secrets[key];
    }

    // Apply secrets using domain modules (this will override config with AWS secrets)
    applyAllSecrets(baselineConfig, secrets);
    
    // CRITICAL: Ensure config.env matches runtime NODE_ENV (never override from secrets)
    // This ensures that even if secrets contained NODE_ENV, we use the runtime value
    ensureEnvMatchesRuntime();
    
    // MFA Encryption Key (special case - sets process.env)
    if (secrets.MFA_ENCRYPTION_KEY) {
      process.env.MFA_ENCRYPTION_KEY = secrets.MFA_ENCRYPTION_KEY;
    }
    // App Store Review Password (update config)
    if (secrets.APP_STORE_REVIEW_PASSWORD) {
      baselineConfig.appStoreReview.password = secrets.APP_STORE_REVIEW_PASSWORD;
    }
    
    // Google OAuth Secrets (load from environment-specific secrets)
    const googleSecretId = `bianca/${baselineConfig.env}/google-oauth`;
    try {
      logger.info(`Loading Google OAuth secrets from ${googleSecretId}`);
      const googleCommand = new GetSecretValueCommand({ SecretId: googleSecretId });
      const googleData = await client.send(googleCommand);
      
      if (googleData.SecretString) {
        const googleSecrets = JSON.parse(googleData.SecretString);
        baselineConfig.googleOAuth.clientId = googleSecrets.client_id;
        baselineConfig.googleOAuth.clientSecret = googleSecrets.client_secret;
        logger.info('Successfully loaded Google OAuth secrets');
      }
    } catch (googleErr) {
      logger.warn(`Could not load Google OAuth secrets from ${googleSecretId}: ${googleErr.message}`);
      // Not fatal - SSO just won't work if secrets aren't available
    }
    
    // Microsoft OAuth Secrets (load from environment-specific secrets)
    const microsoftSecretId = `bianca/${baselineConfig.env}/microsoft-oauth`;
    try {
      logger.info(`Loading Microsoft OAuth secrets from ${microsoftSecretId}`);
      const microsoftCommand = new GetSecretValueCommand({ SecretId: microsoftSecretId });
      const microsoftData = await client.send(microsoftCommand);
      
      if (microsoftData.SecretString) {
        const microsoftSecrets = JSON.parse(microsoftData.SecretString);
        baselineConfig.microsoftOAuth.clientId = microsoftSecrets.client_id;
        baselineConfig.microsoftOAuth.clientSecret = microsoftSecrets.client_secret;
        baselineConfig.microsoftOAuth.tenantId = microsoftSecrets.tenant_id || 'common';
        // Update tokenUri with actual tenant if not 'common'
        if (microsoftSecrets.tenant_id && microsoftSecrets.tenant_id !== 'common') {
          baselineConfig.microsoftOAuth.tokenUri = `https://login.microsoftonline.com/${microsoftSecrets.tenant_id}/oauth2/v2.0/token`;
        }
        logger.info('Successfully loaded Microsoft OAuth secrets');
      }
    } catch (microsoftErr) {
      logger.warn(`Could not load Microsoft OAuth secrets from ${microsoftSecretId}: ${microsoftErr.message}`);
      // Not fatal - SSO just won't work if secrets aren't available
    }
    
    // Mongoose URL
    // if (secrets.MONGODB_URL) {
    //     baselineConfig.mongoose.url = secrets.MONGODB_URL + (baselineConfig.env === 'test' ? '-test' : '');
    // }
    // // Port
    // if (secrets.PORT) baselineConfig.port = secrets.PORT;


    // Add other mappings as needed...
    logger.info('Configuration updated with values from AWS Secrets Manager.');
    // Ensure env is still correct before returning
    ensureEnvMatchesRuntime();
    return baselineConfig;
  } catch (err) {
    // Log error but return baseline config to allow app to potentially start with defaults/env vars
    logger.error(`Error retrieving secret from AWS Secrets Manager (SecretId: ${secretId}): ${err.code} - ${err.message}`);
    // Ensure env is still correct before returning
    ensureEnvMatchesRuntime();
    return baselineConfig;
  }
};

// Define env property with getter/setter to always read from process.env.NODE_ENV at runtime
// This ensures the value is never cached and always reflects the current environment
// Tests can override it by setting config.env = 'test', but runtime always uses process.env.NODE_ENV
Object.defineProperty(baselineConfig, 'env', {
  get() {
    // If explicitly overridden (for tests), use that value
    if (_envOverride !== null) {
      return _envOverride;
    }
    // CRITICAL: Always check process.env.NODE_ENV first at runtime
    // This ensures container environment variables always take precedence
    const runtimeNodeEnv = process.env.NODE_ENV;
    
    // Debug logging (can be removed later)
    if (runtimeNodeEnv && runtimeNodeEnv !== envVars.NODE_ENV) {
      logger.info(`[Config] Using runtime NODE_ENV: ${runtimeNodeEnv} (envVars had: ${envVars.NODE_ENV})`);
    }
    
    // Always prefer runtime value if it exists and is truthy
    if (runtimeNodeEnv) {
      return runtimeNodeEnv;
    }
    
    // Only fall back to envVars if NODE_ENV is truly not set in process.env
    // This should rarely happen in production/container environments
    logger.warn(`[Config] process.env.NODE_ENV is not set, falling back to envVars.NODE_ENV (${envVars.NODE_ENV || 'development'})`);
    return envVars.NODE_ENV || 'development';
  },
  set(value) {
    // Allow tests to override the env value
    _envOverride = value;
  },
  enumerable: true,
  configurable: true
});

// Export the configuration object
module.exports = baselineConfig;
