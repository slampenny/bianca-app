process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';

jest.mock('../../../src/models/client.model', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));

jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const Client = require('../../../src/models/client.model');
const voiceTurnProfileService = require('../../../src/services/voiceTurnProfile.service');
const MessageHandler = require('../../../src/services/ai/realtime/message.handler');

describe('voiceTurnProfile.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('prepareCallVoiceTurn', () => {
    it('new client uses 300ms default', async () => {
      Client.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ preferredLanguage: 'en' }),
        }),
      });

      const result = await voiceTurnProfileService.prepareCallVoiceTurn('507f1f77bcf86cd799439011');
      expect(result.vadSilenceDurationMs).toBe(300);
      expect(result.voiceTurnTracking.initialVadSilenceDurationMs).toBe(300);
    });

    it('existing client uses persisted value', async () => {
      Client.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            voiceTurnProfile: { vadSilenceDurationMs: 900, source: 'adaptive', totalCallsObserved: 3 },
          }),
        }),
      });

      const result = await voiceTurnProfileService.prepareCallVoiceTurn('507f1f77bcf86cd799439011');
      expect(result.vadSilenceDurationMs).toBe(900);
      expect(result.voiceTurnTracking.priorCallsObserved).toBe(3);
    });
  });

  describe('MessageHandler regression', () => {
    it('buildSessionUpdateForVad includes personalized value on connection', () => {
      const conn = { vadSilenceDurationMs: 750 };
      const msg = MessageHandler.buildSessionUpdateForVad(conn);
      expect(msg.session.audio.input.turn_detection.silence_duration_ms).toBe(750);
    });
  });

  describe('persistCallVoiceTurn', () => {
    it('persists profile after meaningful call', async () => {
      Client.findById.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({ voiceTurnProfile: { totalCallsObserved: 0 } }),
        }),
      });
      Client.findByIdAndUpdate.mockResolvedValue({});

      const tracking = {
        initialVadSilenceDurationMs: 300,
        currentVadSilenceDurationMs: 600,
        finalVadSilenceDurationMs: 600,
        minSilenceDurationMs: 250,
        maxSilenceDurationMs: 2000,
        interruptionCount: 1,
        turnsObserved: 4,
        cleanTurns: 0,
        bumpEvents: 1,
        totalSpeechDurationMs: 5000,
        callStartedAt: new Date(),
        profileSource: 'default',
      };

      await voiceTurnProfileService.persistCallVoiceTurn('507f1f77bcf86cd799439011', tracking);
      expect(Client.findByIdAndUpdate).toHaveBeenCalled();
      const setArg = Client.findByIdAndUpdate.mock.calls[0][1].$set;
      expect(setArg['voiceTurnProfile.totalCallsObserved']).toBe(1);
      expect(setArg['voiceTurnProfile.vadSilenceDurationMs']).toBeGreaterThan(300);
    });
  });

  describe('resetClientVoiceTurnProfile', () => {
    it('resets profile to defaults', async () => {
      Client.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            voiceTurnProfile: { vadSilenceDurationMs: 300, source: 'default' },
          }),
        }),
      });

      const profile = await voiceTurnProfileService.resetClientVoiceTurnProfile('507f1f77bcf86cd799439011');
      expect(profile.vadSilenceDurationMs).toBe(300);
      expect(profile.source).toBe('default');
    });
  });
});
