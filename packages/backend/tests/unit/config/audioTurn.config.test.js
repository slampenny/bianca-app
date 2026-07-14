process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

const {
  buildAudioTurnDetectionConfig,
  resolveTurnDetectionMode,
  resolveTurnDetectionEagerness,
  resolveSilenceDurationMs,
  resolveResponseTriggerWatchdogMs,
  resolveTurnDetectionPayload,
} = require('../../../src/config/audioTurn.config');
const { getVoiceTurnConfig, logVoiceTurnStartupConfig } = require('../../../src/utils/voiceTurnProfile.util');

describe('audioTurn.config', () => {
  const baseEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...baseEnv };
  });

  it('uses application defaults when vars missing', () => {
    const td = buildAudioTurnDetectionConfig({});
    expect(td.mode).toBe('semantic_vad');
    expect(td.eagerness).toBe('low');
    expect(td.responseTriggerWatchdogMs).toBe(3000);
    expect(td.voiceTurnPersonalization.enabled).toBe(true);
    expect(td.voiceTurnPersonalization.defaultSilenceDurationMs).toBe(300);
    expect(td.silenceDurationMs).toBe(500);
  });

  it('reads RESPONSE_TRIGGER_WATCHDOG_MS', () => {
    expect(resolveResponseTriggerWatchdogMs({})).toBe(3000);
    expect(resolveResponseTriggerWatchdogMs({ RESPONSE_TRIGGER_WATCHDOG_MS: '4500' })).toBe(4500);
    expect(buildAudioTurnDetectionConfig({ RESPONSE_TRIGGER_WATCHDOG_MS: '2000' }).responseTriggerWatchdogMs).toBe(2000);
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

describe('turn detection mode / silence resolution', () => {
  it('defaults TURN_DETECTION_MODE to semantic_vad', () => {
    expect(resolveTurnDetectionMode({})).toBe('semantic_vad');
    expect(resolveTurnDetectionMode({ TURN_DETECTION_MODE: 'SERVER_VAD' })).toBe('server_vad');
    expect(resolveTurnDetectionMode({ TURN_DETECTION_MODE: 'nonsense' })).toBe('semantic_vad');
  });

  it('defaults TURN_DETECTION_EAGERNESS to low', () => {
    expect(resolveTurnDetectionEagerness({})).toBe('low');
    expect(resolveTurnDetectionEagerness({ TURN_DETECTION_EAGERNESS: 'high' })).toBe('high');
    expect(resolveTurnDetectionEagerness({ TURN_DETECTION_EAGERNESS: 'nope' })).toBe('low');
  });

  it('prefers SILENCE_DURATION_MS over AUDIO_TURN_DETECTION_SILENCE_DURATION_MS', () => {
    expect(
      resolveSilenceDurationMs({
        SILENCE_DURATION_MS: '1200',
        AUDIO_TURN_DETECTION_SILENCE_DURATION_MS: '500',
      })
    ).toBe(1200);
    expect(resolveSilenceDurationMs({ AUDIO_TURN_DETECTION_SILENCE_DURATION_MS: '800' })).toBe(800);
    expect(resolveSilenceDurationMs({})).toBe(500);
  });

  it('buildAudioTurnDetectionConfig wires mode/eagerness/SILENCE_DURATION_MS for A/B', () => {
    const td = buildAudioTurnDetectionConfig({
      TURN_DETECTION_MODE: 'server_vad',
      TURN_DETECTION_EAGERNESS: 'medium',
      SILENCE_DURATION_MS: '1200',
    });
    expect(td.mode).toBe('server_vad');
    expect(td.eagerness).toBe('medium');
    expect(td.silenceDurationMs).toBe(1200);
  });

  it('resolveTurnDetectionPayload defaults to semantic_vad with low eagerness', () => {
    const payload = resolveTurnDetectionPayload(buildAudioTurnDetectionConfig({}), null);
    expect(payload).toEqual({
      type: 'semantic_vad',
      eagerness: 'low',
      create_response: false,
    });
    expect(payload.silence_duration_ms).toBeUndefined();
  });

  it('resolveTurnDetectionPayload builds server_vad with silence and per-call override', () => {
    const td = buildAudioTurnDetectionConfig({
      TURN_DETECTION_MODE: 'server_vad',
      SILENCE_DURATION_MS: '1200',
    });
    expect(resolveTurnDetectionPayload(td, null)).toMatchObject({
      type: 'server_vad',
      silence_duration_ms: 1200,
      threshold: 0.6,
      prefix_padding_ms: 200,
      create_response: false,
    });
    expect(resolveTurnDetectionPayload(td, { vadSilenceDurationMs: 750 })).toMatchObject({
      type: 'server_vad',
      silence_duration_ms: 750,
    });
  });

  it('resolveTurnDetectionPayload ignores connection silence override for semantic_vad', () => {
    const td = buildAudioTurnDetectionConfig({ TURN_DETECTION_MODE: 'semantic_vad' });
    const payload = resolveTurnDetectionPayload(td, { vadSilenceDurationMs: 900 });
    expect(payload.type).toBe('semantic_vad');
    expect(payload.eagerness).toBe('low');
    expect(payload.silence_duration_ms).toBeUndefined();
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
    expect(lines.some((l) => l.includes('[VoiceTurn] turn_detection mode=semantic_vad'))).toBe(true);
    expect(lines.some((l) => l.includes('[VoiceTurn] personalization'))).toBe(true);
  });

  it('does not throw with null logger', () => {
    expect(() => logVoiceTurnStartupConfig(null, {})).not.toThrow();
  });
});
