const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const conversationService = require('../../../src/services/conversation.service');
const { Conversation, Message, Patient } = require('../../../src/models');

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
  beforeEach(async () => {
    await Patient.deleteMany();
    await Conversation.deleteMany();
    await Message.deleteMany();
  });

  it('should create a new conversation for a patient', async () => {
    // Create a patient first
    const patient = new Patient({
      name: 'Test Patient',
      email: 'test@example.com',
      phone: '+16045624263',
      preferredLanguage: 'en'
    });
    await patient.save();

    const conversation = await conversationService.createConversationForPatient(patient._id);
    expect(conversation).toHaveProperty('_id');
    expect(conversation).toHaveProperty('patientId', patient._id);
  });

  it('should add a message to a conversation', async () => {
    // Create a patient first
    const patient = new Patient({
      name: 'Test Patient',
      email: 'test@example.com',
      phone: '+16045624263',
      preferredLanguage: 'en'
    });
    await patient.save();

    const conversation = await conversationService.createConversationForPatient(patient._id);
    const messageContent = 'Hello, world!';
    const updatedConversation = await conversationService.addMessageToConversation(
      conversation._id,
      'patient',
      messageContent
    );
    expect(updatedConversation.messages).toHaveLength(1);
    const message = await Message.findById(updatedConversation.messages[0]);
    expect(message).toHaveProperty('content', messageContent);
  });

  it('should get a conversation by id', async () => {
    // Create a patient first
    const patient = new Patient({
      name: 'Test Patient',
      email: 'test@example.com',
      phone: '+16045624263',
      preferredLanguage: 'en'
    });
    await patient.save();

    const conversation = await conversationService.createConversationForPatient(patient._id);
    const fetchedConversation = await conversationService.getConversationById(conversation._id);
    expect(fetchedConversation).toHaveProperty('_id', conversation._id);
  });

  it('should get conversations by patient', async () => {
    // Create a patient first
    const patient = new Patient({
      name: 'Test Patient',
      email: 'test@example.com',
      phone: '+16045624263',
      preferredLanguage: 'en'
    });
    await patient.save();

    await conversationService.createConversationForPatient(patient._id);
    await conversationService.createConversationForPatient(patient._id);
    const conversations = await conversationService.getConversationsByPatient(patient._id);
    expect(conversations).toHaveLength(2);
  });
});
