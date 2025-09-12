const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { Conversation, Message, Patient, Caregiver, Org } = require('../../src/models');
const { tokenService } = require('../../src/services');

// Mock OpenAI API
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  };
});

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
let accessToken;
let patientId;
let conversationId;
let orgId;
let caregiverId;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

  // Create test data
  const org = new Org({
    name: 'Test Org',
    email: 'test@example.com',
    phone: '+16045624263',
    stripeCustomerId: 'test-stripe-id',
    isEmailVerified: true
  });
  await org.save();
  orgId = org._id;

  const caregiver = new Caregiver({
    name: 'Test Caregiver',
    email: 'caregiver@example.com',
    phone: '+16045624264',
    org: orgId,
    role: 'admin',
    patients: []
  });
  await caregiver.save();
  caregiverId = caregiver._id;

  const patient = new Patient({
    name: 'Test Patient',
    email: 'patient@example.com',
    phone: '+16045624265',
    org: orgId,
    caregivers: [caregiverId],
    preferredLanguage: 'en'
  });
  await patient.save();
  patientId = patient._id;

  // Create a conversation with sentiment data
  const conversation = new Conversation({
    patientId: patientId,
    callSid: 'test-call-sid',
    lineItemId: null,
    messages: [],
    history: 'Test conversation',
    analyzedData: {
      sentiment: {
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
      },
      sentimentAnalyzedAt: new Date()
    },
    metadata: {},
    startTime: new Date(),
    endTime: new Date(),
    duration: 300000,
    status: 'completed'
  });
  await conversation.save();
  conversationId = conversation._id;

  // Generate access token
  accessToken = tokenService.generateToken(caregiver._id);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Sentiment Analysis API', () => {
  beforeEach(async () => {
    // Clear any additional test data
    await Conversation.deleteMany({ _id: { $ne: conversationId } });
  });

  describe('GET /sentiment/patient/:patientId/trend', () => {
    it('should get sentiment trend for patient', async () => {
      const res = await request(app)
        .get(`/v1/sentiment/patient/${patientId}/trend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeRange: 'month' })
        .expect(200);

      expect(res.body).toHaveProperty('patientId', patientId.toString());
      expect(res.body).toHaveProperty('timeRange', 'month');
      expect(res.body).toHaveProperty('dataPoints');
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary).toHaveProperty('averageSentiment');
      expect(res.body.summary).toHaveProperty('sentimentDistribution');
      expect(res.body.summary).toHaveProperty('trendDirection');
      expect(res.body.summary).toHaveProperty('confidence');
      expect(res.body.summary).toHaveProperty('keyInsights');
    });

    it('should get sentiment trend with different time ranges', async () => {
      const timeRanges = ['month', 'year', 'lifetime'];
      
      for (const timeRange of timeRanges) {
        const res = await request(app)
          .get(`/v1/sentiment/patient/${patientId}/trend`)
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ timeRange })
          .expect(200);

        expect(res.body.timeRange).toBe(timeRange);
      }
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/v1/sentiment/patient/${patientId}/trend`)
        .expect(401);
    });

    it('should return 404 for non-existent patient', async () => {
      const nonExistentPatientId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/v1/sentiment/patient/${nonExistentPatientId}/trend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('GET /sentiment/patient/:patientId/summary', () => {
    it('should get sentiment summary for patient', async () => {
      const res = await request(app)
        .get(`/v1/sentiment/patient/${patientId}/summary`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('totalConversations');
      expect(res.body).toHaveProperty('analyzedConversations');
      expect(res.body).toHaveProperty('averageSentiment');
      expect(res.body).toHaveProperty('sentimentDistribution');
      expect(res.body).toHaveProperty('trendDirection');
      expect(res.body).toHaveProperty('confidence');
      expect(res.body).toHaveProperty('keyInsights');
      expect(res.body).toHaveProperty('recentTrend');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/v1/sentiment/patient/${patientId}/summary`)
        .expect(401);
    });

    it('should return 404 for non-existent patient', async () => {
      const nonExistentPatientId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/v1/sentiment/patient/${nonExistentPatientId}/summary`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('GET /sentiment/conversation/:conversationId', () => {
    it('should get sentiment analysis for conversation', async () => {
      const res = await request(app)
        .get(`/v1/sentiment/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('overallSentiment', 'positive');
      expect(res.body).toHaveProperty('sentimentScore', 0.7);
      expect(res.body).toHaveProperty('confidence', 0.9);
      expect(res.body).toHaveProperty('patientMood', 'cheerful and optimistic');
      expect(res.body).toHaveProperty('keyEmotions');
      expect(res.body).toHaveProperty('concernLevel', 'low');
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('recommendations');
    });

    it('should return 404 for conversation without sentiment analysis', async () => {
      // Create a conversation without sentiment data
      const conversationWithoutSentiment = new Conversation({
        patientId: patientId,
        callSid: 'test-call-sid-2',
        lineItemId: null,
        messages: [],
        history: 'Test conversation without sentiment',
        analyzedData: {},
        metadata: {},
        startTime: new Date(),
        endTime: new Date(),
        duration: 300000,
        status: 'completed'
      });
      await conversationWithoutSentiment.save();

      await request(app)
        .get(`/v1/sentiment/conversation/${conversationWithoutSentiment._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/v1/sentiment/conversation/${conversationId}`)
        .expect(401);
    });

    it('should return 404 for non-existent conversation', async () => {
      const nonExistentConversationId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/v1/sentiment/conversation/${nonExistentConversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('POST /sentiment/conversation/:conversationId/analyze', () => {
    it('should analyze conversation sentiment', async () => {
      // Mock OpenAI response
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              overallSentiment: 'negative',
              sentimentScore: -0.5,
              confidence: 0.8,
              patientMood: 'frustrated',
              keyEmotions: ['frustration', 'concern'],
              concernLevel: 'medium',
              summary: 'Patient shows negative sentiment',
              recommendations: 'Consider additional support'
            })
          }
        }]
      };

      const OpenAI = require('openai').OpenAI;
      const mockOpenAI = new OpenAI();
      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      // Create a conversation with messages but no sentiment
      const conversationToAnalyze = new Conversation({
        patientId: patientId,
        callSid: 'test-call-sid-3',
        lineItemId: null,
        messages: [],
        history: 'Test conversation for analysis',
        analyzedData: {},
        metadata: {},
        startTime: new Date(),
        endTime: new Date(),
        duration: 300000,
        status: 'completed'
      });
      await conversationToAnalyze.save();

      // Add messages to the conversation
      const messages = [
        new Message({
          conversationId: conversationToAnalyze._id,
          role: 'patient',
          content: 'I am feeling really frustrated today.',
          createdAt: new Date()
        }),
        new Message({
          conversationId: conversationToAnalyze._id,
          role: 'assistant',
          content: 'I understand you are feeling frustrated. Can you tell me more?',
          createdAt: new Date()
        })
      ];

      for (const message of messages) {
        await message.save();
      }

      conversationToAnalyze.messages = messages.map(m => m._id);
      await conversationToAnalyze.save();

      const res = await request(app)
        .post(`/v1/sentiment/conversation/${conversationToAnalyze._id}/analyze`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('overallSentiment', 'negative');
      expect(res.body).toHaveProperty('sentimentScore', -0.5);
      expect(res.body).toHaveProperty('confidence', 0.8);
      expect(res.body).toHaveProperty('patientMood', 'frustrated');
      expect(res.body).toHaveProperty('keyEmotions');
      expect(res.body).toHaveProperty('concernLevel', 'medium');
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('recommendations');

      // Verify conversation was updated in database
      const updatedConversation = await Conversation.findById(conversationToAnalyze._id);
      expect(updatedConversation.analyzedData.sentiment).toBeDefined();
      expect(updatedConversation.analyzedData.sentiment.overallSentiment).toBe('negative');
      expect(updatedConversation.analyzedData.sentimentAnalyzedAt).toBeDefined();
    });

    it('should return 400 for conversation without messages', async () => {
      const conversationWithoutMessages = new Conversation({
        patientId: patientId,
        callSid: 'test-call-sid-4',
        lineItemId: null,
        messages: [],
        history: 'Test conversation without messages',
        analyzedData: {},
        metadata: {},
        startTime: new Date(),
        endTime: new Date(),
        duration: 300000,
        status: 'completed'
      });
      await conversationWithoutMessages.save();

      await request(app)
        .post(`/v1/sentiment/conversation/${conversationWithoutMessages._id}/analyze`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 400 for incomplete conversation', async () => {
      const incompleteConversation = new Conversation({
        patientId: patientId,
        callSid: 'test-call-sid-5',
        lineItemId: null,
        messages: [],
        history: 'Test incomplete conversation',
        analyzedData: {},
        metadata: {},
        startTime: new Date(),
        endTime: null,
        duration: 0,
        status: 'active'
      });
      await incompleteConversation.save();

      await request(app)
        .post(`/v1/sentiment/conversation/${incompleteConversation._id}/analyze`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .post(`/v1/sentiment/conversation/${conversationId}/analyze`)
        .expect(401);
    });

    it('should return 404 for non-existent conversation', async () => {
      const nonExistentConversationId = new mongoose.Types.ObjectId();
      
      await request(app)
        .post(`/v1/sentiment/conversation/${nonExistentConversationId}/analyze`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('Test Routes', () => {
    describe('POST /test/sentiment/analyze', () => {
      it('should test sentiment analysis with sample conversation', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: JSON.stringify({
                overallSentiment: 'positive',
                sentimentScore: 0.6,
                confidence: 0.8,
                patientMood: 'content',
                keyEmotions: ['happiness'],
                concernLevel: 'low',
                summary: 'Patient shows positive sentiment',
                recommendations: 'Continue current approach'
              })
            }
          }]
        };

        const OpenAI = require('openai').OpenAI;
        const mockOpenAI = new OpenAI();
        mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

        const res = await request(app)
          .post('/v1/test/sentiment/analyze')
          .send({
            conversationText: 'Patient: I am feeling great today! Bianca: That is wonderful to hear!',
            detailed: true
          })
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('testType', 'sentiment_analysis');
        expect(res.body).toHaveProperty('result');
        expect(res.body.result).toHaveProperty('success', true);
        expect(res.body.result.data).toHaveProperty('overallSentiment', 'positive');
      });

      it('should test sentiment analysis with default conversation', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: JSON.stringify({
                overallSentiment: 'positive',
                sentimentScore: 0.7,
                confidence: 0.9
              })
            }
          }]
        };

        const OpenAI = require('openai').OpenAI;
        const mockOpenAI = new OpenAI();
        mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

        const res = await request(app)
          .post('/v1/test/sentiment/analyze')
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body.result.data).toHaveProperty('overallSentiment', 'positive');
      });
    });

    describe('GET /test/sentiment/trend/:patientId', () => {
      it('should test sentiment trend analysis', async () => {
        const res = await request(app)
          .get(`/v1/test/sentiment/trend/${patientId}`)
          .query({ timeRange: 'month' })
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('testType', 'sentiment_trend');
        expect(res.body).toHaveProperty('result');
        expect(res.body.result).toHaveProperty('patientId', patientId.toString());
        expect(res.body.result).toHaveProperty('timeRange', 'month');
      });
    });

    describe('GET /test/sentiment/summary/:patientId', () => {
      it('should test sentiment summary analysis', async () => {
        const res = await request(app)
          .get(`/v1/test/sentiment/summary/${patientId}`)
          .expect(200);

        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('testType', 'sentiment_summary');
        expect(res.body).toHaveProperty('result');
        expect(res.body.result).toHaveProperty('totalConversations');
        expect(res.body.result).toHaveProperty('analyzedConversations');
      });
    });

    describe('POST /test/sentiment/run-all-tests', () => {
      it('should run comprehensive sentiment test suite', async () => {
        const mockResponse = {
          choices: [{
            message: {
              content: JSON.stringify({
                overallSentiment: 'positive',
                sentimentScore: 0.6,
                confidence: 0.8
              })
            }
          }]
        };

        const OpenAI = require('openai').OpenAI;
        const mockOpenAI = new OpenAI();
        mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

        const res = await request(app)
          .post('/v1/test/sentiment/run-all-tests')
          .send({
            patientId: patientId,
            conversationId: conversationId
          })
          .expect(200);

        expect(res.body).toHaveProperty('success');
        expect(res.body).toHaveProperty('testType', 'comprehensive_sentiment_test_suite');
        expect(res.body).toHaveProperty('summary');
        expect(res.body).toHaveProperty('results');
        expect(res.body.summary).toHaveProperty('totalTests');
        expect(res.body.summary).toHaveProperty('successfulTests');
        expect(res.body.summary).toHaveProperty('failedTests');
      });
    });
  });
});


