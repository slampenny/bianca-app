jest.mock('../../../src/api/langChainAPI', () => ({
  langChainAPI: {
    summarizeConversation: jest.fn().mockResolvedValue('Resident reported taking medication this morning.'),
  },
}));

jest.mock('../../../src/services/openai.sentiment.service', () => ({
  getOpenAISentimentServiceInstance: jest.fn().mockReturnValue({
    analyzeSentiment: jest.fn().mockResolvedValue({
      success: true,
      data: {
        overallSentiment: 'positive',
        sentimentScore: 0.4,
        confidence: 0.85,
        summary: 'Generally positive',
        keyEmotions: ['calm'],
      },
    }),
  }),
}));

jest.mock('../../../src/utils/openaiSdk', () => ({
  getOpenAIConstructor: jest.fn(),
}));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { getOpenAIConstructor } = require('../../../src/utils/openaiSdk');
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

  it('buildEnhancedPrompt includes required call questions when org configures them', async () => {
    const orgWithQuestions = await Org.create({
      name: 'Question Org',
      email: 'questions@test.com',
      country: 'US',
      requiredCallQuestions: {
        enabled: true,
        questions: [{ id: 'med', prompt: 'Have you taken your medication today?' }],
      },
    });
    const client = await Client.create({
      name: 'Resident',
      email: 'resident@test.com',
      phone: '+16045624264',
      preferredLanguage: 'en',
      org: orgWithQuestions._id,
    });

    const prompt = await conversationService.buildEnhancedPrompt(client._id.toString(), 'outbound');
    expect(prompt).toContain('REQUIRED CHECK-IN QUESTIONS');
    expect(prompt).toContain('med — Have you taken your medication today?');
    expect(prompt).toContain("I'd like to check in on with you");
    // Org/facility name must not be framed as the source of questions
    expect(prompt).not.toMatch(/care team/i);
  });

  it('finalizeConversation stores required question answers in analyzedData', async () => {
    const mockCreate = jest.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: '[{"questionId":"med","answer":"Yes, took them","asked":true}]',
          },
        },
      ],
    });
    getOpenAIConstructor.mockReturnValue(
      jest.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
      }))
    );

    const orgWithQuestions = await Org.create({
      name: 'Capture Org',
      email: 'capture@test.com',
      country: 'US',
      requiredCallQuestions: {
        enabled: true,
        questions: [{ id: 'med', prompt: 'Have you taken your medication today?' }],
      },
    });
    const client = await Client.create({
      name: 'Resident Two',
      email: 'resident2@test.com',
      phone: '+16045624265',
      preferredLanguage: 'en',
      org: orgWithQuestions._id,
    });
    const call = await Call.create({
      clientId: client._id,
      callSid: 'CA9999999999999999',
      status: 'completed',
      duration: 90,
      startTime: new Date(),
    });
    const conversation = await conversationService.createConversationForClient(client._id, call._id);
    await Message.create({
      conversationId: conversation._id,
      role: 'assistant',
      content: 'Have you taken your medication today?',
    });
    await Message.create({
      conversationId: conversation._id,
      role: 'client',
      content: 'Yes, I took them this morning.',
    });

    await conversationService.finalizeConversation(conversation._id.toString(), true);

    const reloaded = await Conversation.findById(conversation._id).lean();
    expect(reloaded.summary).toContain('medication');
    expect(reloaded.analyzedData.requiredQuestions.answers[0]).toMatchObject({
      questionId: 'med',
      answer: 'Yes, took them',
      asked: true,
    });
    expect(reloaded.analyzedData.sentiment.overallSentiment).toBe('positive');
  });
});
