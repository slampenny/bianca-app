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
  
  // Always use GA API - old Beta/preview models are offline
  // GA uses 'gpt-realtime' model
  const defaultRealtimeModel = 'gpt-realtime';
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
      useGA: true, // Always true - GA API is the only option
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
    OPENAI_REALTIME_TRANSCRIPTION_MODEL: Joi.string().optional(),
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyOpenAISecrets = (config, secrets) => {
  if (secrets.OPENAI_API_KEY) config.openai.apiKey = secrets.OPENAI_API_KEY;
  
  // Always use GA API - ensure useGA is true
  config.openai.useGA = true;
  
  // Update model if explicitly provided in secrets, otherwise use GA default
  if (secrets.OPENAI_REALTIME_MODEL) {
    config.openai.realtimeModel = secrets.OPENAI_REALTIME_MODEL;
  } else {
    config.openai.realtimeModel = 'gpt-realtime';
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

