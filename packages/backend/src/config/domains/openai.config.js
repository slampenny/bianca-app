/**
 * OpenAI Configuration
 */

const buildOpenAIConfig = (envVars) => {
  let realtimeSessionConfig = {};
  try {
    if (envVars.OPENAI_REALTIME_SESSION_CONFIG) {
      realtimeSessionConfig = typeof envVars.OPENAI_REALTIME_SESSION_CONFIG === 'string' 
        ? JSON.parse(envVars.OPENAI_REALTIME_SESSION_CONFIG) 
        : envVars.OPENAI_REALTIME_SESSION_CONFIG;
    }
  } catch (e) {
    // If parsing fails, use empty object
    realtimeSessionConfig = {};
  }
  
  // Parse useGA flag - handle both boolean and string values from AWS Secrets Manager
  let useGA = false;
  if (envVars.OPENAI_REALTIME_USE_GA !== undefined) {
    if (typeof envVars.OPENAI_REALTIME_USE_GA === 'boolean') {
      useGA = envVars.OPENAI_REALTIME_USE_GA;
    } else if (typeof envVars.OPENAI_REALTIME_USE_GA === 'string') {
      // AWS Secrets Manager stores values as strings, so parse "true"/"false"
      useGA = envVars.OPENAI_REALTIME_USE_GA.toLowerCase() === 'true';
    }
  }
  
  // GA uses 'gpt-realtime', fallback uses 'gpt-realtime-2025-08-28' (preview models no longer work)
  // Allow override via env var, but default based on useGA flag
  const defaultRealtimeModel = useGA ? 'gpt-realtime' : 'gpt-realtime-2025-08-28';
  const realtimeModel = envVars.OPENAI_REALTIME_MODEL || defaultRealtimeModel;
  
  return {
    openai: {
      apiKey: envVars.OPENAI_API_KEY,
      realtimeModel,
      realtimeVoice: envVars.OPENAI_REALTIME_VOICE || 'alloy',
      realtimeSessionConfig,
      idleTimeout: envVars.OPENAI_IDLE_TIMEOUT || 300000,
      model: envVars.OPENAI_MODEL || 'gpt-4o-2025-01-12',
      sentimentModel: envVars.OPENAI_SENTIMENT_MODEL || 'gpt-4o', // Chat completions model for sentiment; OPENAI_MODEL may be realtime-only
      useGA,
      realtimeTranscriptionModel: envVars.OPENAI_REALTIME_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
      debugAudio: true,
    },
  };
};

const validateOpenAIEnvVars = (envVars) => {
  const schema = Joi.object({
    OPENAI_API_KEY: Joi.string().optional(),
    OPENAI_REALTIME_MODEL: Joi.string().optional(),
    OPENAI_REALTIME_VOICE: Joi.string().optional(),
    OPENAI_REALTIME_SESSION_CONFIG: Joi.string().optional(),
    OPENAI_IDLE_TIMEOUT: Joi.number().optional(),
    OPENAI_MODEL: Joi.string().optional(),
    OPENAI_SENTIMENT_MODEL: Joi.string().optional(),
    OPENAI_REALTIME_USE_GA: Joi.boolean().optional(),
    OPENAI_REALTIME_TRANSCRIPTION_MODEL: Joi.string().optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyOpenAISecrets = (config, secrets) => {
  const logger = require('../logger');
  if (secrets.OPENAI_API_KEY) config.openai.apiKey = secrets.OPENAI_API_KEY;
  
  // Update useGA flag from secrets (secrets are already in process.env at this point)
  // Re-parse useGA flag - handle both boolean and string values from AWS Secrets Manager
  if (secrets.OPENAI_REALTIME_USE_GA !== undefined) {
    let useGA = false;
    if (typeof secrets.OPENAI_REALTIME_USE_GA === 'boolean') {
      useGA = secrets.OPENAI_REALTIME_USE_GA;
    } else if (typeof secrets.OPENAI_REALTIME_USE_GA === 'string') {
      // AWS Secrets Manager stores values as strings, so parse "true"/"false"
      useGA = secrets.OPENAI_REALTIME_USE_GA.toLowerCase() === 'true';
    }
    config.openai.useGA = useGA;
    logger.info(`[OpenAI Config] Applied OPENAI_REALTIME_USE_GA from secrets: ${secrets.OPENAI_REALTIME_USE_GA} -> useGA: ${useGA}`);
    
    // Update model based on useGA flag (unless explicitly overridden)
    if (!secrets.OPENAI_REALTIME_MODEL) {
      config.openai.realtimeModel = useGA ? 'gpt-realtime' : 'gpt-realtime-2025-08-28';
    }
  }
  
  // Update model if explicitly provided in secrets
  if (secrets.OPENAI_REALTIME_MODEL) {
    config.openai.realtimeModel = secrets.OPENAI_REALTIME_MODEL;
  }
  
  // Update transcription model if provided
  if (secrets.OPENAI_REALTIME_TRANSCRIPTION_MODEL) {
    config.openai.realtimeTranscriptionModel = secrets.OPENAI_REALTIME_TRANSCRIPTION_MODEL;
  }
  
  return config;
};

module.exports = {
  buildOpenAIConfig,
  validateOpenAIEnvVars,
  applyOpenAISecrets,
};

