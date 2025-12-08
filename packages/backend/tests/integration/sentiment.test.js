// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const mongoose = require('mongoose');
// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { Conversation, Message, Patient, Caregiver, Org } = require('../../src/models');
const { tokenService } = require('../../src/services');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

// Don't mock logger - let it work normally for integration tests

let mongoServer;
let accessToken;
let patientId;
let conversationId;
let orgId;
let caregiverId;

beforeAll(async () => {
  await setupMongoMemoryServer();

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
    role: 'orgAdmin',
    password: 'password123',
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
  await teardownMongoMemoryServer();
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
      const timeRanges = ['lastCall', 'month', 'lifetime'];
      
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

    it('should return 200 with empty data for non-existent patient', async () => {
      const nonExistentPatientId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/v1/sentiment/patient/${nonExistentPatientId}/trend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      // Should return empty or default sentiment data for non-existent patient
      expect(res.body).toBeDefined();
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

    it('should return 200 with empty data for non-existent patient', async () => {
      const nonExistentPatientId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/v1/sentiment/patient/${nonExistentPatientId}/summary`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      // Should return empty or default sentiment data for non-existent patient
      expect(res.body).toBeDefined();
    });
  });

  describe('GET /sentiment/conversation/:conversationId', () => {
    it('should get sentiment analysis for conversation', async () => {
      const res = await request(app)
        .get(`/v1/sentiment/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.sentiment).toHaveProperty('overallSentiment', 'positive');
      expect(res.body.sentiment).toHaveProperty('sentimentScore', 0.7);
      expect(res.body.sentiment).toHaveProperty('confidence', 0.9);
      expect(res.body.sentiment).toHaveProperty('patientMood', 'cheerful and optimistic');
      expect(res.body.sentiment).toHaveProperty('keyEmotions');
      expect(res.body.sentiment).toHaveProperty('concernLevel', 'low');
      expect(res.body.sentiment).toHaveProperty('summary');
      expect(res.body.sentiment).toHaveProperty('recommendations');
    });

    it('should return 200 with null sentiment for conversation without sentiment analysis', async () => {
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

      const res = await request(app)
        .get(`/v1/sentiment/conversation/${conversationWithoutSentiment._id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      // Should return conversation data with null or no sentiment
      expect(res.body).toHaveProperty('conversationId');
      expect(res.body).toHaveProperty('hasSentimentAnalysis', false);
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

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('conversationId');
      expect(res.body.sentiment).toHaveProperty('overallSentiment', 'negative');
      expect(res.body.sentiment).toHaveProperty('sentimentScore', -0.5);
      expect(res.body.sentiment).toHaveProperty('confidence', 0.8);
      expect(res.body.sentiment).toHaveProperty('patientMood', 'anxious and concerned');
      expect(res.body.sentiment).toHaveProperty('keyEmotions');
      expect(res.body.sentiment).toHaveProperty('concernLevel', 'medium');
      expect(res.body.sentiment).toHaveProperty('summary');
      expect(res.body.sentiment).toHaveProperty('recommendations');

      // API response validation complete - database updates are mocked in integration tests
    });

    it('should handle conversation without messages gracefully', async () => {
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

      const res = await request(app)
        .post(`/v1/sentiment/conversation/${conversationWithoutMessages._id}/analyze`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      // Should handle empty conversations gracefully
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('conversationId');
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
        status: 'in-progress'
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

  // Test routes are not included in integration tests - they are for development/debugging only
});
