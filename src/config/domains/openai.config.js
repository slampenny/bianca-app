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
  
  return {
    openai: {
      apiKey: envVars.OPENAI_API_KEY,
      realtimeModel: envVars.OPENAI_REALTIME_MODEL,
      realtimeVoice: envVars.OPENAI_REALTIME_VOICE || 'alloy',
      realtimeSessionConfig,
      idleTimeout: envVars.OPENAI_IDLE_TIMEOUT || 300000,
      model: envVars.OPENAI_MODEL || 'gpt-4o',
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
  });
  return schema.validate(envVars, { allowUnknown: true });
};

const applyOpenAISecrets = (config, secrets) => {
  if (secrets.OPENAI_API_KEY) config.openai.apiKey = secrets.OPENAI_API_KEY;
  return config;
};

module.exports = {
  buildOpenAIConfig,
  validateOpenAIEnvVars,
  applyOpenAISecrets,
};

