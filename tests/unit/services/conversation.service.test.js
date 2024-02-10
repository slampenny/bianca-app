const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const conversationService = require('../../../src/services/conversation.service');
const { Conversation, Message } = require('../../../src/models');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start(); // Fix: Use start() function instead of new keyword
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('conversationService', () => {
  it('should create a new conversation for a user', async () => {
    const userId = mongoose.Types.ObjectId();
    const conversation = await conversationService.createConversationForUser(userId);
    expect(conversation).toHaveProperty('_id');
    expect(conversation).toHaveProperty('userId', userId);
  });

  it('should add a message to a conversation', async () => {
    const userId = mongoose.Types.ObjectId();
    const conversation = await conversationService.createConversationForUser(userId);
    const messageContent = 'Hello, world!';
    const updatedConversation = await conversationService.addMessageToConversation(conversation._id, 'user', messageContent);
    expect(updatedConversation.messages).toHaveLength(1);
    const message = await Message.findById(updatedConversation.messages[0]);
    expect(message).toHaveProperty('content', messageContent);
  });

  it('should get a conversation by id', async () => {
    const userId = mongoose.Types.ObjectId();
    const conversation = await conversationService.createConversationForUser(userId);
    const fetchedConversation = await conversationService.getConversationById(conversation._id);
    expect(fetchedConversation).toHaveProperty('_id', conversation._id);
  });

  it('should get conversations by user', async () => {
    const userId = mongoose.Types.ObjectId();
    await conversationService.createConversationForUser(userId);
    await conversationService.createConversationForUser(userId);
    const conversations = await conversationService.getConversationsByUser(userId);
    expect(conversations).toHaveLength(2);
  });
});