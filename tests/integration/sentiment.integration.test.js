const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const conversationService = require('../../src/services/conversation.service');
const { getOpenAISentimentServiceInstance } = require('../../src/services/openai.sentiment.service');
const { Conversation, Message, Patient } = require('../../src/models');

// Mock the entire OpenAI Sentiment Service
jest.mock('../../src/services/openai.sentiment.service', () => ({
  getOpenAISentimentServiceInstance: jest.fn().mockReturnValue({
    analyzeConversationSentiment: jest.fn().mockResolvedValue({
      sentiment: 'positive',
      confidence: 0.8,
      reasoning: 'Mocked sentiment analysis'
    })
  })
}));

// Mock LangChain OpenAI to prevent API key issues
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'Mocked response' }),
    stream: jest.fn(),
    batch: jest.fn()
  }))
}));

// Mock config
jest.mock('../../src/config/config', () => ({
  openai: {
    apiKey: 'test-api-key'
  }
}));

// Mock logger
jest.mock('../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

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

describe('Sentiment Analysis Integration', () => {
  let patient;
  let conversation;
  let sentimentService;

  beforeEach(async () => {
    // Clear all collections
    await Patient.deleteMany();
    await Conversation.deleteMany();
    await Message.deleteMany();

    // Create a test patient
    patient = new Patient({
      name: 'Test Patient',
      email: 'test@example.com',
      phone: '+16045624263',
      preferredLanguage: 'en'
    });
    await patient.save();

    // Create a test conversation
    conversation = new Conversation({
      patientId: patient._id,
      callSid: 'test-call-sid',
      lineItemId: null,
      messages: [],
      history: '',
      analyzedData: {},
      metadata: {},
      startTime: new Date(),
      endTime: null,
      duration: 0,
      status: 'in-progress'
    });
    await conversation.save();

    // Add some test messages
    const messages = [
      new Message({
        conversationId: conversation._id,
        role: 'patient',
        content: 'Hi Bianca, I am feeling really good today!',
        createdAt: new Date()
      }),
      new Message({
        conversationId: conversation._id,
        role: 'assistant',
        content: 'That is wonderful to hear! What is making you feel so good?',
        createdAt: new Date()
      }),
      new Message({
        conversationId: conversation._id,
        role: 'patient',
        content: 'I had a great walk this morning and my medication seems to be working well.',
        createdAt: new Date()
      })
    ];

    for (const message of messages) {
      await message.save();
    }

    // Update conversation with messages
    conversation.messages = messages.map(m => m._id);
    await conversation.save();

    sentimentService = getOpenAISentimentServiceInstance();
  });

  describe('Conversation Finalization with Sentiment Analysis', () => {
    it('should finalize conversation with sentiment analysis', async () => {
      // Mock OpenAI response
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              overallSentiment: 'positive',
              sentimentScore: 0.7,
              confidence: 0.9,
              patientMood: 'cheerful and optimistic',
              keyEmotions: ['happiness', 'satisfaction'],
              concernLevel: 'low',
              satisfactionIndicators: {
                positive: ['expressed gratitude', 'mentioned feeling good'],
                negative: []
              },
              summary: 'Patient shows positive sentiment with high confidence',
              recommendations: 'Continue current care approach'
            })
          }
        }]
      };

      const OpenAI = require('openai').OpenAI;
      const mockOpenAI = new OpenAI();
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      // Finalize the conversation
      const result = await conversationService.finalizeConversation(conversation._id, false);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('sentimentAnalysis');
      expect(result.sentimentAnalysis).toHaveProperty('overallSentiment', 'positive');
      expect(result.sentimentAnalysis).toHaveProperty('sentimentScore', 0.7);
      expect(result.sentimentAnalysis).toHaveProperty('confidence', 0.9);

      // Verify conversation was updated in database
      const updatedConversation = await Conversation.findById(conversation._id);
      expect(updatedConversation.status).toBe('completed');
      expect(updatedConversation.analyzedData.sentiment).toBeDefined();
      expect(updatedConversation.analyzedData.sentiment.overallSentiment).toBe('positive');
      expect(updatedConversation.analyzedData.sentimentAnalyzedAt).toBeDefined();
    });

    it('should handle sentiment analysis failure gracefully', async () => {
      // Mock OpenAI error
      const OpenAI = require('openai').OpenAI;
      const mockOpenAI = new OpenAI();
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI API error'));

      // Finalize the conversation
      const result = await conversationService.finalizeConversation(conversation._id, false);

      expect(result).toHaveProperty('summary');
      expect(result.sentimentAnalysis).toBeNull();

      // Verify conversation was still finalized
      const updatedConversation = await Conversation.findById(conversation._id);
      expect(updatedConversation.status).toBe('completed');
      expect(updatedConversation.analyzedData.sentiment).toBeUndefined();
    });
  });

  describe('Sentiment Trend Analysis', () => {
    beforeEach(async () => {
      // Create multiple conversations with sentiment data
      const conversations = [];
      const now = new Date();
      
      for (let i = 0; i < 5; i++) {
        const conv = new Conversation({
          patientId: patient._id,
          callSid: `test-call-sid-${i}`,
          lineItemId: null,
          messages: [],
          history: `Test conversation ${i}`,
          analyzedData: {
            sentiment: {
              overallSentiment: i % 2 === 0 ? 'positive' : 'negative',
              sentimentScore: i % 2 === 0 ? 0.6 : -0.4,
              confidence: 0.8,
              patientMood: i % 2 === 0 ? 'happy' : 'frustrated',
              keyEmotions: i % 2 === 0 ? ['happiness'] : ['frustration'],
              concernLevel: 'low',
              summary: `Test summary ${i}`,
              recommendations: `Test recommendations ${i}`
            },
            sentimentAnalyzedAt: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)) // i days ago
          },
          metadata: {},
          startTime: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)),
          endTime: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000) + 300000), // 5 minutes later
          duration: 300000,
          status: 'completed'
        });
        await conv.save();
        conversations.push(conv);
      }
    });

    it('should get sentiment trend for patient', async () => {
      const trend = await conversationService.getSentimentTrend(patient._id, 'month');

      expect(trend).toHaveProperty('patientId', patient._id.toString());
      expect(trend).toHaveProperty('timeRange', 'month');
      expect(trend).toHaveProperty('dataPoints');
      expect(trend.dataPoints).toHaveLength(5);
      expect(trend).toHaveProperty('summary');
      expect(trend.summary).toHaveProperty('averageSentiment');
      expect(trend.summary).toHaveProperty('sentimentDistribution');
      expect(trend.summary).toHaveProperty('trendDirection');
      expect(trend.summary).toHaveProperty('confidence');
      expect(trend.summary).toHaveProperty('keyInsights');

      // Verify data points
      expect(trend.dataPoints[0]).toHaveProperty('conversationId');
      expect(trend.dataPoints[0]).toHaveProperty('date');
      expect(trend.dataPoints[0]).toHaveProperty('sentiment');
      expect(trend.dataPoints[0].sentiment).toHaveProperty('overallSentiment');
      expect(trend.dataPoints[0].sentiment).toHaveProperty('sentimentScore');
    });

    it('should get sentiment summary for patient', async () => {
      const summary = await conversationService.getSentimentSummary(patient._id);

      expect(summary).toHaveProperty('totalConversations');
      expect(summary).toHaveProperty('analyzedConversations');
      expect(summary).toHaveProperty('averageSentiment');
      expect(summary).toHaveProperty('sentimentDistribution');
      expect(summary).toHaveProperty('trendDirection');
      expect(summary).toHaveProperty('confidence');
      expect(summary).toHaveProperty('keyInsights');
      expect(summary).toHaveProperty('recentTrend');

      expect(summary.analyzedConversations).toBe(5);
      expect(summary.recentTrend).toHaveLength(5);
    });

    it('should handle patient with no sentiment data', async () => {
      // Create a new patient with no conversations
      const newPatient = new Patient({
        name: 'New Patient',
        email: 'new@example.com',
        phone: '+16045624264',
        preferredLanguage: 'en'
      });
      await newPatient.save();

      const trend = await conversationService.getSentimentTrend(newPatient._id, 'month');
      expect(trend.dataPoints).toHaveLength(0);
      expect(trend.summary.averageSentiment).toBe(0);
      expect(trend.summary.confidence).toBe(0);

      const summary = await conversationService.getSentimentSummary(newPatient._id);
      expect(summary.analyzedConversations).toBe(0);
      expect(summary.totalConversations).toBe(0);
    });
  });

  describe('Sentiment Data Validation', () => {
    it('should validate sentiment data structure', () => {
      const validSentimentData = {
        overallSentiment: 'positive',
        sentimentScore: 0.7,
        confidence: 0.9,
        patientMood: 'cheerful',
        keyEmotions: ['happiness'],
        concernLevel: 'low',
        summary: 'Patient is doing well',
        recommendations: 'Continue current approach'
      };

      const result = sentimentService.validateSentimentData(validSentimentData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid sentiment data', () => {
      const invalidSentimentData = {
        overallSentiment: 'invalid',
        sentimentScore: 2.0, // Invalid range
        confidence: -0.1 // Invalid range
      };

      const result = sentimentService.validateSentimentData(invalidSentimentData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});


