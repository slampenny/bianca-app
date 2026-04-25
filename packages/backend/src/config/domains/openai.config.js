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
      // 0 disables health-check idle disconnect. Do not use || — 0 is valid (was incorrectly falling through to 5min).
      idleTimeout: (() => {
        const v = envVars.OPENAI_IDLE_TIMEOUT;
        if (v === undefined || v === null) return 0;
        const n = Number(v);
        return Number.isFinite(n) ? Math.max(0, n) : 0;
      })(),
      model: envVars.OPENAI_MODEL || 'gpt-4o',
      sentimentModel: envVars.OPENAI_SENTIMENT_MODEL || 'gpt-4o', // Chat completions model for sentiment; OPENAI_MODEL may be realtime-only
      useGA: true, // Always true - GA API is the only option
      realtimeTranscriptionModel: envVars.OPENAI_REALTIME_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe',
      /** Legacy: prefer OPENAI_DEBUG_AUDIO env or per-org `debugAudioUploadEnabled`; kept for any code still reading it */
      debugAudio: envVars.OPENAI_DEBUG_AUDIO === 'true',
    },
  };
};

const validateOpenAIEnvVars = (envVars) => {
  const schema = Joi.object({
    OPENAI_API_KEY: Joi.string().optional(),
    OPENAI_REALTIME_MODEL: Joi.string().optional(),
    OPENAI_REALTIME_VOICE: Joi.string().optional(),
    OPENAI_REALTIME_SESSION_CONFIG: Joi.string().optional(),
    OPENAI_IDLE_TIMEOUT: Joi.number().optional().min(0),
    OPENAI_MODEL: Joi.string().optional(),
    OPENAI_SENTIMENT_MODEL: Joi.string().optional(),
    OPENAI_REALTIME_TRANSCRIPTION_MODEL: Joi.string().optional(),
    OPENAI_REALTIME_VAD_CREATE_RESPONSE: Joi.string().valid('true', 'false').optional(),
    OPENAI_DEBUG_AUDIO: Joi.string().valid('true', 'false').optional(),
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

  // Optional: max idle ms before Realtime disconnect (0 = off). Remove from secrets to use env default.
  if (secrets.OPENAI_IDLE_TIMEOUT !== undefined && secrets.OPENAI_IDLE_TIMEOUT !== null) {
    const n = Number(secrets.OPENAI_IDLE_TIMEOUT);
    config.openai.idleTimeout = Number.isFinite(n) ? Math.max(0, n) : config.openai.idleTimeout;
  }

  return config;
};

module.exports = {
  buildOpenAIConfig,
  validateOpenAIEnvVars,
  applyOpenAISecrets,
};

