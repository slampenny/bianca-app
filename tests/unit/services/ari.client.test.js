const WebSocket = require('ws');
const EventEmitter = require('events');

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
    url: 'http://localhost:8088/ari',
    username: 'testuser',
    password: 'testpass',
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

jest.mock('../../../src/utils/network.utils', () => ({
  getAsteriskIP: jest.fn(() => '127.0.0.1'),
  getRTPAddress: jest.fn(() => Promise.resolve('127.0.0.1')),
  getNetworkDebugInfo: jest.fn(() => Promise.resolve({
    environment: { NETWORK_MODE: 'test', USE_PRIVATE_NETWORK_FOR_RTP: false },
    rtpAddress: '127.0.0.1',
    asteriskIP: '127.0.0.1'
  }))
}));

jest.mock('ari-client', () => ({
  connect: jest.fn()
}));

jest.mock('ws');
jest.mock('events');

// Import the service after mocking dependencies
let ariClientModule;
let AsteriskAriClient;
let mockAriClient;

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
    ariClientModule = require('../../../src/services/ari.client');
    AsteriskAriClient = ariClientModule.AsteriskAriClient;
    
    // Mock the AriClient.connect function
    const AriClient = require('ari-client');
    mockAriClient = {
      applications: {
        list: jest.fn().mockResolvedValue([
          { name: 'test-app' }
        ])
      },
      on: jest.fn(),
      close: jest.fn()
    };
    AriClient.connect.mockResolvedValue(mockAriClient);
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
    
    // Create fresh service instance for each test
    service = new AsteriskAriClient();
  });

  afterEach(async () => {
    // Clean up service
    if (service && typeof service.shutdown === 'function') {
      await service.shutdown();
    }
  });

  afterAll(async () => {
    // Final cleanup
    if (service && typeof service.shutdown === 'function') {
      await service.shutdown();
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
      expect(service.RTP_BIANCA_HOST).toBeNull(); // Initially null until network config
      expect(service.RTP_ASTERISK_HOST).toBe('127.0.0.1');
    });

    it('should set global reference', () => {
      expect(global.ariClient).toBe(service);
    });
  });

  describe('start()', () => {
    it('should start ARI client successfully', async () => {
      await service.start();
      
      const AriClient = require('ari-client');
      expect(AriClient.connect).toHaveBeenCalledWith(
        'http://localhost:8088/ari',
        'testuser',
        'testpass',
        expect.objectContaining({
          keepAliveIntervalMs: 20000,
          perMessageDeflate: false,
          reconnect: expect.any(Object)
        })
      );
      expect(service.isConnected).toBe(true);
      expect(service.client).toBe(mockAriClient);
    });

    it('should handle connection failure', async () => {
      const AriClient = require('ari-client');
      AriClient.connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(service.start()).rejects.toThrow('Connection failed');
      expect(service.isConnected).toBe(false);
    });

    it('should handle already connected state', async () => {
      service.isConnected = true;
      
      await service.start();
      
      const AriClient = require('ari-client');
      expect(AriClient.connect).not.toHaveBeenCalled();
    });
  });

  describe('waitForReady()', () => {
    it('should wait for ready state', async () => {
      service.isConnected = true;
      service.client = mockAriClient;
      
      const result = await service.waitForReady();
      
      expect(result).toBe(true);
      expect(mockAriClient.applications.list).toHaveBeenCalled();
    });

    it('should throw error if not connected', async () => {
      service.isConnected = false;
      
      await expect(service.waitForReady()).rejects.toThrow('ARI client not connected');
    });
  });

  describe('healthCheck()', () => {
    it('should return health status when connected', async () => {
      service.isConnected = true;
      service.retryCount = 0;
      mockChannelTracker.calls.size = 0;
      
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
      service.retryCount = 0;
      mockChannelTracker.calls.size = 0;
      
      const health = await service.healthCheck();
      
      expect(health).toEqual({
        healthy: false,
        connected: false,
        retryCount: 0,
        activeCalls: 0
      });
    });
  });

  describe('updateCallState()', () => {
    it('should update call state successfully', () => {
      const channelId = 'test-channel-id';
      
      service.updateCallState(channelId, 'new_state');
      
      expect(mockChannelTracker.updateCall).toHaveBeenCalledWith(
        channelId,
        { state: 'new_state' }
      );
    });
  });

  describe('safeHangup()', () => {
    it('should hangup channel successfully', async () => {
      const mockChannel = {
        id: 'test-channel-id',
        hangup: jest.fn().mockResolvedValue()
      };
      
      await service.safeHangup(mockChannel, 'Test reason');
      
      expect(mockChannel.hangup).toHaveBeenCalledWith('Test reason');
    });

    it('should handle hangup errors gracefully', async () => {
      const mockChannel = {
        id: 'test-channel-id',
        hangup: jest.fn().mockRejectedValue(new Error('Hangup failed'))
      };
      
      await service.safeHangup(mockChannel, 'Test reason');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error hanging up channel')
      );
    });
  });

  describe('safeDestroy()', () => {
    it('should destroy bridge successfully', async () => {
      const mockBridge = {
        id: 'test-bridge-id',
        destroy: jest.fn().mockResolvedValue()
      };
      
      await service.safeDestroy(mockBridge, 'Test reason');
      
      expect(mockBridge.destroy).toHaveBeenCalled();
    });

    it('should handle destroy errors gracefully', async () => {
      const mockBridge = {
        id: 'test-bridge-id',
        destroy: jest.fn().mockRejectedValue(new Error('Destroy failed'))
      };
      
      await service.safeDestroy(mockBridge, 'Test reason');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error destroying bridge')
      );
    });
  });

  describe('cleanupChannel()', () => {
    it('should cleanup channel successfully', async () => {
      const channelId = 'test-channel-id';
      
      mockChannelTracker.getCall.mockReturnValue({
        state: 'active',
        resources: { channels: [], bridges: [], recordings: [] }
      });
      
      await service.cleanupChannel(channelId, 'Test reason');
      
      expect(mockOpenAIService.disconnect).toHaveBeenCalled();
      expect(mockRtpListenerService.stopRtpListenerForCall).toHaveBeenCalled();
      expect(mockPortManager.releasePorts).toHaveBeenCalled();
      expect(mockChannelTracker.removeCall).toHaveBeenCalled();
    });

    it('should handle missing call data', async () => {
      const channelId = 'test-channel-id';
      
      mockChannelTracker.getCall.mockReturnValue(null);
      
      await service.cleanupChannel(channelId, 'Test reason');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No call data found')
      );
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

    it('should handle missing call data', async () => {
      mockChannelTracker.getCall.mockReturnValue(null);
      
      await service.handleStasisEnd(mockEvent, mockChannel);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No call data found')
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
    });

    it('should handle conversation creation failure', async () => {
      mockModels.Conversation.create.mockRejectedValue(new Error('Database error'));
      
      await service.setupMediaPipeline(mockChannel, mockTwilioCallSid, mockPatientId);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create conversation')
      );
    });
  });

  describe('Circuit breaker functionality', () => {
    it('should handle circuit breaker state changes', async () => {
      const AriClient = require('ari-client');
      AriClient.connect.mockRejectedValue(new Error('Connection failed'));
      
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