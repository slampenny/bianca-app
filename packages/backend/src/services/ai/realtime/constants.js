/**
 * Constants for OpenAI Realtime Service
 */

module.exports = {
  MAX_PENDING_CHUNKS: 100, // Reduced from 200 for lower latency
  RECONNECT_MAX_ATTEMPTS: 5,
  RECONNECT_BASE_DELAY: 1000,
  COMMIT_DEBOUNCE_DELAY: 100, // Conservative: 100ms instead of 50ms
  CONNECTION_TIMEOUT: 15000,
  DEFAULT_SAMPLE_RATE: 24000,
  ASTERISK_SAMPLE_RATE: 8000,
  OPENAI_PCM_OUTPUT_RATE: 24000,
  TEST_CONNECTION_TIMEOUT: 20000,
  AUDIO_BATCH_SIZE: 10, // Reduced from 20 for lower latency
  MIN_AUDIO_DURATION_MS: 20, // Reduced from 40ms for faster processing
  MIN_AUDIO_BYTES: 160, // Reduced from 320 (20ms instead of 40ms)
  INITIAL_SILENCE_MS: 100, // Conservative: 100ms instead of 50ms
  AUDIO_QUALITY_CHECK_INTERVAL: 5000,
  MAX_CONSECUTIVE_SILENCE_CHUNKS: 50,
  SPEECH_END_SILENCE_MS: 500, // Heuristic: align with default OpenAI turn_detection (server_vad defaults ~500ms)
  MIN_SPEECH_DURATION_MS: 800, // Conservative: 800ms instead of 500ms
  // After initial voice greeting: ignore speech_stopped so bridge/echo doesn’t trigger a reply.
  // Keep short — long windows feel like Bianca ignores the first real answer.
  GRACE_PERIOD_MS: 350,
  /** After session.updated + flush: brief pause before response.create so OpenAI finishes applying session.update (esp. turn_detection). */
  INITIAL_GREETING_AFTER_SESSION_READY_MS: 100,
};

