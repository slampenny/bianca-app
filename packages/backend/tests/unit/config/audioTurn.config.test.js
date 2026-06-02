process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

const { buildAudioTurnDetectionConfig } = require('../../../src/config/audioTurn.config');
const { getVoiceTurnConfig, logVoiceTurnStartupConfig } = require('../../../src/utils/voiceTurnProfile.util');

describe('audioTurn.config', () => {
  const baseEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...baseEnv };
  });

  it('uses application defaults when vars missing', () => {
    const td = buildAudioTurnDetectionConfig({});
    expect(td.voiceTurnPersonalization.enabled).toBe(true);
    expect(td.voiceTurnPersonalization.defaultSilenceDurationMs).toBe(300);
    expect(td.silenceDurationMs).toBe(500);
  });

  it('reads staging env vars correctly', () => {
    const td = buildAudioTurnDetectionConfig({
      AUDIO_TURN_PERSONALIZATION_ENABLED: 'true',
      AUDIO_TURN_DEFAULT_SILENCE_DURATION_MS: '300',
      AUDIO_TURN_MIN_SILENCE_DURATION_MS: '225',
      AUDIO_TURN_MAX_SILENCE_DURATION_MS: '2000',
      AUDIO_TURN_INTERRUPTION_BUMP_MS: '250',
      AUDIO_TURN_SUCCESS_DECAY_MS: '50',
      AUDIO_TURN_PROFILE_ALPHA: '0.35',
    });
    expect(td.voiceTurnPersonalization.defaultSilenceDurationMs).toBe(300);
    expect(td.voiceTurnPersonalization.minSilenceDurationMs).toBe(225);
    expect(td.voiceTurnPersonalization.profileAlpha).toBe(0.35);
  });

  it('clamps default silence to 200–4000', () => {
    expect(buildAudioTurnDetectionConfig({ AUDIO_TURN_DEFAULT_SILENCE_DURATION_MS: '100' }).voiceTurnPersonalization.defaultSilenceDurationMs).toBe(200);
    expect(buildAudioTurnDetectionConfig({ AUDIO_TURN_DEFAULT_SILENCE_DURATION_MS: '99999' }).voiceTurnPersonalization.defaultSilenceDurationMs).toBe(4000);
  });

  it('clamps legacy silence duration', () => {
    expect(buildAudioTurnDetectionConfig({ AUDIO_TURN_DETECTION_SILENCE_DURATION_MS: '50' }).silenceDurationMs).toBe(200);
    expect(buildAudioTurnDetectionConfig({ AUDIO_TURN_DETECTION_SILENCE_DURATION_MS: '9000' }).silenceDurationMs).toBe(4000);
  });

  it('personalization disabled uses legacy silence via getVoiceTurnConfig', () => {
    const cfg = {
      audio: {
        turnDetection: buildAudioTurnDetectionConfig({
          AUDIO_TURN_PERSONALIZATION_ENABLED: 'false',
          AUDIO_TURN_DETECTION_SILENCE_DURATION_MS: '600',
        }),
      },
    };
    const vt = getVoiceTurnConfig(cfg);
    expect(vt.enabled).toBe(false);
    const resolved = require('../../../src/utils/voiceTurnProfile.util').resolveInitialVadSilence(null, vt);
    expect(resolved.ms).toBe(600);
    expect(resolved.source).toBe('legacy');
  });
});

describe('logVoiceTurnStartupConfig', () => {
  it('logs without crashing when vars missing', () => {
    const lines = [];
    const mockLogger = {
      info: (msg) => lines.push(msg),
      warn: jest.fn(),
    };
    logVoiceTurnStartupConfig(mockLogger, {
      audio: { turnDetection: buildAudioTurnDetectionConfig({}) },
    });
    expect(lines.some((l) => l.includes('[VoiceTurn] personalization'))).toBe(true);
  });

  it('does not throw with null logger', () => {
    expect(() => logVoiceTurnStartupConfig(null, {})).not.toThrow();
  });
});
