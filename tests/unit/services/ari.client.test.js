const WebSocket = require('ws');
const EventEmitter = require('events');
const ariClient = require('../../../src/services/ari.client');

// Mock dependencies
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../../../src/config/config', () => ({
  ari: {
    maxRetries: 3,
    retryDelay: 1000,
    maxRetryDelay: 10000,
    keepAliveInterval: 20000,
    operationTimeout: 30000,
    channelSetupTimeout: 10000,
    stasisAppName: 'test-app',
    rtpSendFormat: 'ulaw',
    audioFormat: 'ulaw',
    fileExtension: 'ulaw'
  },
  asterisk: {
    rtpBiancaHost: '127.0.0.1',
    rtpAsteriskHost: '127.0.0.1'
  }
}));

jest.mock('../../../src/services/openai.realtime.service', () => ({
  initialize: jest.fn(),
  sendAudioChunk: jest.fn(),
  isConnectionReady: jest.fn(),
  disconnect: jest.fn()
}));

jest.mock('../../../src/services/channel.tracker', () => ({
  addCall: jest.fn(),
  getCall: jest.fn(),
  updateCall: jest.fn(),
  removeCall: jest.fn(),
  findCallByRtpPort: jest.fn(),
  calls: new Map()
}));

jest.mock('../../../src/services/port.manager.service', () => ({
  allocatePorts: jest.fn(),
  releasePorts: jest.fn()
}));

jest.mock('../../../src/services/rtp.listener.service', () => ({
  startRtpListenerForCall: jest.fn(),
  stopRtpListenerForCall: jest.fn(),
  getListenerForCall: jest.fn()
}));

jest.mock('../../../src/models', () => ({
  Conversation: {
    create: jest.fn()
  },
  Patient: {
    findById: jest.fn()
  }
}));

jest.mock('ws');
jest.mock('events');

// Import the service after mocking dependencies
let ARIClient;

describe('ARI Client', () => {
  let mockWebSocket;
  let mockLogger;
  let mockConfig;
  let mockOpenAIService;
  let mockChannelTracker;
  let mockPortManager;
  let mockRtpListenerService;
  let mockModels;
  let service;

  beforeAll(() => {
    // Clear module cache to ensure fresh import
    jest.resetModules();
    
    // Import the service
    ariClient = require('../../../src/services/ari.client');
    
    // Get the class constructor if available
    try {
      ARIClient = require('../../../src/services/ari.client').ARIClient;
    } catch (error) {
      // If the class is not exported directly, we'll work with the singleton instance
      ARIClient = null;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock WebSocket
    mockWebSocket = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN
    };
    WebSocket.mockImplementation(() => mockWebSocket);
    
    // Get mocked modules
    mockLogger = require('../../../src/config/logger');
    mockConfig = require('../../../src/config/config');
    mockOpenAIService = require('../../../src/services/openai.realtime.service');
    mockChannelTracker = require('../../../src/services/channel.tracker');
    mockPortManager = require('../../../src/services/port.manager.service');
    mockRtpListenerService = require('../../../src/services/rtp.listener.service');
    mockModels = require('../../../src/models');
    
    // Create service instance - use the singleton or create new instance
    if (ARIClient) {
      service = new ARIClient();
    } else {
      service = ariClient;
    }
  });

  afterEach(async () => {
    // Clean up service
    if (service && typeof service.disconnect === 'function') {
      service.disconnect();
    }
    
    if (service && typeof service.close === 'function') {
      service.close();
    }
    
    if (service && typeof service.destroy === 'function') {
      service.destroy();
    }
  });

  afterAll(async () => {
    // Final cleanup
    if (service && typeof service.disconnect === 'function') {
      service.disconnect();
    }
    
    if (service && typeof service.close === 'function') {
      service.close();
    }
    
    if (service && typeof service.destroy === 'function') {
      service.destroy();
    }
  });

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(service.client).toBeNull();
      expect(service.isConnected).toBe(false);
      expect(service.tracker).toBe(mockChannelTracker);
      expect(service.retryCount).toBe(0);
      expect(service.circuitBreaker).toBeDefined();
      expect(service.resourceManager).toBeDefined();
      expect(service.reconnectTimer).toBeNull();
      expect(service.healthCheckInterval).toBeNull();
      expect(service.RTP_BIANCA_HOST).toBe('127.0.0.1');
      expect(service.RTP_ASTERISK_HOST).toBe('127.0.0.1');
    });

    it('should set global reference', () => {
      expect(global.ariClient).toBe(service);
    });
  });

  describe('start()', () => {
    it('should start ARI client successfully', async () => {
      await service.start();
      
      expect(ARIClient.connect).toHaveBeenCalledWith(
        expect.stringContaining('http://'),
        expect.stringContaining('test-app'),
        expect.stringContaining('password')
      );
      expect(service.isConnected).toBe(true);
      expect(mockWebSocket.on).toHaveBeenCalledWith('StasisStart', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('StasisEnd', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('ChannelDestroyed', expect.any(Function));
      expect(mockWebSocket.on).toHaveBeenCalledWith('ChannelHangupRequest', expect.any(Function));
    });

    it('should handle connection failure', async () => {
      ARIClient.connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(service.start()).rejects.toThrow('Connection failed');
      expect(service.isConnected).toBe(false);
    });

    it('should handle already connected state', async () => {
      service.isConnected = true;
      
      await service.start();
      
      expect(ARIClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('waitForReady()', () => {
    it('should wait for ready state', async () => {
      service.isConnected = false;
      
      // Start connection in background
      const startPromise = service.start();
      
      // Wait for ready
      const readyPromise = service.waitForReady();
      
      // Resolve start
      await startPromise;
      
      // Ready should resolve
      await readyPromise;
    });

    it('should timeout if not ready', async () => {
      service.isConnected = false;
      
      await expect(service.waitForReady(100)).rejects.toThrow('timeout');
    });
  });

  describe('handleStasisStart()', () => {
    const mockChannel = {
      id: 'test-channel-id',
      name: 'SIP/test-123',
      state: 'Ring',
      caller: { number: '1234567890' },
      dialplan: { context: 'test-context', exten: 'test-exten' }
    };

    const mockEvent = {
      channel: mockChannel,
      args: ['test-arg1', 'test-arg2']
    };

    it('should handle main channel stasis start', async () => {
      mockChannel.name = 'SIP/test-123';
      
      await service.handleStasisStart(mockEvent, mockChannel);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('StasisStart for main channel')
      );
    });

    it('should handle unicast RTP channel stasis start', async () => {
      mockChannel.name = 'UnicastRTP/127.0.0.1:1234-...';
      
      await service.handleStasisStart(mockEvent, mockChannel);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing UnicastRTP channel')
      );
    });

    it('should handle snoop channel stasis start', async () => {
      mockChannel.name = 'Snoop/test-channel-id';
      
      await service.handleStasisStart(mockEvent, mockChannel);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing Snoop channel')
      );
    });

    it('should handle playback channel stasis start', async () => {
      mockChannel.name = 'Playback/test-file';
      
      await service.handleStasisStart(mockEvent, mockChannel);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Processing Playback channel')
      );
    });
  });

  describe('handleStasisStartForMainChannel()', () => {
    const mockChannel = {
      id: 'test-channel-id',
      name: 'SIP/test-123',
      state: 'Ring',
      caller: { number: '1234567890' },
      dialplan: { context: 'test-context', exten: 'test-exten' }
    };

    const mockEvent = {
      channel: mockChannel,
      args: ['test-arg1', 'test-arg2']
    };

    beforeEach(() => {
      mockModels.Patient.findById.mockResolvedValue({
        _id: 'test-patient-id',
        name: 'Test Patient'
      });
      mockPortManager.allocatePorts.mockResolvedValue({
        rtpReadPort: 10000,
        rtpWritePort: 10001
      });
    });

    it('should setup main channel successfully', async () => {
      await service.handleStasisStartForMainChannel(mockChannel, mockEvent);
      
      expect(mockChannelTracker.addCall).toHaveBeenCalled();
      expect(mockPortManager.allocatePorts).toHaveBeenCalled();
      expect(mockChannel.answer).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Main channel answered')
      );
    });

    it('should handle missing patient', async () => {
      mockModels.Patient.findById.mockResolvedValue(null);
      
      await service.handleStasisStartForMainChannel(mockChannel, mockEvent);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Patient not found')
      );
    });

    it('should handle port allocation failure', async () => {
      mockPortManager.allocatePorts.mockRejectedValue(new Error('Port allocation failed'));
      
      await service.handleStasisStartForMainChannel(mockChannel, mockEvent);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to allocate ports')
      );
    });

    it('should handle channel answer failure', async () => {
      mockChannel.answer.mockRejectedValue(new Error('Answer failed'));
      
      await service.handleStasisStartForMainChannel(mockChannel, mockEvent);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to answer channel')
      );
    });
  });

  describe('setupMediaPipeline()', () => {
    const mockChannel = {
      id: 'test-channel-id',
      name: 'SIP/test-123'
    };

    const mockTwilioCallSid = 'test-twilio-sid';
    const mockPatientId = 'test-patient-id';

    beforeEach(() => {
      mockModels.Conversation.create.mockResolvedValue({
        _id: 'test-conversation-id'
      });
    });

    it('should setup media pipeline successfully', async () => {
      await service.setupMediaPipeline(mockChannel, mockTwilioCallSid, mockPatientId);
      
      expect(mockModels.Conversation.create).toHaveBeenCalled();
      expect(mockOpenAIService.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Media pipeline setup completed')
      );
    });

    it('should handle conversation creation failure', async () => {
      mockModels.Conversation.create.mockRejectedValue(new Error('Database error'));
      
      await service.setupMediaPipeline(mockChannel, mockTwilioCallSid, mockPatientId);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create conversation')
      );
    });

    it('should handle OpenAI initialization failure', async () => {
      mockOpenAIService.initialize.mockResolvedValue(false);
      
      await service.setupMediaPipeline(mockChannel, mockTwilioCallSid, mockPatientId);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize OpenAI')
      );
    });
  });

  describe('handleStasisEnd()', () => {
    const mockChannel = {
      id: 'test-channel-id',
      name: 'SIP/test-123'
    };

    const mockEvent = {
      channel: mockChannel
    };

    beforeEach(() => {
      mockChannelTracker.getCall.mockReturnValue({
        state: 'active',
        resources: { channels: [mockChannel] }
      });
    });

    it('should handle stasis end for main channel', async () => {
      await service.handleStasisEnd(mockEvent, mockChannel);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('StasisEnd for main channel')
      );
    });

    it('should handle stasis end for auxiliary channel', async () => {
      mockChannel.name = 'UnicastRTP/127.0.0.1:1234-...';
      
      await service.handleStasisEnd(mockEvent, mockChannel);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('StasisEnd for auxiliary channel')
      );
    });

    it('should handle missing call data', async () => {
      mockChannelTracker.getCall.mockReturnValue(null);
      
      await service.handleStasisEnd(mockEvent, mockChannel);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No call data found')
      );
    });
  });

  describe('cleanupChannel()', () => {
    const mockChannelId = 'test-channel-id';

    beforeEach(() => {
      mockChannelTracker.getCall.mockReturnValue({
        state: 'active',
        resources: { channels: [], bridges: [], recordings: [] }
      });
    });

    it('should cleanup channel successfully', async () => {
      await service.cleanupChannel(mockChannelId, 'Test reason');
      
      expect(mockOpenAIService.disconnect).toHaveBeenCalled();
      expect(mockRtpListenerService.stopRtpListenerForCall).toHaveBeenCalled();
      expect(mockPortManager.releasePorts).toHaveBeenCalled();
      expect(mockChannelTracker.removeCall).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Channel cleanup completed')
      );
    });

    it('should handle missing call data', async () => {
      mockChannelTracker.getCall.mockReturnValue(null);
      
      await service.cleanupChannel(mockChannelId, 'Test reason');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No call data found')
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      mockOpenAIService.disconnect.mockRejectedValue(new Error('Disconnect failed'));
      
      await service.cleanupChannel(mockChannelId, 'Test reason');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during channel cleanup')
      );
    });
  });

  describe('safeHangup()', () => {
    const mockChannel = {
      id: 'test-channel-id',
      hangup: jest.fn()
    };

    it('should hangup channel successfully', async () => {
      await service.safeHangup(mockChannel, 'Test reason');
      
      expect(mockChannel.hangup).toHaveBeenCalledWith('Test reason');
    });

    it('should handle hangup errors gracefully', async () => {
      mockChannel.hangup.mockRejectedValue(new Error('Hangup failed'));
      
      await service.safeHangup(mockChannel, 'Test reason');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error hanging up channel')
      );
    });
  });

  describe('safeDestroy()', () => {
    const mockBridge = {
      id: 'test-bridge-id',
      destroy: jest.fn()
    };

    it('should destroy bridge successfully', async () => {
      await service.safeDestroy(mockBridge, 'Test reason');
      
      expect(mockBridge.destroy).toHaveBeenCalled();
    });

    it('should handle destroy errors gracefully', async () => {
      mockBridge.destroy.mockRejectedValue(new Error('Destroy failed'));
      
      await service.safeDestroy(mockBridge, 'Test reason');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error destroying bridge')
      );
    });
  });

  describe('updateCallState()', () => {
    const mockChannelId = 'test-channel-id';

    it('should update call state successfully', () => {
      service.updateCallState(mockChannelId, 'new_state');
      
      expect(mockChannelTracker.updateCall).toHaveBeenCalledWith(
        mockChannelId,
        { state: 'new_state' }
      );
    });

    it('should handle invalid state transitions', () => {
      mockChannelTracker.getCall.mockReturnValue({ state: 'invalid_state' });
      
      service.updateCallState(mockChannelId, 'new_state');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid state transition')
      );
    });
  });

  describe('healthCheck()', () => {
    it('should return health status when connected', async () => {
      service.isConnected = true;
      
      const health = await service.healthCheck();
      
      expect(health).toEqual({
        healthy: true,
        connected: true,
        retryCount: 0,
        activeCalls: 0
      });
    });

    it('should return unhealthy status when disconnected', async () => {
      service.isConnected = false;
      
      const health = await service.healthCheck();
      
      expect(health).toEqual({
        healthy: false,
        connected: false,
        retryCount: 0,
        activeCalls: 0
      });
    });
  });

  describe('cleanup()', () => {
    it('should cleanup client resources', () => {
      service.reconnectTimer = setTimeout(() => {}, 1000);
      service.healthCheckInterval = setInterval(() => {}, 1000);
      
      service.cleanup();
      
      expect(service.isConnected).toBe(false);
      expect(service.reconnectTimer).toBeNull();
      expect(service.healthCheckInterval).toBeNull();
      expect(service.resourceManager.cleanupAll).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle client errors', () => {
      const errorListener = jest.fn();
      service.on('error', errorListener);
      
      // Simulate client error
      const errorCallback = mockWebSocket.on.mock.calls.find(
        call => call[0] === 'error'
      )[1];
      
      const error = new Error('Client error');
      errorCallback(error);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('ARI client error')
      );
    });

    it('should handle disconnection', () => {
      service.isConnected = true;
      
      // Simulate disconnection
      const closeCallback = mockWebSocket.on.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      
      closeCallback();
      
      expect(service.isConnected).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('ARI client disconnected')
      );
    });
  });

  describe('Circuit breaker functionality', () => {
    it('should handle circuit breaker state changes', async () => {
      // Mock ARIClient.connect to fail
      ARIClient.connect.mockRejectedValue(new Error('Connection failed'));
      
      // Try to start multiple times to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          await service.start();
        } catch (error) {
          // Expected to fail
        }
      }
      
      expect(service.circuitBreaker.state).toBe('OPEN');
    });
  });

  describe('Resource management', () => {
    it('should track resources for channels', () => {
      const channelId = 'test-channel-id';
      const resource = { type: 'channel', id: channelId };
      
      service.resourceManager.addResource(channelId, resource);
      
      expect(service.resourceManager.resources.get(channelId)).toContain(resource);
    });

    it('should cleanup resources on channel end', () => {
      const channelId = 'test-channel-id';
      const resource = { type: 'channel', id: channelId };
      
      service.resourceManager.addResource(channelId, resource);
      service.resourceManager.removeResource(channelId, resource);
      
      expect(service.resourceManager.resources.has(channelId)).toBe(false);
    });
  });
}); 