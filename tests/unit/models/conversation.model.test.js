const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Conversation, Message } = require('../../../src/models');

describe('Conversation model', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('Conversation validation', () => {
    let validConversation;
    let validMessage;

    beforeEach(() => {
      const conversationData = { patientId: new mongoose.Types.ObjectId() };
      validConversation = new Conversation(conversationData);

      const messageData = {
        role: 'patient',
        content: 'Hello, how are you?',
        conversationId: validConversation._id,
        messageType: 'text',
      };
      validMessage = new Message(messageData);
    });

    test('should correctly validate a valid conversation', async () => {
      await expect(validConversation.validate()).resolves.toBeUndefined();
    });

    test('should correctly validate a valid message', async () => {
      await expect(validMessage.validate()).resolves.toBeUndefined();
    });

    test('should save a valid conversation', async () => {
      const savedConversation = await validConversation.save();
      expect(savedConversation._id).toBeDefined();
      expect(savedConversation.patientId).toEqual(validConversation.patientId);
    });

    test('should save a valid message', async () => {
      await validConversation.save();
      const savedMessage = await validMessage.save();
      expect(savedMessage._id).toBeDefined();
      expect(savedMessage.conversationId).toEqual(validConversation._id);
    });
  });
});
