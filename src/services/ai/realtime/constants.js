/**
 * Constants for OpenAI Realtime Service
 */

module.exports = {
  MAX_PENDING_CHUNKS: 200,
  RECONNECT_MAX_ATTEMPTS: 5,
  RECONNECT_BASE_DELAY: 1000,
  COMMIT_DEBOUNCE_DELAY: 100, // Conservative: 100ms instead of 50ms
  CONNECTION_TIMEOUT: 15000,
  DEFAULT_SAMPLE_RATE: 24000,
  ASTERISK_SAMPLE_RATE: 8000,
  OPENAI_PCM_OUTPUT_RATE: 24000,
  TEST_CONNECTION_TIMEOUT: 20000,
  AUDIO_BATCH_SIZE: 20, // Conservative: 20 instead of 10
  MIN_AUDIO_DURATION_MS: 40, // Conservative: 40ms instead of 20ms
  MIN_AUDIO_BYTES: 320, // Conservative: 320 bytes instead of 160
  INITIAL_SILENCE_MS: 100, // Conservative: 100ms instead of 50ms
  AUDIO_QUALITY_CHECK_INTERVAL: 5000,
  MAX_CONSECUTIVE_SILENCE_CHUNKS: 50,
  SPEECH_END_SILENCE_MS: 1200, // Conservative: 1200ms instead of 800ms
  MIN_SPEECH_DURATION_MS: 800, // Conservative: 800ms instead of 500ms
  GRACE_PERIOD_MS: 3000, // Grace period after greeting completion
};

