const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const conversationService = require('../../../src/services/conversation.service');
const { Conversation, Message, Client, Call, Org } = require('../../../src/models');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start(); // Fix: Use start() function instead of new keyword
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('conversationService', () => {
  let testOrg;

  beforeAll(async () => {
    // Create a test org for all tests
    testOrg = await Org.create({
      name: 'Test Org',
      email: 'testorg@example.com',
      country: 'US',
    });
  });

  beforeEach(async () => {
    await Client.deleteMany();
    await Conversation.deleteMany();
    await Message.deleteMany();
    await Call.deleteMany();
  });

  it('should create a new conversation for a client', async () => {
    // Create a client first
    const client = new Client({
      name: 'Test Client',
      email: 'test@example.com',
      phone: '+16045624263',
      preferredLanguage: 'en',
      org: testOrg._id
    });
    await client.save();

    // Create a call first (conversations require a callId)
    const call = new Call({
      clientId: client._id,
      callSid: 'CA1234567890abcdef',
      status: 'completed',
      duration: 60
    });
    await call.save();

    const conversation = await conversationService.createConversationForClient(client._id, call._id);
    expect(conversation).toHaveProperty('_id');
    expect(conversation).toHaveProperty('clientId');
    expect(conversation.clientId.toString()).toBe(client._id.toString());
    expect(conversation).toHaveProperty('callId', call._id);
  });

  it('should add a message to a conversation', async () => {
    // Create a client first
    const client = new Client({
      name: 'Test Client',
      email: 'test@example.com',
      phone: '+16045624263',
      preferredLanguage: 'en',
      org: testOrg._id
    });
    await client.save();

    // Create a call first
    const call = new Call({
      clientId: client._id,
      callSid: 'CA1234567890abcdef',
      status: 'completed',
      duration: 60
    });
    await call.save();

    const conversation = await conversationService.createConversationForClient(client._id, call._id);
    const messageContent = 'Hello, world!';
    const updatedConversation = await conversationService.addMessageToConversation(
      conversation._id,
      'client',
      messageContent
    );
    expect(updatedConversation.messages).toHaveLength(1);
    const message = await Message.findById(updatedConversation.messages[0]);
    expect(message).toHaveProperty('content', messageContent);
  });

  it('should get a conversation by id', async () => {
    // Create a client first
    const client = new Client({
      name: 'Test Client',
      email: 'test@example.com',
      phone: '+16045624263',
      preferredLanguage: 'en',
      org: testOrg._id
    });
    await client.save();

    // Create a call first
    const call = new Call({
      clientId: client._id,
      callSid: 'CA1234567890abcdef',
      status: 'completed',
      duration: 60
    });
    await call.save();

    const conversation = await conversationService.createConversationForClient(client._id, call._id);
    const fetchedConversation = await conversationService.getConversationById(conversation._id);
    expect(fetchedConversation).toHaveProperty('_id', conversation._id);
  });

  it('should get conversations by client', async () => {
    // Create a client first
    const client = new Client({
      name: 'Test Client',
      email: 'test@example.com',
      phone: '+16045624263',
      preferredLanguage: 'en',
      org: testOrg._id
    });
    await client.save();

    // Create calls for each conversation
    const call1 = new Call({
      clientId: client._id,
      callSid: 'CA1111111111111111',
      status: 'completed',
      duration: 60
    });
    await call1.save();

    const call2 = new Call({
      clientId: client._id,
      callSid: 'CA2222222222222222',
      status: 'completed',
      duration: 60
    });
    await call2.save();

    await conversationService.createConversationForClient(client._id, call1._id);
    await conversationService.createConversationForClient(client._id, call2._id);
    const conversations = await conversationService.getConversationsByClient(client._id);
    expect(conversations).toHaveLength(2);
  });
});
