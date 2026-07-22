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
  SPEECH_END_SILENCE_MS: 500, // Legacy heuristic only; live turn end uses session turn_detection (semantic_vad default)
  MIN_SPEECH_DURATION_MS: 800, // Conservative: 800ms instead of 500ms
  // FIX: Bug 2 — acoustic noise gate on speech_stopped 200ms path. Non-empty substantive ASR overrides
  // (short "yes"); empty/no transcript remains droppable as noise.
  MIN_SPEECH_DURATION_FOR_RESPONSE_MS: 1200,
  // After initial voice greeting: ignore speech_stopped so bridge/echo doesn’t trigger a reply.
  // Keep short — long windows feel like Bianca ignores the first real answer.
  GRACE_PERIOD_MS: 350,
  /**
   * Silence after session ready before Bianca proactively greets.
   * Override with GREETING_FALLBACK_MS env (see config.openai.greetingFallbackMs).
   */
  GREETING_FALLBACK_MS: 5000,
  /**
   * After speech_started during the open greeting window: if no committed audio / transcription
   * arrives within this window, treat it as connect noise and re-arm the greeting fallback.
   */
  GREETING_SPEECH_CONFIRM_MS: 2000,
  /**
   * Commit+duration confirmation for open-window speech (not MIN_SPEECH_DURATION_MS=800).
   * Single-word greetings are ~400–600ms; keep below that so "hello?" counts as real speech.
   */
  GREETING_MIN_SPEECH_CONFIRM_DURATION_MS: 350,
  /** Max connect-noise re-arms before we force the silence-fallback greeting. Env: GREETING_MAX_REARMS */
  GREETING_MAX_REARMS: 2,
  /**
   * On hangup, if the user was mid-utterance (semantic_vad never committed), force
   * input_audio_buffer.commit and wait this long for input_audio_transcription.completed
   * before closing the WebSocket / deleting the [Speaking...] placeholder.
   */
  HANGUP_TRANSCRIPT_FLUSH_MS: 3000,
};

