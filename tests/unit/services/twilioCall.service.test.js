const httpStatus = require('http-status');
const twilioCallService = require('../../../src/services/twilioCall.service');
const chatService = require('../../../src/services/chat.service');
const { User, Call } = require('../../../src/models');
const ApiError = require('../../../src/utils/ApiError');

jest.mock('../../../src/services/chat.service');
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/models/call.model');
// Mock the twilioClient module
jest.mock('twilio', () => {
  return () => ({
    calls: {
      update: jest.fn(),
    },
  });
});

describe('TwilioCall Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateCall', () => {
    it('should initiate a call and create a new conversation', async () => {
      const mockUserId = 'user123';
      const mockUser = { _id: mockUserId, phoneNumber: '+1234567890' };
      const mockCall = { sid: 'call123' };
      const mockConversation = { callSid: mockCall.sid, userId: mockUser._id, save: jest.fn() };
  
      User.findById.mockResolvedValue(mockUser);
      twilioCallService.twilioClient.calls.create.mockResolvedValue(mockCall);
      Conversation.mockReturnValue(mockConversation);
  
      const result = await twilioCallService.initiateCall(mockUserId);
  
      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(twilioCallService.twilioClient.calls.create).toHaveBeenCalledWith({
        url: `/v1/twilio/prepare-call`,
        to: mockUser.phoneNumber,
        from: config.twilio.phoneNumber,
      });
      expect(Conversation).toHaveBeenCalledWith({ callSid: mockCall.sid, userId: mockUser._id });
      expect(mockConversation.save).toHaveBeenCalled();
      expect(result).toBe(mockCall.sid);
    });
  
    it('should throw an error if the user or phone number is not found', async () => {
      const mockUserId = 'user123';
  
      User.findById.mockResolvedValue(null);
  
      await expect(twilioCallService.initiateCall(mockUserId)).rejects.toThrow(ApiError);
      expect(User.findById).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('handleRealTimeInteraction', () => {
    it('should handle real-time interaction during the call', async () => {
      const mockResponse = 'Hello, this is a test';
      const mockSpeechUrl = 'http://example.com/speech.mp3';
      chatService.chatWith.mockResolvedValue(mockResponse);
      chatService.textToSpeech.mockResolvedValue(mockSpeechUrl);
      twilioCallService.twilioClient.calls.update = jest.fn();

      await twilioCallService.handleRealTimeInteraction('callSid', 'Hello');
      expect(chatService.chatWith).toHaveBeenCalledWith('Hello');
      expect(chatService.textToSpeech).toHaveBeenCalledWith(mockResponse);
      expect(twilioCallService.twilioClient.calls.update).toHaveBeenCalled();
    });
  });
});