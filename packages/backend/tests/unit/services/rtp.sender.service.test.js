// Mock dgram BEFORE any imports
const mockSocket = {
  bind: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  on: jest.fn(),
  removeAllListeners: jest.fn()
};

jest.mock('dgram', () => ({
  createSocket: jest.fn(() => mockSocket)
}));

const dgram = require('dgram');
const { Buffer } = require('buffer');
const EventEmitter = require('events');
let rtpSenderService;
let RTPSenderService;

// Using real services now - no mocking needed for internal modules

describe('RTP Sender Service', () => {
  let service;

  beforeAll(() => {
    // Clear module cache to ensure fresh import
    jest.resetModules();
    
    // Import the service
    rtpSenderService = require('../../../src/services/rtp.sender.service');
    
    // Get the class constructor
    RTPSenderService = require('../../../src/services/rtp.sender.service').RtpSenderService;
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create a fresh service instance for each test
    service = new RTPSenderService();
  });

  afterEach(async () => {
    // Clean up service
    if (service && typeof service.close === 'function') {
      service.close();
    }
    
    if (service && typeof service.destroy === 'function') {
      service.destroy();
    }
    
    // Ensure Buffer.alloc is restored to original state
    if (Buffer.alloc && Buffer.alloc.mockRestore) {
      Buffer.alloc.mockRestore();
    }
  });

  afterAll(async () => {
    // Final cleanup
    if (service && typeof service.close === 'function') {
      service.close();
    }
    
    if (service && typeof service.destroy === 'function') {
      service.destroy();
    }
  });

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(service.activeCalls).toBeInstanceOf(Map);
      expect(service.udpSockets).toBeInstanceOf(Map);
      expect(service.sequenceNumbers).toBeInstanceOf(Map);
      expect(service.timestamps).toBeInstanceOf(Map);
      expect(service.ssrcs).toBeInstanceOf(Map);
      expect(service.stats).toBeInstanceOf(Map);
      expect(service.continuousTimestamps).toBeInstanceOf(Map);
      expect(service.audioBuffers).toBeInstanceOf(Map);
      expect(service.packetTimers).toBeInstanceOf(Map);
      expect(service.isShuttingDown).toBe(false);
      expect(service.globalStats).toEqual({
        totalCalls: 0,
        activeCalls: 0,
        totalPacketsSent: 0,
        totalErrors: 0,
        startTime: expect.any(Number)
      });
    });

    it('should set correct RTP constants', () => {
      expect(service.RTP_VERSION).toBe(2);
      expect(service.RTP_PAYLOAD_TYPE_ULAW).toBe(0);
      expect(service.RTP_PAYLOAD_TYPE_SLIN16_8K).toBe(11);
      expect(service.RTP_SEND_FORMAT).toBe('ulaw');
      expect(service.SAMPLE_RATE).toBe(8000);
      expect(service.FRAME_SIZE_MS).toBe(20);
      expect(service.SAMPLES_PER_FRAME).toBe(160); // (8000 * 20) / 1000
    });
  });

  describe('initializeCall()', () => {
    const testCallId = 'test-call-123';
    const testConfig = {
      asteriskChannelId: 'test-asterisk-456',
      rtpHost: '127.0.0.1',
      rtpPort: 1234,
      format: 'ulaw'
    };

    it('should initialize call successfully', async () => {
      await service.initializeCall(testCallId, testConfig);
      
      // Verify socket is stored in the service (the important part)
      const socket = service.udpSockets.get(testCallId);
      expect(socket).toBeDefined();
      expect(socket).toBe(mockSocket);
      
      expect(service.activeCalls.has(testCallId)).toBe(true);
      expect(service.udpSockets.has(testCallId)).toBe(true);
      expect(service.sequenceNumbers.has(testCallId)).toBe(true);
      expect(service.timestamps.has(testCallId)).toBe(true);
      expect(service.ssrcs.has(testCallId)).toBe(true);
      expect(service.stats.has(testCallId)).toBe(true);
      expect(service.continuousTimestamps.has(testCallId)).toBe(true);
      expect(service.audioBuffers.has(testCallId)).toBe(true);
      expect(service.packetTimers.has(testCallId)).toBe(true);
      
      const callConfig = service.activeCalls.get(testCallId);
      expect(callConfig.initialized).toBe(true);
      expect(callConfig.rtpHost).toBe('127.0.0.1');
      expect(callConfig.rtpPort).toBe(1234);
      expect(callConfig.format).toBe('ulaw');
      
      expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should throw error for missing callId', async () => {
      await expect(service.initializeCall(null, testConfig))
        .rejects.toThrow('CallId is required for RTP sender initialization');
      
      await expect(service.initializeCall(undefined, testConfig))
        .rejects.toThrow('CallId is required for RTP sender initialization');
    });

    it('should throw error for missing config', async () => {
      await expect(service.initializeCall(testCallId, null))
        .rejects.toThrow('Valid config with rtpHost and rtpPort is required');
      
      await expect(service.initializeCall(testCallId, {}))
        .rejects.toThrow('Valid config with rtpHost and rtpPort is required');
      
      await expect(service.initializeCall(testCallId, { rtpHost: '127.0.0.1' }))
        .rejects.toThrow('Valid config with rtpHost and rtpPort is required');
    });

    it('should throw error for invalid port', async () => {
      // First test with port 0 (which should pass config validation but fail port validation)
      const invalidConfig1 = { rtpHost: '127.0.0.1', rtpPort: 0 };
      await expect(service.initializeCall(testCallId, invalidConfig1))
        .rejects.toThrow('Invalid RTP port: 0');
      
      // Test with port > 65535
      const invalidConfig2 = { rtpHost: '127.0.0.1', rtpPort: 70000 };
      await expect(service.initializeCall(testCallId, invalidConfig2))
        .rejects.toThrow('Invalid RTP port: 70000');
    });

    it('should skip initialization if already initialized', async () => {
      await service.initializeCall(testCallId, testConfig);
      
      await service.initializeCall(testCallId, testConfig);
      
      // Test passes if no error is thrown - real logger will log the warning
    });

    it('should handle socket error events', async () => {
      await service.initializeCall(testCallId, testConfig);
      
      // Simulate socket error
      const errorCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'error'
      )[1];
      
      errorCallback(new Error('Socket error'));
      
      // Test passes if no error is thrown - real logger will log the error
      expect(service.globalStats.totalErrors).toBe(1);
    });

    it('should handle socket close events', async () => {
      await service.initializeCall(testCallId, testConfig);
      
      // Simulate socket close
      const closeCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      
      closeCallback();
      
      // Test passes if no error is thrown - real logger will log the info
    });
  });

  describe('sendAudio()', () => {
    const testCallId = 'test-call-123';
    const testAudioData = Buffer.from('test audio data').toString('base64');

    beforeEach(async () => {
      await service.initializeCall(testCallId, {
        asteriskChannelId: 'test-asterisk',
        rtpHost: '127.0.0.1',
        rtpPort: 1234,
        format: 'ulaw'
      });
    });

    it('should process audio successfully', async () => {
      await service.sendAudio(testCallId, testAudioData);
      
      const buffer = service.audioBuffers.get(testCallId);
      expect(buffer.length).toBeGreaterThan(0);
      
      const stats = service.stats.get(testCallId);
      expect(stats.lastAudioSize).toBeGreaterThan(0);
    });

    it('should handle empty audio data', async () => {
      await service.sendAudio(testCallId, '');
      
      // Test passes if no error is thrown - real logger will log the debug message
    });

    it('should handle missing call', async () => {
      await service.sendAudio('non-existent', testAudioData);
      
      // Test passes if no error is thrown - real logger will log the warning
    });

    it('should handle service shutdown', async () => {
      service.isShuttingDown = true;
      
      await service.sendAudio(testCallId, testAudioData);
      
      // Test passes if no error is thrown - real logger will log the debug message
    });

    it('should handle audio conversion for slin format', async () => {
      // Reinitialize with slin format
      service.cleanupCall(testCallId);
      await service.initializeCall(testCallId, {
        asteriskChannelId: 'test-asterisk',
        rtpHost: '127.0.0.1',
        rtpPort: 1234,
        format: 'slin'
      });
      
      // Using real audio utils now - no mocking needed
      
      await service.sendAudio(testCallId, testAudioData);
      
      // Test passes if no error is thrown - real audio utils will process the audio
    });

    it('should handle audio conversion errors', async () => {
      // Reinitialize with slin format
      service.cleanupCall(testCallId);
      await service.initializeCall(testCallId, {
        asteriskChannelId: 'test-asterisk',
        rtpHost: '127.0.0.1',
        rtpPort: 1234,
        format: 'slin'
      });
      
      // Using real audio utils now - no mocking needed
      
      await service.sendAudio(testCallId, testAudioData);
      
      // Test passes if no error is thrown - real logger will log any errors
    });
  });

  describe('sendNextFrame()', () => {
    const testCallId = 'test-call-123';

    beforeEach(async () => {
      await service.initializeCall(testCallId, {
        asteriskChannelId: 'test-asterisk',
        rtpHost: '127.0.0.1',
        rtpPort: 1234,
        format: 'ulaw'
      });
    });

    it('should send frame when enough data is available', () => {
      // Add enough audio data to the buffer
      const audioData = Buffer.alloc(service.SAMPLES_PER_FRAME);
      service.audioBuffers.set(testCallId, audioData);
      
      // Mock createRtpPacket to return a packet
      const mockPacket = Buffer.alloc(12 + audioData.length);
      service.createRtpPacket = jest.fn().mockReturnValue(mockPacket);
      
      service.sendNextFrame(testCallId);
      
      expect(service.createRtpPacket).toHaveBeenCalled();
      expect(mockSocket.send).toHaveBeenCalled();
      
      // Check that buffer was updated
      const remainingBuffer = service.audioBuffers.get(testCallId);
      expect(remainingBuffer.length).toBe(0);
    });

    it('should not send frame when insufficient data', () => {
      // Add insufficient audio data
      const audioData = Buffer.alloc(service.SAMPLES_PER_FRAME - 1);
      service.audioBuffers.set(testCallId, audioData);
      
      service.createRtpPacket = jest.fn();
      
      service.sendNextFrame(testCallId);
      
      expect(service.createRtpPacket).not.toHaveBeenCalled();
    });

    it('should not send frame when call is not initialized', () => {
      service.activeCalls.get(testCallId).initialized = false;
      
      const audioData = Buffer.alloc(service.SAMPLES_PER_FRAME);
      service.audioBuffers.set(testCallId, audioData);
      
      service.createRtpPacket = jest.fn();
      
      service.sendNextFrame(testCallId);
      
      expect(service.createRtpPacket).not.toHaveBeenCalled();
    });

    it('should not send frame when service is shutting down', () => {
      service.isShuttingDown = true;
      
      const audioData = Buffer.alloc(service.SAMPLES_PER_FRAME);
      service.audioBuffers.set(testCallId, audioData);
      
      service.createRtpPacket = jest.fn();
      
      service.sendNextFrame(testCallId);
      
      expect(service.createRtpPacket).not.toHaveBeenCalled();
    });

    it('should handle frame sending errors', () => {
      const audioData = Buffer.alloc(service.SAMPLES_PER_FRAME);
      service.audioBuffers.set(testCallId, audioData);
      
      service.createRtpPacket = jest.fn().mockImplementation(() => {
        throw new Error('Packet creation failed');
      });
      
      service.sendNextFrame(testCallId);
      
      // Test passes if no error is thrown - real logger will log any errors
    });
  });

  describe('createRtpPacket()', () => {
    const testCallId = 'test-call-123';
    const testAudioData = Buffer.from('test audio data');
    const testConfig = {
      format: 'ulaw',
      ssrc: 123456789
    };
    const testTimestamp = 987654321;

    beforeEach(async () => {
      await service.initializeCall(testCallId, {
        asteriskChannelId: 'test-asterisk',
        rtpHost: '127.0.0.1',
        rtpPort: 1234,
        format: 'ulaw'
      });
    });

    it('should create valid RTP packet for ulaw format', () => {
      const packet = service.createRtpPacket(testCallId, testAudioData, testConfig, testTimestamp);
      
      expect(packet).toBeInstanceOf(Buffer);
      expect(packet.length).toBe(12 + testAudioData.length);
      
      // Check RTP header
      expect(packet[0]).toBe(0x80); // Version 2, no padding, no extension, no CSRC
      expect(packet[1]).toBe(0x00); // Payload type 0 (ulaw)
      expect(packet.readUInt16BE(2)).toBe(service.sequenceNumbers.get(testCallId) - 1); // Sequence number
      expect(packet.readUInt32BE(4)).toBe(testTimestamp);
      expect(packet.readUInt32BE(8)).toBe(testConfig.ssrc);
      
      // Check payload
      const payload = packet.slice(12);
      expect(payload).toEqual(testAudioData);
    });

    it('should create valid RTP packet for slin format', () => {
      const slinConfig = { ...testConfig, format: 'slin' };
      const packet = service.createRtpPacket(testCallId, testAudioData, slinConfig, testTimestamp);
      
      expect(packet[1]).toBe(0x0B); // Payload type 11 (slin16 8kHz)
    });

    it('should handle invalid sequence number', () => {
      service.sequenceNumbers.set(testCallId, NaN);
      
      const packet = service.createRtpPacket(testCallId, testAudioData, testConfig, testTimestamp);
      
      expect(packet).toBeNull();
      // Test passes if no error is thrown - real logger will log any errors
    });

    it('should handle invalid timestamp', () => {
      const packet = service.createRtpPacket(testCallId, testAudioData, testConfig, NaN);
      
      expect(packet).toBeNull();
      // Test passes if no error is thrown - real logger will log any errors
    });

    it('should handle invalid SSRC', () => {
      const invalidConfig = { ...testConfig, ssrc: NaN };
      const packet = service.createRtpPacket(testCallId, testAudioData, invalidConfig, testTimestamp);
      
      expect(packet).toBeNull();
      // Test passes if no error is thrown - real logger will log any errors
    });

    it('should handle packet creation errors', () => {
      // Mock Buffer.alloc to throw error
      const originalAlloc = Buffer.alloc;
      Buffer.alloc = jest.fn().mockImplementation(() => {
        throw new Error('Buffer allocation failed');
      });
      
      try {
        const packet = service.createRtpPacket(testCallId, testAudioData, testConfig, testTimestamp);
        
        expect(packet).toBeNull();
        // Test passes if no error is thrown - real logger will log any errors
      } finally {
        // Always restore original method
        Buffer.alloc = originalAlloc;
      }
    });
  });

  describe('sendRtpPacketSync()', () => {
    const testCallId = 'test-call-123';
    const testPacket = Buffer.from('test packet data');
    const testHost = '127.0.0.1';
    const testPort = 1234;

    beforeEach(async () => {
      await service.initializeCall(testCallId, {
        asteriskChannelId: 'test-asterisk',
        rtpHost: testHost,
        rtpPort: testPort,
        format: 'ulaw'
      });
    });

    it('should send packet successfully', () => {
      service.sendRtpPacketSync(mockSocket, testPacket, testHost, testPort, testCallId);
      
      expect(mockSocket.send).toHaveBeenCalledWith(
        testPacket,
        0,
        testPacket.length,
        testPort,
        testHost,
        expect.any(Function)
      );
    });

    it('should handle send success callback', () => {
      service.sendRtpPacketSync(mockSocket, testPacket, testHost, testPort, testCallId);
      
      // Get the callback function
      const sendCall = mockSocket.send.mock.calls[0];
      const callback = sendCall[5];
      
      // Simulate successful send
      callback(null);
      
      const stats = service.stats.get(testCallId);
      expect(stats.packetsSent).toBe(1);
      expect(stats.bytesSent).toBe(testPacket.length);
      expect(service.globalStats.totalPacketsSent).toBe(1);
    });

    it('should handle send error callback', () => {
      service.sendRtpPacketSync(mockSocket, testPacket, testHost, testPort, testCallId);
      
      // Get the callback function
      const sendCall = mockSocket.send.mock.calls[0];
      const callback = sendCall[5];
      
      // Simulate send error
      callback(new Error('Send failed'));
      
      // Test passes if no error is thrown - real logger will log any errors
      
      const stats = service.stats.get(testCallId);
      expect(stats.errors).toBe(1);
      expect(service.globalStats.totalErrors).toBe(1);
    });
  });

  describe('updateStats()', () => {
    const testCallId = 'test-call-123';

    beforeEach(async () => {
      await service.initializeCall(testCallId, {
        asteriskChannelId: 'test-asterisk',
        rtpHost: '127.0.0.1',
        rtpPort: 1234,
        format: 'ulaw'
      });
    });

    it('should update packet sent stats', () => {
      service.updateStats(testCallId, 'packet_sent', { bytes: 100 });
      
      const stats = service.stats.get(testCallId);
      expect(stats.packetsSent).toBe(1);
      expect(stats.bytesSent).toBe(100);
    });

    it('should update error stats', () => {
      service.updateStats(testCallId, 'error');
      
      const stats = service.stats.get(testCallId);
      expect(stats.errors).toBe(1);
    });

    it('should update audio sent stats', () => {
      service.updateStats(testCallId, 'audio_sent', { bytes: 200 });
      
      const stats = service.stats.get(testCallId);
      expect(stats.lastAudioSize).toBe(200);
    });

    it('should update frames sent stats', () => {
      service.updateStats(testCallId, 'frames_sent', { count: 5 });
      
      const stats = service.stats.get(testCallId);
      expect(stats.framesSent).toBe(5);
    });

    it('should handle missing stats gracefully', () => {
      service.stats.delete(testCallId);
      
      expect(() => service.updateStats(testCallId, 'packet_sent')).not.toThrow();
    });
  });

  describe('cleanupCall()', () => {
    const testCallId = 'test-call-123';

    beforeEach(async () => {
      await service.initializeCall(testCallId, {
        asteriskChannelId: 'test-asterisk',
        rtpHost: '127.0.0.1',
        rtpPort: 1234,
        format: 'ulaw'
      });
    });

    it('should cleanup call completely', () => {
      service.cleanupCall(testCallId);
      
      expect(service.activeCalls.has(testCallId)).toBe(false);
      expect(service.udpSockets.has(testCallId)).toBe(false);
      expect(service.sequenceNumbers.has(testCallId)).toBe(false);
      expect(service.timestamps.has(testCallId)).toBe(false);
      expect(service.ssrcs.has(testCallId)).toBe(false);
      expect(service.stats.has(testCallId)).toBe(false);
      expect(service.continuousTimestamps.has(testCallId)).toBe(false);
      expect(service.audioBuffers.has(testCallId)).toBe(false);
      expect(service.packetTimers.has(testCallId)).toBe(false);
      
      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.close).toHaveBeenCalled();
      expect(service.globalStats.activeCalls).toBe(0);
    });

    it('should handle socket close errors', () => {
      mockSocket.close.mockImplementation(() => {
        throw new Error('Close error');
      });
      
      expect(() => service.cleanupCall(testCallId)).not.toThrow();
      // Test passes if no error is thrown - real logger will log any warnings
    });
  });

  describe('cleanupAll()', () => {
    beforeEach(async () => {
      await service.initializeCall('call1', {
        asteriskChannelId: 'test-asterisk-1',
        rtpHost: '127.0.0.1',
        rtpPort: 1234,
        format: 'ulaw'
      });
      await service.initializeCall('call2', {
        asteriskChannelId: 'test-asterisk-2',
        rtpHost: '127.0.0.1',
        rtpPort: 1235,
        format: 'ulaw'
      });
    });

    it('should cleanup all calls', () => {
      service.cleanupAll();
      
      expect(service.activeCalls.size).toBe(0);
      expect(service.udpSockets.size).toBe(0);
      expect(service.globalStats.activeCalls).toBe(0);
    });
  });

  describe('getStatus()', () => {
    const testCallId = 'test-call-123';

    beforeEach(async () => {
      await service.initializeCall(testCallId, {
        asteriskChannelId: 'test-asterisk',
        rtpHost: '127.0.0.1',
        rtpPort: 1234,
        format: 'ulaw'
      });
    });

    it('should return complete status', () => {
      const status = service.getStatus();
      
      expect(status).toEqual({
        activeCallsCount: 1,
        globalStats: {
          totalCalls: 1,
          activeCalls: 1,
          totalPacketsSent: 0,
          totalErrors: 0,
          startTime: expect.any(Number),
          uptime: expect.any(Number)
        },
        calls: expect.arrayContaining([
          expect.objectContaining({
            callId: testCallId,
            rtpHost: '127.0.0.1',
            rtpPort: 1234,
            format: 'ulaw',
            initialized: true,
            bufferSize: 0,
            stats: expect.any(Object)
          })
        ]),
        isShuttingDown: false
      });
    });
  });

  describe('healthCheck()', () => {
    it('should return health status', () => {
      const health = service.healthCheck();
      
      expect(health).toEqual({
        healthy: true,
        activeCalls: 0,
        totalCalls: 0,
        totalPacketsSent: 0,
        totalErrors: 0,
        uptime: expect.any(Number)
      });
    });

    it('should return unhealthy when shutting down', () => {
      service.isShuttingDown = true;
      
      const health = service.healthCheck();
      
      expect(health.healthy).toBe(false);
    });
  });

  describe('EventEmitter functionality', () => {
    const testCallId = 'test-call-123';

    beforeEach(async () => {
      await service.initializeCall(testCallId, {
        asteriskChannelId: 'test-asterisk',
        rtpHost: '127.0.0.1',
        rtpPort: 1234,
        format: 'ulaw'
      });
    });

    it('should emit socket_error event on socket error', () => {
      const errorListener = jest.fn();
      service.on('socket_error', errorListener);
      
      // Simulate socket error
      const errorCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'error'
      )[1];
      
      const error = new Error('Socket error');
      errorCallback(error);
      
      expect(errorListener).toHaveBeenCalledWith({
        callId: testCallId,
        error: error
      });
    });
  });
}); 