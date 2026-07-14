/**
 * OpenAI Realtime turn_detection / voice-turn personalization settings from environment.
 * Rebuilt after AWS Secrets Manager merge so secret JSON overrides docker-compose env.
 */

const VALID_MODES = new Set(['semantic_vad', 'server_vad']);
const VALID_EAGERNESS = new Set(['low', 'medium', 'high', 'auto']);

/**
 * Clamp silence duration used by server_vad.
 * @param {number} raw
 * @param {number} fallback
 * @returns {number}
 */
function clampSilenceMs(raw, fallback = 500) {
  const base = Number.isFinite(raw) && raw > 0 ? raw : fallback;
  return Math.min(4000, Math.max(200, base));
}

/**
 * Resolve silence_duration_ms from env for server_vad A/B.
 * Prefers SILENCE_DURATION_MS; falls back to AUDIO_TURN_DETECTION_SILENCE_DURATION_MS.
 * @param {NodeJS.ProcessEnv} env
 * @returns {number}
 */
function resolveSilenceDurationMs(env = process.env) {
  const primary = parseInt(env.SILENCE_DURATION_MS, 10);
  if (Number.isFinite(primary) && primary > 0) {
    return clampSilenceMs(primary);
  }
  const legacy = parseInt(env.AUDIO_TURN_DETECTION_SILENCE_DURATION_MS, 10);
  return clampSilenceMs(legacy, 500);
}

/**
 * Max ms after speech_stopped scheduling a response before we log a silent-Bianca error.
 * @param {NodeJS.ProcessEnv} env
 * @returns {number}
 */
function resolveResponseTriggerWatchdogMs(env = process.env) {
  const raw = parseInt(env.RESPONSE_TRIGGER_WATCHDOG_MS, 10);
  if (Number.isFinite(raw) && raw > 0) {
    return Math.min(60000, Math.max(500, raw));
  }
  return 3000;
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {'semantic_vad'|'server_vad'}
 */
function resolveTurnDetectionMode(env = process.env) {
  const raw = (env.TURN_DETECTION_MODE || 'semantic_vad').toLowerCase().trim();
  return VALID_MODES.has(raw) ? raw : 'semantic_vad';
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {'low'|'medium'|'high'|'auto'}
 */
function resolveTurnDetectionEagerness(env = process.env) {
  const raw = (env.TURN_DETECTION_EAGERNESS || 'low').toLowerCase().trim();
  return VALID_EAGERNESS.has(raw) ? raw : 'low';
}

/**
 * Build the OpenAI `audio.input.turn_detection` payload from resolved config + optional per-call override.
 * Pure — safe to unit test without mocking owned services.
 *
 * @param {object} tdConfig - from buildAudioTurnDetectionConfig / config.audio.turnDetection
 * @param {Object|null} connection - may carry vadSilenceDurationMs for server_vad personalization
 * @returns {object}
 */
function resolveTurnDetectionPayload(tdConfig = {}, connection = null) {
  const mode = tdConfig.mode === 'server_vad' ? 'server_vad' : 'semantic_vad';
  const createResponse = tdConfig.createResponse === true;

  if (mode === 'server_vad') {
    const fromConfig = tdConfig.silenceDurationMs ?? 500;
    const override = connection?.vadSilenceDurationMs;
    const raw = Number.isFinite(override) && override > 0 ? override : fromConfig;
    return {
      type: 'server_vad',
      threshold: tdConfig.threshold ?? 0.6,
      prefix_padding_ms: tdConfig.prefixPaddingMs ?? 200,
      silence_duration_ms: clampSilenceMs(raw, 500),
      // Default (createResponse !== true) must stay false: this app schedules its own `sendResponseCreate` on
      // speech_stopped. Enabling OPENAI_REALTIME_VAD_CREATE_RESPONSE would double-fire and must not be used in production.
      create_response: createResponse,
    };
  }

  return {
    type: 'semantic_vad',
    eagerness: VALID_EAGERNESS.has(tdConfig.eagerness) ? tdConfig.eagerness : 'low',
    create_response: createResponse,
  };
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {object}
 */
function buildAudioTurnDetectionConfig(env = process.env) {
  return {
    mode: resolveTurnDetectionMode(env),
    eagerness: resolveTurnDetectionEagerness(env),
    threshold: parseFloat(env.AUDIO_TURN_DETECTION_THRESHOLD) || 0.6,
    prefixPaddingMs: parseInt(env.AUDIO_TURN_DETECTION_PREFIX_PADDING_MS, 10) || 200,
    silenceDurationMs: resolveSilenceDurationMs(env),
    voiceTurnPersonalization: {
      enabled: env.AUDIO_TURN_PERSONALIZATION_ENABLED === 'false' ? false : true,
      defaultSilenceDurationMs: (() => {
        const raw = parseInt(env.AUDIO_TURN_DEFAULT_SILENCE_DURATION_MS, 10);
        const base = Number.isFinite(raw) && raw > 0 ? raw : 300;
        return Math.min(4000, Math.max(200, base));
      })(),
      minSilenceDurationMs: (() => {
        const raw = parseInt(env.AUDIO_TURN_MIN_SILENCE_DURATION_MS, 10);
        return Number.isFinite(raw) && raw > 0 ? raw : 225;
      })(),
      maxSilenceDurationMs: (() => {
        const raw = parseInt(env.AUDIO_TURN_MAX_SILENCE_DURATION_MS, 10);
        return Number.isFinite(raw) && raw > 0 ? raw : 2000;
      })(),
      interruptionBumpMs: (() => {
        const raw = parseInt(env.AUDIO_TURN_INTERRUPTION_BUMP_MS, 10);
        return Number.isFinite(raw) && raw > 0 ? raw : 250;
      })(),
      successDecayMs: (() => {
        const raw = parseInt(env.AUDIO_TURN_SUCCESS_DECAY_MS, 10);
        return Number.isFinite(raw) && raw > 0 ? raw : 50;
      })(),
      successDecayMinTurns: (() => {
        const raw = parseInt(env.AUDIO_TURN_SUCCESS_DECAY_MIN_TURNS, 10);
        return Number.isFinite(raw) && raw > 0 ? raw : 6;
      })(),
      successDecayMinCalls: (() => {
        const raw = parseInt(env.AUDIO_TURN_SUCCESS_DECAY_MIN_CALLS, 10);
        return Number.isFinite(raw) && raw >= 0 ? raw : 1;
      })(),
      profileAlpha: (() => {
        const raw = parseFloat(env.AUDIO_TURN_PROFILE_ALPHA, 10);
        return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 0.35;
      })(),
      minSpeechForPersistenceMs: 1200,
    },
    adaptiveSilence: {
      enabled: env.AUDIO_TURN_ADAPTIVE_SILENCE === 'false' ? false : true,
      stepMs: (() => {
        const s = parseInt(env.AUDIO_TURN_ADAPTIVE_SILENCE_STEP_MS, 10);
        return Number.isFinite(s) && s > 0 ? s : 200;
      })(),
      maxMs: (() => {
        const m = parseInt(env.AUDIO_TURN_ADAPTIVE_SILENCE_MAX_MS, 10);
        return Number.isFinite(m) && m > 0 ? m : 2000;
      })(),
    },
    createResponse: env.OPENAI_REALTIME_VAD_CREATE_RESPONSE === 'true',
    responseTriggerWatchdogMs: resolveResponseTriggerWatchdogMs(env),
  };
}

module.exports = {
  buildAudioTurnDetectionConfig,
  resolveTurnDetectionMode,
  resolveTurnDetectionEagerness,
  resolveSilenceDurationMs,
  resolveResponseTriggerWatchdogMs,
  resolveTurnDetectionPayload,
  clampSilenceMs,
};
