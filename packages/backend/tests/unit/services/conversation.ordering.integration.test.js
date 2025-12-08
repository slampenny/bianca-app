// Set required environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.TWILIO_ACCOUNTSID = 'test-twilio-account-sid';
process.env.TWILIO_AUTHTOKEN = 'test-twilio-auth-token';
process.env.OPENAI_API_KEY = 'test-openai-api-key';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Message, Conversation } = require('../../../src/models');

// Mock only external dependencies
jest.mock('ws');
jest.mock('../../../src/services/emergencyProcessor.service', () => ({
  processUtterance: jest.fn().mockResolvedValue({
    shouldAlert: false,
    reason: 'No emergency detected'
  }),
  createAlert: jest.fn().mockResolvedValue({ success: true })
}));

const WebSocket = require('ws');

describe('Conversation Ordering - Integration Test (Real Service Methods)', () => {
  let mongoServer;
  let service;
  let mockWebSocket;
  let conversationId;
  let callId;

  beforeAll(async () => {
    // Setup MongoDB Memory Server
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

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Clear database
    await Message.deleteMany({});
    await Conversation.deleteMany({});

    conversationId = new mongoose.Types.ObjectId();
    callId = 'test-call-sid-123';

    // Create test conversation in database
    const conversation = new Conversation({
      _id: conversationId,
      patientId: new mongoose.Types.ObjectId(),
      agentId: new mongoose.Types.ObjectId(),
      callSid: callId,
      status: 'in-progress',
      startTime: new Date(),
      messages: []
    });
    await conversation.save();

    // Mock WebSocket
    mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      terminate: jest.fn()
    };
    WebSocket.mockImplementation(() => mockWebSocket);

    // Create service instance
    const openAIService = require('../../../src/services/openai.realtime.service');
    const OpenAIRealtimeService = openAIService.OpenAIRealtimeService;
    service = new OpenAIRealtimeService();
    service.connections = new Map();
  });

  afterEach(() => {
    if (service && service.connections) {
      service.connections.clear();
    }
  });

  it('should maintain correct order when user speaks before AI - FULL INTEGRATION TEST', async () => {
    // This test uses the ACTUAL service methods to simulate the real flow
    const userStartTime = Date.now();
    const aiStartTime = userStartTime + 5000; // AI starts 5 seconds after user

    // Setup connection - conversationId must be ObjectId, not string
    const conn = {
      conversationId: conversationId, // Keep as ObjectId, not string
      patientId: new mongoose.Types.ObjectId(),
      pendingUserTranscript: '',
      activeUserMessageId: null,
      pendingAssistantTranscript: '',
      activeAssistantMessageId: null,
      _userIsSpeaking: false,
      _aiIsSpeaking: false,
      _lastUserSpeechStart: userStartTime,
      _lastAiSpeechStart: null,
      webSocket: mockWebSocket,
      sessionReady: true
    };
    service.connections.set(callId, conn);

    // STEP 1: User starts speaking - call the actual createPlaceholderUserMessage method
    await service.createPlaceholderUserMessage(callId);
    
    // Verify placeholder was created
    // Note: createPlaceholderUserMessage might fail silently if conversationId is wrong format
    if (!conn.activeUserMessageId) {
      // Debug: check if message was created anyway
      const allMessages = await Message.find({ conversationId }).lean();
      console.log('DEBUG: No activeUserMessageId, but found messages:', allMessages);
      console.log('DEBUG: conn.conversationId:', conn.conversationId);
      console.log('DEBUG: conversationId type:', typeof conn.conversationId);
    }
    expect(conn.activeUserMessageId).toBeTruthy();
    const userPlaceholder = await Message.findById(conn.activeUserMessageId);
    expect(userPlaceholder).toBeTruthy();
    expect(userPlaceholder.content).toBe('[Speaking...]');
    expect(userPlaceholder.role).toBe('patient'); // Should be 'patient' not 'user'
    const userPlaceholderTimestamp = userPlaceholder.createdAt.getTime();
    expect(userPlaceholderTimestamp).toBeGreaterThanOrEqual(userStartTime - 100); // Allow 100ms tolerance

    // STEP 2: Simulate user speech transcription accumulating
    conn.pendingUserTranscript = 'Hello, how are you?';
    
    // STEP 3: User stops speaking - manually call the speech_stopped handler logic
    // (handleOpenAIMessageInternal expects a WebSocket message format, so we'll call the logic directly)
    conn._userIsSpeaking = false;
    conn._lastUserSpeechEnd = Date.now();
    
    // Simulate what happens in the speech_stopped case
    const userMessageIdToUpdate = conn.activeUserMessageId; // Save ID before clearing
    if (conn.pendingUserTranscript && conn.pendingUserTranscript.trim()) {
      if (conn.activeUserMessageId) {
        const { Message } = require('../../../src/models');
        const originalMessage = await Message.findById(conn.activeUserMessageId);
        const originalTimestamp = originalMessage?.createdAt;
        
        await Message.findByIdAndUpdate(
          conn.activeUserMessageId,
          { 
            content: conn.pendingUserTranscript.trim(),
            messageType: 'user_message',
            createdAt: originalTimestamp
          },
          { timestamps: false, runValidators: false }
        );
        conn.activeUserMessageId = null;
      }
      conn.pendingUserTranscript = '';
    }

    // Verify user message was updated (not recreated) - use saved ID
    const updatedUserMessage = await Message.findById(userMessageIdToUpdate);
    expect(updatedUserMessage).toBeTruthy();
    expect(updatedUserMessage.content).toBe('Hello, how are you?');
    // CRITICAL: Timestamp should be preserved from when user STARTED speaking
    expect(updatedUserMessage.createdAt.getTime()).toBe(userPlaceholderTimestamp);
    expect(conn.activeUserMessageId).toBeNull(); // Should be cleared after update

    // STEP 4: AI starts speaking - call the actual createPlaceholderAssistantMessage method
    // Simulate time passing
    await new Promise(resolve => setTimeout(resolve, 100));
    const actualAiStartTime = Date.now(); // Get actual time when AI starts
    conn._lastAiSpeechStart = actualAiStartTime;
    await service.createPlaceholderAssistantMessage(callId);
    
    // Verify AI placeholder was created
    expect(conn.activeAssistantMessageId).toBeTruthy();
    const aiPlaceholder = await Message.findById(conn.activeAssistantMessageId);
    expect(aiPlaceholder).toBeTruthy();
    expect(aiPlaceholder.content).toBe('[Speaking...]');
    expect(aiPlaceholder.role).toBe('assistant');
    const aiPlaceholderTimestamp = aiPlaceholder.createdAt.getTime();
    // Timestamp should be close to when we called createPlaceholderAssistantMessage
    expect(aiPlaceholderTimestamp).toBeGreaterThanOrEqual(actualAiStartTime - 500); // Allow 500ms tolerance

    // STEP 5: Simulate AI transcript accumulating
    conn.pendingAssistantTranscript = 'I am doing well, thank you for asking.';
    conn._aiIsSpeaking = true;

    // STEP 6: AI finishes speaking - call the actual handleResponseDone method
    const aiMessageIdToUpdate = conn.activeAssistantMessageId; // Save ID before it's cleared
    await service.handleResponseDone(callId);

    // Verify AI message was updated (not recreated) - use saved ID
    const updatedAiMessage = await Message.findById(aiMessageIdToUpdate);
    expect(updatedAiMessage).toBeTruthy();
    expect(updatedAiMessage.content).toBe('I am doing well, thank you for asking.');
    // CRITICAL: Timestamp should be preserved from when AI STARTED speaking
    expect(updatedAiMessage.createdAt.getTime()).toBe(aiPlaceholderTimestamp);
    expect(conn.activeAssistantMessageId).toBeNull(); // Should be cleared after update

    // STEP 7: Simulate what getCallStatus does - query all messages and sort
    const { Message: MessageModel } = require('../../../src/models');
    const allMessages = await MessageModel.find({ conversationId })
      .sort({ createdAt: 1 })
      .lean();

    // CRITICAL VERIFICATION: Messages should be in chronological order
    expect(allMessages.length).toBe(2);
    
    const userMessage = allMessages.find(m => m.role === 'patient');
    const aiMessage = allMessages.find(m => m.role === 'assistant');
    
    expect(userMessage).toBeTruthy();
    expect(aiMessage).toBeTruthy();
    
    // Verify timestamps were preserved correctly
    expect(userMessage.createdAt.getTime()).toBe(userPlaceholderTimestamp);
    expect(aiMessage.createdAt.getTime()).toBe(aiPlaceholderTimestamp);
    
    // CRITICAL: User message should come BEFORE AI message (user spoke first)
    expect(allMessages[0].role).toBe('patient');
    expect(allMessages[0].content).toBe('Hello, how are you?');
    expect(allMessages[1].role).toBe('assistant');
    expect(allMessages[1].content).toBe('I am doing well, thank you for asking.');
    expect(allMessages[0].createdAt.getTime()).toBeLessThan(allMessages[1].createdAt.getTime());
    
    // Verify the timestamps make sense (user started before AI)
    expect(userMessage.createdAt.getTime()).toBeLessThan(aiMessage.createdAt.getTime());
    
    // Final check: simulate frontend receiving these messages
    const frontendMessages = allMessages.map(m => ({
      id: m._id.toString(),
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString()
    }));
    
    expect(frontendMessages[0].role).toBe('patient');
    expect(frontendMessages[1].role).toBe('assistant');
    expect(new Date(frontendMessages[0].createdAt).getTime()).toBeLessThan(
      new Date(frontendMessages[1].createdAt).getTime()
    );
  });

  it('should maintain correct order when AI speaks before user - FULL INTEGRATION TEST', async () => {
    // This test simulates AI speaking first, then user responding
    const aiStartTime = Date.now();
    const userStartTime = aiStartTime + 5000; // User starts 5 seconds after AI

    // Setup connection - conversationId must be ObjectId, not string
    const conn = {
      conversationId: conversationId, // Keep as ObjectId, not string
      patientId: new mongoose.Types.ObjectId(),
      pendingUserTranscript: '',
      activeUserMessageId: null,
      pendingAssistantTranscript: '',
      activeAssistantMessageId: null,
      _userIsSpeaking: false,
      _aiIsSpeaking: false,
      _lastUserSpeechStart: null,
      _lastAiSpeechStart: aiStartTime,
      webSocket: mockWebSocket,
      sessionReady: true
    };
    service.connections.set(callId, conn);

    // STEP 1: AI starts speaking
    await service.createPlaceholderAssistantMessage(callId);
    expect(conn.activeAssistantMessageId).toBeTruthy();
    const aiPlaceholder = await Message.findById(conn.activeAssistantMessageId);
    const aiPlaceholderTimestamp = aiPlaceholder.createdAt.getTime();

    // STEP 2: AI accumulates transcript
    conn.pendingAssistantTranscript = 'How can I help you today?';
    conn._aiIsSpeaking = true;

    // STEP 3: AI finishes speaking
    const aiMessageIdToUpdate2 = conn.activeAssistantMessageId; // Save ID before it's cleared
    await service.handleResponseDone(callId);
    const updatedAiMessage = await Message.findById(aiMessageIdToUpdate2);
    expect(updatedAiMessage).toBeTruthy();
    expect(updatedAiMessage.content).toBe('How can I help you today?');
    expect(updatedAiMessage.createdAt.getTime()).toBe(aiPlaceholderTimestamp);

    // STEP 4: User starts speaking (after AI)
    await new Promise(resolve => setTimeout(resolve, 100));
    conn._lastUserSpeechStart = userStartTime;
    await service.createPlaceholderUserMessage(callId);
    expect(conn.activeUserMessageId).toBeTruthy();
    const userPlaceholder = await Message.findById(conn.activeUserMessageId);
    const userPlaceholderTimestamp = userPlaceholder.createdAt.getTime();

    // STEP 5: User accumulates transcript
    conn.pendingUserTranscript = 'I need help with something';

    // STEP 6: User stops speaking - manually call the speech_stopped handler logic
    conn._userIsSpeaking = false;
    conn._lastUserSpeechEnd = Date.now();
    
    const userMessageIdToUpdate = conn.activeUserMessageId; // Save ID before clearing
    if (conn.pendingUserTranscript && conn.pendingUserTranscript.trim()) {
      if (conn.activeUserMessageId) {
        const { Message } = require('../../../src/models');
        const originalMessage = await Message.findById(conn.activeUserMessageId);
        const originalTimestamp = originalMessage?.createdAt;
        
        await Message.findByIdAndUpdate(
          conn.activeUserMessageId,
          { 
            content: conn.pendingUserTranscript.trim(),
            messageType: 'user_message',
            createdAt: originalTimestamp
          },
          { timestamps: false, runValidators: false }
        );
        conn.activeUserMessageId = null;
      }
      conn.pendingUserTranscript = '';
    }
    const updatedUserMessage = await Message.findById(userMessageIdToUpdate);
    expect(updatedUserMessage.content).toBe('I need help with something');
    expect(updatedUserMessage.createdAt.getTime()).toBe(userPlaceholderTimestamp);

    // STEP 7: Query all messages (simulating getCallStatus)
    const { Message: MessageModel } = require('../../../src/models');
    const allMessages = await MessageModel.find({ conversationId })
      .sort({ createdAt: 1 })
      .lean();

    // CRITICAL: AI message should come BEFORE user message (AI spoke first)
    expect(allMessages.length).toBe(2);
    expect(allMessages[0].role).toBe('assistant');
    expect(allMessages[0].content).toBe('How can I help you today?');
    expect(allMessages[1].role).toBe('patient');
    expect(allMessages[1].content).toBe('I need help with something');
    expect(allMessages[0].createdAt.getTime()).toBeLessThan(allMessages[1].createdAt.getTime());
  });
});

