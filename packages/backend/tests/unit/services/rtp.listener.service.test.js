// Mock dgram module (uses centralized mock from tests/__mocks__/dgram.js)
jest.mock('dgram');
const dgram = require('dgram');

// Using real services now
const rtpListenerService = require('../../../src/services/rtp.listener.service');

describe('RTP Listener Service - Public API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any active listeners
    rtpListenerService.stopAllListeners();
  });

  describe('startRtpListenerForCall', () => {
    it('should start listener for new call', async () => {
    const testPort = 1234;
    const testCallId = 'test-call-123';
    const testAsteriskChannelId = 'test-channel-456';

      const listener = await rtpListenerService.startRtpListenerForCall(testPort, testCallId, testAsteriskChannelId);

      expect(listener).toBeDefined();
        expect(listener.port).toBe(testPort);
        expect(listener.callId).toBe(testCallId);
        expect(listener.asteriskChannelId).toBe(testAsteriskChannelId);
      
       // Verify UDP server was created and configured
        expect(dgram.createSocket).toHaveBeenCalledWith('udp4');
       expect(dgram.createSocket().bind).toHaveBeenCalledWith(testPort, '0.0.0.0', expect.any(Function));
    });

    it('should throw error for missing parameters', async () => {
      await expect(rtpListenerService.startRtpListenerForCall()).rejects.toThrow();
      await expect(rtpListenerService.startRtpListenerForCall(1234)).rejects.toThrow();
    });

    it('should return existing listener for same call', async () => {
      const testPort = 1234;
      const testCallId = 'test-call-123';
      const testAsteriskChannelId = 'test-channel-456';

      // Start first listener
      const listener1 = await rtpListenerService.startRtpListenerForCall(testPort, testCallId, testAsteriskChannelId);
      
      // Try to start second listener for same call
      const listener2 = await rtpListenerService.startRtpListenerForCall(testPort, testCallId, testAsteriskChannelId);
      
      // Should return the same listener instance
      expect(listener1).toBe(listener2);
    });
  });

  describe('stopRtpListenerForCall', () => {
    it('should stop and remove listener', async () => {
    const testPort = 1234;
    const testCallId = 'test-call-123';
    const testAsteriskChannelId = 'test-channel-456';

      // Start listener
      await rtpListenerService.startRtpListenerForCall(testPort, testCallId, testAsteriskChannelId);
      
      // Stop listener
        const result = rtpListenerService.stopRtpListenerForCall(testCallId);

        expect(result).toBe(true);
       expect(dgram.createSocket().close).toHaveBeenCalled();
      });

      it('should return false for non-existent listener', () => {
      const result = rtpListenerService.stopRtpListenerForCall('nonexistent-call');
        expect(result).toBe(false);
      });
    });

  describe('getListenerForCall', () => {
      it('should return listener for existing call', async () => {
      const testPort = 1234;
      const testCallId = 'test-call-123';
      const testAsteriskChannelId = 'test-channel-456';

      // Start listener
      await rtpListenerService.startRtpListenerForCall(testPort, testCallId, testAsteriskChannelId);
      
      // Get listener
      const listener = rtpListenerService.getListenerForCall(testCallId);
      
      expect(listener).toBeDefined();
      expect(listener.callId).toBe(testCallId);
      });

      it('should return undefined for non-existent call', () => {
      const listener = rtpListenerService.getListenerForCall('nonexistent-call');
        expect(listener).toBeUndefined();
      });
    });

  describe('getAllActiveListeners', () => {
      it('should return stats for all active listeners', async () => {
      const testPort1 = 1234;
      const testPort2 = 1235;
      const testCallId1 = 'test-call-123';
      const testCallId2 = 'test-call-456';
      const testAsteriskChannelId = 'test-channel-456';

      // Start multiple listeners
      await rtpListenerService.startRtpListenerForCall(testPort1, testCallId1, testAsteriskChannelId);
      await rtpListenerService.startRtpListenerForCall(testPort2, testCallId2, testAsteriskChannelId);
      
      // Get all listeners
        const listeners = rtpListenerService.getAllActiveListeners();

      expect(listeners).toBeDefined();
        expect(Object.keys(listeners)).toHaveLength(2);
      expect(listeners[testCallId1]).toBeDefined();
      expect(listeners[testCallId2]).toBeDefined();
      });

      it('should return empty object when no listeners', () => {
        const listeners = rtpListenerService.getAllActiveListeners();
        expect(listeners).toEqual({});
      });
    });

  describe('stopAllListeners', () => {
      it('should stop all active listeners', async () => {
      const testPort1 = 1234;
      const testPort2 = 1235;
      const testCallId1 = 'test-call-123';
      const testCallId2 = 'test-call-456';
      const testAsteriskChannelId = 'test-channel-456';

      // Start multiple listeners
      await rtpListenerService.startRtpListenerForCall(testPort1, testCallId1, testAsteriskChannelId);
      await rtpListenerService.startRtpListenerForCall(testPort2, testCallId2, testAsteriskChannelId);
      
      // Stop all listeners
        rtpListenerService.stopAllListeners();
        
      // Verify all listeners were stopped
      const listeners = rtpListenerService.getAllActiveListeners();
      expect(listeners).toEqual({});
    });
  });

  describe('healthCheck', () => {
    it('should return health status with active listeners', async () => {
      const testPort = 1234;
      const testCallId = 'test-call-123';
      const testAsteriskChannelId = 'test-channel-456';

      // Start listener
      await rtpListenerService.startRtpListenerForCall(testPort, testCallId, testAsteriskChannelId);
      
      // Check health
      const health = rtpListenerService.healthCheck();
      
      expect(health).toBeDefined();
      expect(health.healthy).toBe(true);
      expect(health.activeListeners).toBe(1);
      expect(health.listeners).toBeDefined();
    });

    it('should return health status with no listeners', () => {
      const health = rtpListenerService.healthCheck();
      
      expect(health).toBeDefined();
      expect(health.healthy).toBe(true);
      expect(health.activeListeners).toBe(0);
      expect(health.listeners).toEqual({});
    });
  });

  describe('getListenerStatus', () => {
    it('should return listener status for existing port', async () => {
      const testPort = 1234;
      const testCallId = 'test-call-123';
      const testAsteriskChannelId = 'test-channel-456';

      // Start listener
      await rtpListenerService.startRtpListenerForCall(testPort, testCallId, testAsteriskChannelId);
      
      // Get status
      const status = rtpListenerService.getListenerStatus(testPort);
      
      expect(status).toBeDefined();
      expect(status.found).toBe(true);
      expect(status.port).toBe(testPort);
      expect(status.callId).toBe(testCallId);
    });

    it('should return not found for non-existent port', () => {
      const status = rtpListenerService.getListenerStatus(9999);
      
      expect(status).toBeDefined();
      expect(status.found).toBe(false);
      expect(status.port).toBe(9999);
    });
  });

  describe('getFullStatus', () => {
    it('should return full status with multiple listeners', async () => {
      const testPort1 = 1234;
      const testPort2 = 1235;
      const testCallId1 = 'test-call-123';
      const testCallId2 = 'test-call-456';
      const testAsteriskChannelId = 'test-channel-456';

      // Start multiple listeners
      await rtpListenerService.startRtpListenerForCall(testPort1, testCallId1, testAsteriskChannelId);
      await rtpListenerService.startRtpListenerForCall(testPort2, testCallId2, testAsteriskChannelId);
      
      // Get full status
      const status = rtpListenerService.getFullStatus();
      
      expect(status).toBeDefined();
      expect(status.totalListeners).toBe(2);
      expect(status.listeners).toHaveLength(2);
    });

    it('should return empty status with no listeners', () => {
      const status = rtpListenerService.getFullStatus();
      
      expect(status).toBeDefined();
      expect(status.totalListeners).toBe(0);
      expect(status.listeners).toEqual([]);
    });
  });
}); 
