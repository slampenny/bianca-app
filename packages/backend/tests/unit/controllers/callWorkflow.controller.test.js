// Set required environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.TWILIO_ACCOUNTSID = 'test-twilio-account-sid';
process.env.TWILIO_AUTHTOKEN = 'test-twilio-auth-token';

const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { Call, Conversation } = require('../../../src/models');

// Only mock external dependencies
jest.mock('twilio', () => {
  const mockTwilioClient = {
    calls: jest.fn().mockReturnValue({
      update: jest.fn().mockResolvedValue({ sid: 'test-call-sid', status: 'completed' })
    }),
    messages: jest.fn().mockReturnValue({
      create: jest.fn().mockResolvedValue({ sid: 'test-message-sid' })
    }),
    // Add api.v2010 property for SMS service connectivity test
    api: {
      v2010: {
        accounts: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue({ sid: 'test-account-sid' })
        })
      }
    }
  };
  const mockTwilio = jest.fn(() => mockTwilioClient);
  // Also add v2010 to the constructor function
  mockTwilio.v2010 = {
    accounts: jest.fn().mockReturnValue({
      messages: {
        create: jest.fn().mockResolvedValue({ sid: 'test-message-sid' })
      }
    })
  };
  mockTwilio.twiml = {
    VoiceResponse: jest.fn().mockImplementation(() => ({
      say: jest.fn().mockReturnThis(),
      dial: jest.fn().mockReturnThis(),
      toString: jest.fn().mockReturnValue('<Response></Response>')
    }))
  };
  return mockTwilio;
});

jest.mock('../../../src/services/openai.realtime.service', () => ({
  getOpenAIRealtimeServiceInstance: jest.fn(),
  getOpenAIServiceInstance: jest.fn()
}));

jest.mock('../../../src/services/channel.tracker', () => ({
  cleanupCall: jest.fn().mockResolvedValue()
}));

// Mock emergencyProcessor and localizedEmergencyDetector to prevent MongoDB connection issues during initialization
jest.mock('../../../src/services/emergencyProcessor.service', () => ({
  processUtterance: jest.fn().mockResolvedValue({ shouldAlert: false }),
  createAlert: jest.fn().mockResolvedValue({ success: true }),
  testConnectivity: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../../src/services/localizedEmergencyDetector.service', () => ({
  LocalizedEmergencyDetector: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    detectEmergency: jest.fn().mockResolvedValue({ isEmergency: false }),
    loadPhrases: jest.fn().mockResolvedValue()
  }))
}));

// Mock agenda before requiring callWorkflow controller
jest.mock('../../../src/config/agenda', () => {
  const mockAgendaInstance = {
    schedule: jest.fn(),
    jobs: jest.fn(),
    define: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    every: jest.fn(),
  };
  return { agenda: mockAgendaInstance };
});

// Setup MongoDB before importing services (services may try to connect during initialization)
const { MongoMemoryServer } = require('mongodb-memory-server');
let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Use real services - they'll use the mocked external dependencies
const callWorkflowController = require('../../../src/controllers/callWorkflow.controller');
const { conversationService, twilioCallService } = require('../../../src/services');

describe('CallWorkflow Controller - End Call', () => {
  let req;
  let res;
  let next;
  let mockConversation;
  let mockOpenAIService;
  let mockConnections;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Clear database
    await Call.deleteMany({});
    await Conversation.deleteMany({});

    const patientId = new mongoose.Types.ObjectId();
    const agentId = new mongoose.Types.ObjectId();
    const conversationId = new mongoose.Types.ObjectId();

    // Create a real Call record in the database
    const call = await Call.create({
      callSid: 'CA1234567890abcdef',
      patientId: patientId,
      agentId: agentId,
      asteriskChannelId: 'asterisk-channel-123',
      status: 'in-progress',
      startTime: new Date(Date.now() - 60000),
      duration: 0
    });
    
    // Create a real Conversation record linked to the Call
    const realConversation = await Conversation.create({
      _id: conversationId,
      patientId: patientId,
      agentId: agentId,
      callId: call._id,
      status: 'in-progress',
      messages: []
    });
    
    mockConversation = realConversation;

    // Mock connections Map
    mockConnections = new Map();
    mockConnections.set('CA1234567890abcdef', {
      conversationId: conversationId,
      webSocket: { close: jest.fn(), readyState: 1 },
      _aiIsSpeaking: false,
      _userIsSpeaking: false
    });

    // Mock OpenAI service
    mockOpenAIService = {
      connections: mockConnections,
      disconnect: jest.fn().mockResolvedValue()
    };

    const { getOpenAIRealtimeServiceInstance, getOpenAIServiceInstance } = require('../../../src/services/openai.realtime.service');
    getOpenAIRealtimeServiceInstance.mockReturnValue(mockOpenAIService);
    getOpenAIServiceInstance.mockReturnValue(mockOpenAIService);

    // Mock conversation service method to return the real conversation
    jest.spyOn(conversationService, 'getConversationById').mockResolvedValue(realConversation);

    // Mock request and response
    req = {
      params: { conversationId: conversationId.toString() },
      body: {
        outcome: 'answered',
        notes: 'Call ended by agent'
      },
      caregiver: {
        id: mockConversation.agentId
      }
    };

    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
    
    // Mock next function for catchAsync wrapper
    next = jest.fn();
  });

  describe('endCall', () => {
    it('should hang up Twilio call when ending a call', async () => {
      const hangupSpy = jest.spyOn(twilioCallService, 'hangupCall');
      
      await callWorkflowController.endCall(req, res, next);

      // Verify Twilio call service hangupCall was called
      expect(hangupSpy).toHaveBeenCalledWith('CA1234567890abcdef');
    });

    it('should disconnect OpenAI WebSocket when ending a call', async () => {
      await callWorkflowController.endCall(req, res, next);

      // Verify OpenAI service was disconnected
      expect(mockOpenAIService.disconnect).toHaveBeenCalledWith('CA1234567890abcdef');
    });

    it('should cleanup Asterisk channels when ending a call', async () => {
      const { channelTracker } = require('../../../src/services');
      
      await callWorkflowController.endCall(req, res, next);

      // Verify Asterisk cleanup was called
      expect(channelTracker.cleanupCall).toHaveBeenCalledWith(
        'asterisk-channel-123',
        'Call ended by agent'
      );
    });

    it('should update conversation status to completed', async () => {
      await callWorkflowController.endCall(req, res, next);

      // Verify Call was updated (controller updates Call, not Conversation)
      const updatedCall = await Call.findById(mockConversation.callId);
      expect(updatedCall.status).toBe('completed');
    });

    it('should set endTime and duration when ending a call', async () => {
      await callWorkflowController.endCall(req, res, next);

      // Verify Call endTime and duration were set (controller updates Call, not Conversation)
      const updatedCall = await Call.findById(mockConversation.callId);
      expect(updatedCall.endTime).toBeTruthy();
      expect(updatedCall.duration).toBeGreaterThan(0);
    });

    it('should handle missing callSid gracefully', async () => {
      // Update the Call to have no callSid
      await Call.updateOne({ _id: mockConversation.callId }, { $unset: { callSid: 1 } });
      
      // Remove connection from map since we don't have callSid
      mockConnections.clear();
      mockConnections.set('asterisk-channel-123', {
        conversationId: mockConversation._id,
        webSocket: { close: jest.fn(), readyState: 1 }
      });

      const hangupSpy = jest.spyOn(twilioCallService, 'hangupCall');
      
      await callWorkflowController.endCall(req, res, next);

      // Should not try to hang up Twilio call (no callSid)
      expect(hangupSpy).not.toHaveBeenCalled();
      
      // But should still cleanup Asterisk
      const { channelTracker } = require('../../../src/services');
      expect(channelTracker.cleanupCall).toHaveBeenCalled();
    });

    it('should handle Twilio hangup errors gracefully', async () => {
      jest.spyOn(twilioCallService, 'hangupCall').mockRejectedValueOnce(new Error('Twilio API error'));

      await callWorkflowController.endCall(req, res, next);

      // Should still update Call status even if Twilio fails (controller updates Call, not Conversation)
      const updatedCall = await Call.findById(mockConversation.callId);
      expect(updatedCall.status).toBe('completed');
    });

    it('should find connection by conversationId', async () => {
      // Test that it finds the connection by iterating through connections
      await callWorkflowController.endCall(req, res, next);

      // Verify it found the connection and disconnected it
      expect(mockOpenAIService.disconnect).toHaveBeenCalledWith('CA1234567890abcdef');
    });

    it('should use fallback if connection not found by conversationId', async () => {
      // Clear connections map
      mockConnections.clear();

      await callWorkflowController.endCall(req, res, next);

      // Should try fallback disconnect by callSid
      expect(mockOpenAIService.disconnect).toHaveBeenCalledWith('CA1234567890abcdef');
    });
  });
});

