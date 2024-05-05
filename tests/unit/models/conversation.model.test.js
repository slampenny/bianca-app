const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Message, Conversation } = require('../../../src/models');

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

describe('Conversation Model Test', () => {
  it('create & save conversation successfully', async () => {
    const conversationData = { patientId: new mongoose.Types.ObjectId() };
    const validConversation = new Conversation(conversationData);
    const savedConversation = await validConversation.save();

    expect(savedConversation._id).toBeDefined();
    expect(savedConversation.patientId.toString()).toBe(conversationData.patientId.toString());
    expect(savedConversation.messages).toEqual(expect.arrayContaining([]));
  });

  // Add more tests as needed
});

describe('Message Model Test', () => {
  it('create & save message successfully', async () => {
    const messageData = { role: 'patient', content: 'Hello, world!' };
    const validMessage = new Message(messageData);
    const savedMessage = await validMessage.save();

    expect(savedMessage._id).toBeDefined();
    expect(savedMessage.role).toBe(messageData.role);
    expect(savedMessage.content).toBe(messageData.content);
  });

  // Add more tests as needed
});