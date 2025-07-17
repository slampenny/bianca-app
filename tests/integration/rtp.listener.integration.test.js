/**
 * Integration tests for RTP Listener Service
 * These tests use the REAL service (no mocks) to catch actual issues
 * 
 * WARNING: These tests require network access and may bind to real ports
 * Only run these in integration test environments
 */

const dgram = require('dgram');
const { Buffer } = require('buffer');

// Import the REAL service (no mocks)
const rtpListenerService = require('../../src/services/rtp.listener.service');

describe('RTP Listener Service - Integration Tests', () => {
  let testPort;
  let testCallId;
  let testAsteriskChannelId;
  
  beforeEach(() => {
    // Use random ports to avoid conflicts
    testPort = 10000 + Math.floor(Math.random() * 5000);
    testCallId = `integration-test-${Date.now()}`;
    testAsteriskChannelId = `channel-${Date.now()}`;
  });
  
  afterEach(async () => {
    // Always clean up
    try {
      rtpListenerService.stopRtpListenerForCall(testCallId);
    } catch (err) {
      // Ignore cleanup errors
    }
  });
  
  afterAll(async () => {
    // Final cleanup
    try {
      rtpListenerService.stopAllListeners();
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('Real Service API', () => {
    it('should have all required functions', () => {
      const requiredFunctions = [
        'startRtpListenerForCall',
        'stopRtpListenerForCall',
        'getListenerForCall',
        'getAllActiveListeners',
        'stopAllListeners',
        'healthCheck',
        'getListenerStatus',
        'getFullStatus'
      ];
      
      requiredFunctions.forEach(funcName => {
        expect(typeof rtpListenerService[funcName]).toBe('function', 
          `Real service missing function: ${funcName}`);
      });
    });

    it('should handle getListenerStatus for non-existent port', () => {
      const status = rtpListenerService.getListenerStatus(99999);
      expect(status).toEqual({
        found: false,
        port: 99999,
        message: 'No RTP listener found on port 99999'
      });
    });

    it('should handle getFullStatus with no listeners', () => {
      const status = rtpListenerService.getFullStatus();
      expect(status).toEqual({
        totalListeners: 0,
        listeners: []
      });
    });
  });

  describe('Real UDP Operations', () => {
    it('should start and stop a real listener', async () => {
      // Start real listener
      const listener = await rtpListenerService.startRtpListenerForCall(
        testPort, 
        testCallId, 
        testAsteriskChannelId
      );
      
      expect(listener).toBeDefined();
      expect(listener.port).toBe(testPort);
      expect(listener.callId).toBe(testCallId);
      
      // Verify listener is active
      const status = rtpListenerService.getListenerStatus(testPort);
      expect(status.found).toBe(true);
      expect(status.callId).toBe(testCallId);
      expect(status.active).toBe(true);
      
      // Stop listener
      const stopped = rtpListenerService.stopRtpListenerForCall(testCallId);
      expect(stopped).toBe(true);
      
      // Verify listener is gone
      const statusAfter = rtpListenerService.getListenerStatus(testPort);
      expect(statusAfter.found).toBe(false);
    });

    it('should handle real UDP packets', async () => {
      // Start listener
      const listener = await rtpListenerService.startRtpListenerForCall(
        testPort, 
        testCallId, 
        testAsteriskChannelId
      );
      
      // Create UDP client to send test packets
      const client = dgram.createSocket('udp4');
      
      // Create test RTP packet
      const audioData = Buffer.from('test audio data');
      const rtpPacket = Buffer.alloc(12 + audioData.length);
      rtpPacket[0] = 0x80; // Version 2
      rtpPacket[1] = 0x00;
      rtpPacket.writeUInt16BE(1234, 2);
      rtpPacket.writeUInt32BE(567890, 4);
      rtpPacket.writeUInt32BE(987654321, 8);
      audioData.copy(rtpPacket, 12);
      
      // Send packet to listener
      await new Promise((resolve, reject) => {
        client.send(rtpPacket, testPort, '127.0.0.1', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Wait for packet processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check stats
      const stats = listener.getStats();
      expect(stats.packetsReceived).toBeGreaterThan(0);
      
      // Cleanup
      client.close();
      rtpListenerService.stopRtpListenerForCall(testCallId);
    });

    it('should handle port conflicts gracefully', async () => {
      // Start first listener
      await rtpListenerService.startRtpListenerForCall(
        testPort, 
        testCallId, 
        testAsteriskChannelId
      );
      
      // Try to start another listener on same port (should fail)
      const conflictCallId = `conflict-${Date.now()}`;
      
      await expect(
        rtpListenerService.startRtpListenerForCall(
          testPort, 
          conflictCallId, 
          'conflict-channel'
        )
      ).rejects.toThrow();
      
      // Cleanup
      rtpListenerService.stopRtpListenerForCall(testCallId);
    });
  });

  describe('Service Integration', () => {
    it('should work with healthCheck', async () => {
      // Start listener
      await rtpListenerService.startRtpListenerForCall(
        testPort, 
        testCallId, 
        testAsteriskChannelId
      );
      
      // Check health
      const health = rtpListenerService.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.activeListeners).toBeGreaterThan(0);
      expect(health.listeners[testCallId]).toBeDefined();
      
      // Cleanup
      rtpListenerService.stopRtpListenerForCall(testCallId);
    });

    it('should work with getAllActiveListeners', async () => {
      // Start listener
      await rtpListenerService.startRtpListenerForCall(
        testPort, 
        testCallId, 
        testAsteriskChannelId
      );
      
      // Get all listeners
      const allListeners = rtpListenerService.getAllActiveListeners();
      expect(allListeners[testCallId]).toBeDefined();
      expect(allListeners[testCallId].port).toBe(testPort);
      
      // Cleanup
      rtpListenerService.stopRtpListenerForCall(testCallId);
    });
  });
}); 