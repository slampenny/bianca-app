process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

const {
  clampSilenceMs,
  getVoiceTurnConfig,
  resolveInitialVadSilence,
  createCallTracking,
  applyInterruptionBump,
  applyCleanTurn,
  shouldPersistProfile,
  computePersistenceTarget,
  applySmoothing,
  buildProfilePersistenceUpdate,
} = require('../../../src/utils/voiceTurnProfile.util');

const baseConfig = {
  audio: {
    turnDetection: {
      silenceDurationMs: 500,
      voiceTurnPersonalization: {
        enabled: true,
        defaultSilenceDurationMs: 300,
        minSilenceDurationMs: 225,
        maxSilenceDurationMs: 2000,
        interruptionBumpMs: 250,
        successDecayMs: 50,
        successDecayMinTurns: 6,
        successDecayMinCalls: 1,
        profileAlpha: 0.35,
        minSpeechForPersistenceMs: 1200,
      },
      adaptiveSilence: { enabled: true, stepMs: 200, maxMs: 2000 },
    },
  },
};

const vtConfig = () => getVoiceTurnConfig(baseConfig);

describe('voiceTurnProfile.util', () => {
  describe('clampSilenceMs', () => {
    it('clamps to min/max bounds', () => {
      expect(clampSilenceMs(100, 250, 2000)).toBe(250);
      expect(clampSilenceMs(5000, 250, 2000)).toBe(2000);
      expect(clampSilenceMs(400, 250, 2000)).toBe(400);
    });

    it('respects absolute floor of 200ms', () => {
      expect(clampSilenceMs(150, 200, 2000)).toBe(200);
    });
  });

  describe('getVoiceTurnConfig', () => {
    it('returns expected defaults', () => {
      const cfg = vtConfig();
      expect(cfg.enabled).toBe(true);
      expect(cfg.defaultSilenceDurationMs).toBe(300);
      expect(cfg.minSilenceDurationMs).toBe(225);
      expect(cfg.minSilenceDurationMs).toBe(225);
      expect(cfg.maxSilenceDurationMs).toBe(2000);
      expect(cfg.interruptionBumpMs).toBe(250);
      expect(cfg.successDecayMs).toBe(50);
      expect(cfg.profileAlpha).toBe(0.35);
    });

    it('uses legacy silenceDurationMs when personalization disabled', () => {
      const cfg = getVoiceTurnConfig({
        audio: {
          turnDetection: {
            silenceDurationMs: 600,
            voiceTurnPersonalization: { enabled: false },
          },
        },
      });
      expect(cfg.enabled).toBe(false);
      expect(cfg.legacySilenceDurationMs).toBe(600);
    });
  });

  describe('resolveInitialVadSilence', () => {
    it('uses 300ms default for new client', () => {
      const r = resolveInitialVadSilence(null, vtConfig());
      expect(r.ms).toBe(300);
      expect(r.source).toBe('default');
    });

    it('uses persisted adaptive value for existing client', () => {
      const r = resolveInitialVadSilence(
        { vadSilenceDurationMs: 800, source: 'adaptive' },
        vtConfig()
      );
      expect(r.ms).toBe(800);
      expect(r.persistedMs).toBe(800);
    });

    it('respects manual profile', () => {
      const r = resolveInitialVadSilence(
        { vadSilenceDurationMs: 1200, source: 'manual' },
        vtConfig()
      );
      expect(r.ms).toBe(1200);
      expect(r.source).toBe('manual');
    });

    it('falls back to legacy silence when personalization disabled', () => {
      const cfg = getVoiceTurnConfig({
        audio: {
          turnDetection: {
            silenceDurationMs: 500,
            voiceTurnPersonalization: { enabled: false, minSilenceDurationMs: 250, maxSilenceDurationMs: 2000 },
          },
        },
      });
      const r = resolveInitialVadSilence({ vadSilenceDurationMs: 800 }, cfg);
      expect(r.ms).toBe(500);
      expect(r.source).toBe('legacy');
    });
  });

  describe('in-call behavior', () => {
    it('interruption bumps 300 → 550', () => {
      const tracking = createCallTracking({
        initialMs: 300,
        minMs: 250,
        maxMs: 2000,
        priorCallsObserved: 1,
      });
      const { nextMs, changed } = applyInterruptionBump(tracking, vtConfig());
      expect(changed).toBe(true);
      expect(nextMs).toBe(550);
      expect(tracking.interruptionCount).toBe(1);
      expect(tracking.cleanTurns).toBe(0);
    });

    it('multiple interruptions cap at 2000', () => {
      const tracking = createCallTracking({
        initialMs: 300,
        minMs: 250,
        maxMs: 2000,
        priorCallsObserved: 1,
      });
      for (let i = 0; i < 20; i++) {
        applyInterruptionBump(tracking, vtConfig());
      }
      expect(tracking.currentVadSilenceDurationMs).toBe(2000);
    });

    it('clean turns decay slowly after threshold', () => {
      const tracking = createCallTracking({
        initialMs: 500,
        minMs: 250,
        maxMs: 2000,
        priorCallsObserved: 2,
      });
      let lastMs = 500;
      for (let i = 0; i < 6; i++) {
        const { nextMs, changed } = applyCleanTurn(tracking, vtConfig());
        if (i < 5) {
          expect(changed).toBe(false);
          expect(nextMs).toBe(500);
        } else {
          expect(changed).toBe(true);
          expect(nextMs).toBe(450);
          lastMs = nextMs;
        }
      }
      expect(lastMs).toBe(450);
    });

    it('does not decay below min', () => {
      const tracking = createCallTracking({
        initialMs: 280,
        minMs: 250,
        maxMs: 2000,
        priorCallsObserved: 2,
      });
      for (let round = 0; round < 3; round++) {
        for (let i = 0; i < 6; i++) {
          applyCleanTurn(tracking, vtConfig());
        }
      }
      expect(tracking.currentVadSilenceDurationMs).toBeGreaterThanOrEqual(250);
    });

    it('interruption resets clean turn counter preventing oscillation', () => {
      const tracking = createCallTracking({
        initialMs: 500,
        minMs: 250,
        maxMs: 2000,
        priorCallsObserved: 2,
      });
      for (let i = 0; i < 5; i++) applyCleanTurn(tracking, vtConfig());
      expect(tracking.cleanTurns).toBe(5);
      applyInterruptionBump(tracking, vtConfig());
      expect(tracking.cleanTurns).toBe(0);
      const { changed } = applyCleanTurn(tracking, vtConfig());
      expect(changed).toBe(false);
    });
  });

  describe('persistence', () => {
    it('interruption call persists higher wait with smoothing', () => {
      const tracking = createCallTracking({
        initialMs: 300,
        minMs: 250,
        maxMs: 2000,
        priorCallsObserved: 1,
      });
      tracking.turnsObserved = 3;
      applyInterruptionBump(tracking, vtConfig());
      const { update, nextMs } = buildProfilePersistenceUpdate(
        tracking,
        vtConfig(),
        { vadSilenceDurationMs: 300, totalCallsObserved: 1 },
        new Date()
      );
      expect(update).not.toBeNull();
      expect(nextMs).toBeGreaterThan(300);
      expect(update['voiceTurnProfile.totalInterruptionsObserved']).toBe(1);
    });

    it('clean call persists lower wait', () => {
      const tracking = createCallTracking({
        initialMs: 500,
        minMs: 250,
        maxMs: 2000,
        priorCallsObserved: 2,
      });
      tracking.turnsObserved = 8;
      tracking.finalVadSilenceDurationMs = 500;
      const target = computePersistenceTarget(tracking, vtConfig());
      expect(target).toBe(450);
      const next = applySmoothing(target, 500, 500, 0.35);
      expect(next).toBeLessThan(500);
    });

    it('short/no-speech call does not update', () => {
      const tracking = createCallTracking({
        initialMs: 350,
        minMs: 250,
        maxMs: 2000,
      });
      const check = shouldPersistProfile(tracking, vtConfig());
      expect(check.shouldPersist).toBe(false);
      expect(check.reason).toBe('insufficient_speech');
    });

    it('manual source not overwritten', () => {
      const tracking = createCallTracking({
        initialMs: 1200,
        minMs: 250,
        maxMs: 2000,
        profileSource: 'manual',
        priorCallsObserved: 1,
      });
      tracking.turnsObserved = 4;
      applyInterruptionBump(tracking, vtConfig());
      const { update, nextMs } = buildProfilePersistenceUpdate(
        tracking,
        vtConfig(),
        { vadSilenceDurationMs: 1200, source: 'manual', totalCallsObserved: 2 },
        new Date()
      );
      expect(nextMs).toBe(1200);
      expect(update['voiceTurnProfile.source']).toBe('manual');
      expect(update['voiceTurnProfile.vadSilenceDurationMs']).toBeUndefined();
      expect(update['voiceTurnProfile.totalCallsObserved']).toBe(3);
    });

    it('stats counters update on persist', () => {
      const tracking = createCallTracking({
        initialMs: 400,
        minMs: 250,
        maxMs: 2000,
        priorCallsObserved: 0,
      });
      tracking.turnsObserved = 5;
      const { update } = buildProfilePersistenceUpdate(
        tracking,
        vtConfig(),
        { totalCallsObserved: 2, totalTurnsObserved: 10, totalInterruptionsObserved: 1 },
        new Date()
      );
      expect(update['voiceTurnProfile.totalCallsObserved']).toBe(3);
      expect(update['voiceTurnProfile.totalTurnsObserved']).toBe(15);
    });
  });
});
