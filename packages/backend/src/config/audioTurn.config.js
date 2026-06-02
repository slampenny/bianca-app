/**
 * OpenAI server_vad / voice-turn personalization settings from environment.
 * Rebuilt after AWS Secrets Manager merge so secret JSON overrides docker-compose env.
 */

/**
 * @param {NodeJS.ProcessEnv} env
 * @returns {object}
 */
function buildAudioTurnDetectionConfig(env = process.env) {
  return {
    threshold: parseFloat(env.AUDIO_TURN_DETECTION_THRESHOLD) || 0.6,
    prefixPaddingMs: parseInt(env.AUDIO_TURN_DETECTION_PREFIX_PADDING_MS, 10) || 200,
    silenceDurationMs: (() => {
      const raw = parseInt(env.AUDIO_TURN_DETECTION_SILENCE_DURATION_MS, 10);
      const base = Number.isFinite(raw) && raw > 0 ? raw : 500;
      return Math.min(4000, Math.max(200, base));
    })(),
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
  };
}

module.exports = { buildAudioTurnDetectionConfig };
