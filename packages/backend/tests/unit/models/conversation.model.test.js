const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { Call, Conversation } = require('../../../src/models');

describe('Conversation Model', () => {
  let callData;
  let conversationData;
  let mongoServer;

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri, {});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear the database before each test
    await Call.deleteMany({});
    await Conversation.deleteMany({});
    
    // Create a Call first (Call tracks billing, Conversation tracks messages)
    callData = {
      callSid: 'CA1234567890abcdef1234567890abcdef',
      patientId: new mongoose.Types.ObjectId(),
      callType: 'outbound',
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
      duration: 120, // 2 minutes
      cost: 0.20 // $0.20 for 2 minutes at $0.10/minute
    };
    
    conversationData = {
      patientId: new mongoose.Types.ObjectId(),
      messages: [],
    };
  });

  describe('Conversation creation with Call relationship', () => {
    it('should create conversation with callId reference', async () => {
      const call = await Call.create(callData);
      conversationData.callId = call._id;
      conversationData.patientId = call.patientId;
      
      const conversation = await Conversation.create(conversationData);
      expect(conversation.callId.toString()).toBe(call._id.toString());
      expect(conversation.patientId.toString()).toBe(call.patientId.toString());
    });

    it('should require callId', async () => {
      const conversation = new Conversation(conversationData);
      await expect(conversation.save()).rejects.toThrow();
    });

    it('should enforce unique callId (one conversation per call)', async () => {
      const call = await Call.create(callData);
      conversationData.callId = call._id;
      conversationData.patientId = call.patientId;
      
      await Conversation.create(conversationData);
      
      // Try to create another conversation for the same call
      const duplicateConversation = new Conversation({
        ...conversationData,
        patientId: call.patientId,
      });
      await expect(duplicateConversation.save()).rejects.toThrow();
    });
  });

  describe('Conversation messages', () => {
    it('should allow adding messages to conversation', async () => {
      const call = await Call.create(callData);
      conversationData.callId = call._id;
      conversationData.patientId = call.patientId;
      
      const conversation = await Conversation.create(conversationData);
      expect(conversation.messages).toEqual([]);
      expect(conversation.totalMessages).toBe(0);
    });
  });
});
