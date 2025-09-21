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

// Don't mock channel.tracker - it's our internal service

// Don't mock port.manager.service - it's our internal service

// Don't mock rtp.listener.service - it's our internal service

// Don't mock models - they're our internal models

// Don't mock network.utils - it's our internal utility

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
  let service;

  // Increase timeout for async operations
  jest.setTimeout(10000);

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
      endpoints: {
        list: jest.fn().mockResolvedValue([])
      },
      on: jest.fn(),
      close: jest.fn(),
      removeAllListeners: jest.fn(),
      start: jest.fn().mockResolvedValue()
    };
    AriClient.connect.mockResolvedValue(mockAriClient);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // EventEmitter memory leak warnings fixed by preventing setupGracefulShutdown in tests
    
    // Mock WebSocket
    mockWebSocket = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN
    };
    WebSocket.mockImplementation(() => mockWebSocket);
    
    // Get mocked modules (only external dependencies)
    mockLogger = require('../../../src/config/logger');
    mockConfig = require('../../../src/config/config');
    mockOpenAIService = require('../../../src/services/openai.realtime.service');
    
    // Create fresh service instance for each test
    // Create service instance but prevent graceful shutdown setup to avoid EventEmitter memory leak
    service = new AsteriskAriClient();
    // Mock setupGracefulShutdown to prevent adding SIGINT/SIGTERM listeners in tests
    jest.spyOn(service, 'setupGracefulShutdown').mockImplementation(() => {});
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
      expect(service.tracker).toBeDefined(); // Real channel tracker
      expect(service.retryCount).toBe(0);
      expect(service.circuitBreaker).toBeDefined();
      expect(service.resourceManager).toBeDefined();
      expect(service.reconnectTimer).toBeNull();
      expect(service.healthCheckInterval).toBeNull();
      expect(service.RTP_BIANCA_HOST).toBeNull(); // Initially null until network config
      expect(service.RTP_ASTERISK_HOST).toBeDefined(); // Will be set by getAsteriskIP()
    });

    it('should set global reference', () => {
      expect(global.ariClient).toBe(service);
    });
  });

  describe('start()', () => {
    it('should start ARI client successfully', async () => {
      // Mock the network initialization to avoid real network calls
      const networkUtils = require('../../../src/utils/network.utils');
      jest.spyOn(networkUtils, 'getRTPAddress').mockResolvedValue('127.0.0.1');
      jest.spyOn(networkUtils, 'getNetworkDebugInfo').mockResolvedValue({
        environment: { NETWORK_MODE: 'test', USE_PRIVATE_NETWORK_FOR_RTP: false },
        rtpAddress: '127.0.0.1',
        asteriskIP: '127.0.0.1'
      });
      
      // Mock waitForAsteriskReady to avoid real network calls
      jest.spyOn(service, 'waitForAsteriskReady').mockResolvedValue();
      
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
      
      networkUtils.getRTPAddress.mockRestore();
      networkUtils.getNetworkDebugInfo.mockRestore();
      service.waitForAsteriskReady.mockRestore();
    });

    it('should handle connection failure', async () => {
      const AriClient = require('ari-client');
      AriClient.connect.mockRejectedValue(new Error('Connection failed'));
      
      // Mock the network initialization
      const networkUtils = require('../../../src/utils/network.utils');
      jest.spyOn(networkUtils, 'getRTPAddress').mockResolvedValue('127.0.0.1');
      jest.spyOn(networkUtils, 'getNetworkDebugInfo').mockResolvedValue({
        environment: { NETWORK_MODE: 'test', USE_PRIVATE_NETWORK_FOR_RTP: false },
        rtpAddress: '127.0.0.1',
        asteriskIP: '127.0.0.1'
      });
      jest.spyOn(service, 'waitForAsteriskReady').mockResolvedValue();
      
      await expect(service.start()).rejects.toThrow('Connection failed');
      expect(service.isConnected).toBe(false);
      
      networkUtils.getRTPAddress.mockRestore();
      networkUtils.getNetworkDebugInfo.mockRestore();
      service.waitForAsteriskReady.mockRestore();
    });

    it('should handle already connected state', async () => {
      service.isConnected = true;
      
      // Reset AriClient.connect mock to ensure it doesn't fail
      const AriClient = require('ari-client');
      AriClient.connect.mockResolvedValue(mockAriClient);
      
      // Mock all methods that could cause timeouts
      const networkUtils = require('../../../src/utils/network.utils');
      jest.spyOn(networkUtils, 'getRTPAddress').mockResolvedValue('127.0.0.1');
      jest.spyOn(networkUtils, 'getNetworkDebugInfo').mockResolvedValue({
        environment: { NETWORK_MODE: 'test', USE_PRIVATE_NETWORK_FOR_RTP: false },
        rtpAddress: '127.0.0.1',
        asteriskIP: '127.0.0.1'
      });
      jest.spyOn(service, 'waitForAsteriskReady').mockResolvedValue();
      jest.spyOn(service, 'initializeNetworkConfiguration').mockResolvedValue();
      jest.spyOn(service, 'setupWebSocketHandlers').mockImplementation(() => {});
      jest.spyOn(service, 'setupEventHandlers').mockImplementation(() => {});
      jest.spyOn(service, 'startHealthCheck').mockImplementation(() => {});
      jest.spyOn(service, 'performConnectionTest').mockResolvedValue();
      
      await service.start();
      
      // Note: The current implementation doesn't check if already connected
      // It always tries to connect, so AriClient.connect will be called
      expect(AriClient.connect).toHaveBeenCalled();
      
      networkUtils.getRTPAddress.mockRestore();
      networkUtils.getNetworkDebugInfo.mockRestore();
      service.waitForAsteriskReady.mockRestore();
      service.initializeNetworkConfiguration.mockRestore();
      service.setupWebSocketHandlers.mockRestore();
      service.setupEventHandlers.mockRestore();
      service.startHealthCheck.mockRestore();
      service.performConnectionTest.mockRestore();
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
      service.client = mockAriClient; // Need client for health check
      service.retryCount = 0;
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.status).toBe('connected');
      expect(health.activeCalls).toBeDefined();
      expect(health.retryCount).toBe(0);
    });

    it('should return unhealthy status when disconnected', async () => {
      service.isConnected = false;
      service.retryCount = 0;
      
      const health = await service.healthCheck();
      
      expect(health.healthy).toBe(false);
      expect(health.status).toBe('disconnected');
    });
  });

  describe('updateCallState()', () => {
    it('should update call state successfully', () => {
      const channelId = 'test-channel-id';
      
      // First add a call to the tracker so updateCallState has data to work with
      service.tracker.addCall(channelId, { state: 'old_state' });
      
      // Spy on the real tracker's updateCall method
      const updateCallSpy = jest.spyOn(service.tracker, 'updateCall');
      
      service.updateCallState(channelId, 'new_state');
      
      expect(updateCallSpy).toHaveBeenCalledWith(
        channelId,
        { state: 'new_state' }
      );
      
      updateCallSpy.mockRestore();
    });
  });

  describe('safeHangup()', () => {
    it('should hangup channel successfully', async () => {
      const mockChannel = {
        id: 'test-channel-id',
        hangup: jest.fn().mockResolvedValue(),
        get: jest.fn().mockResolvedValue() // safeHangup calls channel.get() first
      };
      
      await service.safeHangup(mockChannel, 'Test reason');
      
      expect(mockChannel.get).toHaveBeenCalled();
      expect(mockChannel.hangup).toHaveBeenCalled();
    });

    it('should handle hangup errors gracefully', async () => {
      const mockChannel = {
        id: 'test-channel-id',
        hangup: jest.fn().mockRejectedValue(new Error('Hangup failed'))
      };
      
      await service.safeHangup(mockChannel, 'Test reason');
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error hanging up')
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
        expect.stringContaining('Error destroying')
      );
    });
  });

  describe('cleanupChannel()', () => {
    it('should cleanup channel successfully', async () => {
      const channelId = 'test-channel-id';
      
      const result = await service.cleanupChannel(channelId, 'Test reason');
      
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
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
        expect.stringContaining('StasisStart event')
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

    it('should handle stasis end for main channel', async () => {
      await service.handleStasisEnd(mockEvent, mockChannel);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('StasisEnd')
      );
    });
  });

  // TODO: Fix MongoDB Memory Server issue and re-enable database-dependent tests
  // describe('setupMediaPipeline()', () => {
  //   const mockChannel = {
  //     id: 'test-channel-id',
  //     name: 'SIP/test-123'
  //   };

  //   const mockTwilioCallSid = 'test-twilio-sid';
  //   const mockPatientId = 'test-patient-id';

  //   it('should setup media pipeline successfully', async () => {
  //     // Mock the port allocation to return valid ports
  //     jest.spyOn(service.tracker, 'allocatePortsForCall').mockReturnValue({
  //       readPort: 10000,
  //       writePort: 10001
  //     });
      
  //     // Create a real patient in the in-memory database
  //     const { Patient } = require('../../../src/models');
  //     const patient = new Patient({
  //       _id: mockPatientId,
  //       name: 'Test Patient'
  //     });
  //     await patient.save();
      
  //     // Mock methods that might cause timeouts
  //     jest.spyOn(service, 'initiateSnoopForExternalMedia').mockResolvedValue();
  //     jest.spyOn(service, 'checkMediaPipelineReady').mockImplementation(() => {});
      
  //     await service.setupMediaPipeline(mockChannel, mockTwilioCallSid, mockPatientId);
      
  //     expect(mockOpenAIService.initialize).toHaveBeenCalled();
      
  //     service.tracker.allocatePortsForCall.mockRestore();
  //     service.initiateSnoopForExternalMedia.mockRestore();
  //     service.checkMediaPipelineReady.mockRestore();
  //   });
  // });

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