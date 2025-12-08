// Set required environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.TWILIO_ACCOUNTSID = 'test-twilio-account-sid';
process.env.TWILIO_AUTHTOKEN = 'test-twilio-auth-token';

const httpStatus = require('http-status');
const mongoose = require('mongoose');

// Only mock external dependencies
jest.mock('twilio', () => {
  const mockTwilioClient = {
    calls: jest.fn().mockReturnValue({
      update: jest.fn().mockResolvedValue({ sid: 'test-call-sid', status: 'completed' })
    })
  };
  const mockTwilio = jest.fn(() => mockTwilioClient);
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
  getOpenAIRealtimeServiceInstance: jest.fn()
}));

jest.mock('../../../src/services/channel.tracker', () => ({
  cleanupCall: jest.fn().mockResolvedValue()
}));

// Use real services - they'll use the mocked external dependencies
const callWorkflowController = require('../../../src/controllers/callWorkflow.controller');
const { conversationService, twilioCallService } = require('../../../src/services');

describe('CallWorkflow Controller - End Call', () => {
  let req;
  let res;
  let mockConversation;
  let mockOpenAIService;
  let mockConnections;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock conversation
    mockConversation = {
      _id: new mongoose.Types.ObjectId(),
      patientId: new mongoose.Types.ObjectId(),
      agentId: new mongoose.Types.ObjectId(),
      callSid: 'CA1234567890abcdef',
      asteriskChannelId: 'asterisk-channel-123',
      status: 'in-progress',
      startTime: new Date(Date.now() - 60000), // 1 minute ago
      save: jest.fn().mockResolvedValue(mockConversation),
      toObject: jest.fn().mockReturnValue(mockConversation)
    };

    // Mock connections Map
    mockConnections = new Map();
    mockConnections.set('CA1234567890abcdef', {
      conversationId: mockConversation._id,
      webSocket: { close: jest.fn(), readyState: 1 },
      _aiIsSpeaking: false,
      _userIsSpeaking: false
    });

    // Mock OpenAI service
    mockOpenAIService = {
      connections: mockConnections,
      disconnect: jest.fn().mockResolvedValue()
    };

    const { getOpenAIRealtimeServiceInstance } = require('../../../src/services/openai.realtime.service');
    getOpenAIRealtimeServiceInstance.mockReturnValue(mockOpenAIService);

    // Mock conversation service method
    jest.spyOn(conversationService, 'getConversationById').mockResolvedValue(mockConversation);

    // Mock request and response
    req = {
      params: { conversationId: mockConversation._id.toString() },
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
  });

  describe('endCall', () => {
    it('should hang up Twilio call when ending a call', async () => {
      const hangupSpy = jest.spyOn(twilioCallService, 'hangupCall');
      
      await callWorkflowController.endCall(req, res);

      // Verify Twilio call service hangupCall was called
      expect(hangupSpy).toHaveBeenCalledWith('CA1234567890abcdef');
    });

    it('should disconnect OpenAI WebSocket when ending a call', async () => {
      await callWorkflowController.endCall(req, res);

      // Verify OpenAI service was disconnected
      expect(mockOpenAIService.disconnect).toHaveBeenCalledWith('CA1234567890abcdef');
    });

    it('should cleanup Asterisk channels when ending a call', async () => {
      const { channelTracker } = require('../../../src/services');
      
      await callWorkflowController.endCall(req, res);

      // Verify Asterisk cleanup was called
      expect(channelTracker.cleanupCall).toHaveBeenCalledWith(
        'asterisk-channel-123',
        'Call ended by agent'
      );
    });

    it('should update conversation status to completed', async () => {
      await callWorkflowController.endCall(req, res);

      // Verify conversation was updated
      expect(mockConversation.status).toBe('completed');
      expect(mockConversation.save).toHaveBeenCalled();
    });

    it('should set endTime and duration when ending a call', async () => {
      await callWorkflowController.endCall(req, res);

      // Verify endTime and duration were set
      expect(mockConversation.endTime).toBeTruthy();
      expect(mockConversation.duration).toBeGreaterThan(0);
    });

    it('should handle missing callSid gracefully', async () => {
      mockConversation.callSid = null;
      mockConversation.asteriskChannelId = 'asterisk-channel-123';
      
      // Remove connection from map since we don't have callSid
      mockConnections.clear();
      mockConnections.set('asterisk-channel-123', {
        conversationId: mockConversation._id,
        webSocket: { close: jest.fn(), readyState: 1 }
      });

      const hangupSpy = jest.spyOn(twilioCallService, 'hangupCall');
      
      await callWorkflowController.endCall(req, res);

      // Should not try to hang up Twilio call (no callSid)
      expect(hangupSpy).not.toHaveBeenCalled();
      
      // But should still cleanup Asterisk
      const { channelTracker } = require('../../../src/services');
      expect(channelTracker.cleanupCall).toHaveBeenCalled();
    });

    it('should handle Twilio hangup errors gracefully', async () => {
      jest.spyOn(twilioCallService, 'hangupCall').mockRejectedValueOnce(new Error('Twilio API error'));

      await callWorkflowController.endCall(req, res);

      // Should still update conversation status even if Twilio fails
      expect(mockConversation.status).toBe('completed');
      expect(mockConversation.save).toHaveBeenCalled();
    });

    it('should find connection by conversationId', async () => {
      // Test that it finds the connection by iterating through connections
      await callWorkflowController.endCall(req, res);

      // Verify it found the connection and disconnected it
      expect(mockOpenAIService.disconnect).toHaveBeenCalledWith('CA1234567890abcdef');
    });

    it('should use fallback if connection not found by conversationId', async () => {
      // Clear connections map
      mockConnections.clear();

      await callWorkflowController.endCall(req, res);

      // Should try fallback disconnect by callSid
      expect(mockOpenAIService.disconnect).toHaveBeenCalledWith('CA1234567890abcdef');
    });
  });
});

