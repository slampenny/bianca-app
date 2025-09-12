const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const { Conversation, Message, Patient, Caregiver, Org } = require('../../src/models');
const { tokenService } = require('../../src/services');
const conversationService = require('../../src/services/conversation.service');
const { getOpenAISentimentServiceInstance } = require('../../src/services/openai.sentiment.service');

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

  // Generate access token
  accessToken = tokenService.generateToken(caregiver._id);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Sentiment Analysis Integration Tests', () => {
  beforeEach(async () => {
    // Clear conversations
    await Conversation.deleteMany();
    await Message.deleteMany();
  });

  describe('End-to-End Sentiment Analysis Flow', () => {
    it('should complete full sentiment analysis workflow', async () => {
      // Step 1: Create a conversation with messages
      const conversation = new Conversation({
        patientId: patientId,
        callSid: 'test-call-sid',
        lineItemId: null,
        messages: [],
        history: '',
        analyzedData: {},
        metadata: {},
        startTime: new Date(),
        endTime: null,
        duration: 0,
        status: 'active'
      });
      await conversation.save();
      conversationId = conversation._id;

      // Add messages to the conversation
      const messages = [
        new Message({
          conversationId: conversationId,
          role: 'patient',
          content: 'Hi Bianca, I am feeling really good today!',
          createdAt: new Date()
        }),
        new Message({
          conversationId: conversationId,
          role: 'assistant',
          content: 'That is wonderful to hear! What is making you feel so good?',
          createdAt: new Date()
        }),
        new Message({
          conversationId: conversationId,
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

      // Step 2: Mock OpenAI response for sentiment analysis
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

      // Step 3: Finalize conversation with sentiment analysis
      const finalizationResult = await conversationService.finalizeConversation(conversationId, false);

      expect(finalizationResult).toHaveProperty('summary');
      expect(finalizationResult).toHaveProperty('sentimentAnalysis');
      expect(finalizationResult.sentimentAnalysis).toHaveProperty('overallSentiment', 'positive');
      expect(finalizationResult.sentimentAnalysis).toHaveProperty('sentimentScore', 0.7);
      expect(finalizationResult.sentimentAnalysis).toHaveProperty('confidence', 0.9);

      // Step 4: Verify conversation was updated in database
      const updatedConversation = await Conversation.findById(conversationId);
      expect(updatedConversation.status).toBe('completed');
      expect(updatedConversation.analyzedData.sentiment).toBeDefined();
      expect(updatedConversation.analyzedData.sentiment.overallSentiment).toBe('positive');
      expect(updatedConversation.analyzedData.sentimentAnalyzedAt).toBeDefined();

      // Step 5: Test API endpoints
      // Test sentiment trend endpoint
      const trendResponse = await request(app)
        .get(`/v1/sentiment/patient/${patientId}/trend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeRange: 'month' })
        .expect(200);

      expect(trendResponse.body).toHaveProperty('patientId', patientId.toString());
      expect(trendResponse.body).toHaveProperty('dataPoints');
      expect(trendResponse.body.dataPoints).toHaveLength(1);
      expect(trendResponse.body.dataPoints[0].sentiment.overallSentiment).toBe('positive');

      // Test sentiment summary endpoint
      const summaryResponse = await request(app)
        .get(`/v1/sentiment/patient/${patientId}/summary`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(summaryResponse.body).toHaveProperty('analyzedConversations', 1);
      expect(summaryResponse.body).toHaveProperty('averageSentiment', 0.7);
      expect(summaryResponse.body).toHaveProperty('sentimentDistribution');
      expect(summaryResponse.body.sentimentDistribution.positive).toBe(1);

      // Test conversation sentiment endpoint
      const conversationSentimentResponse = await request(app)
        .get(`/v1/sentiment/conversation/${conversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(conversationSentimentResponse.body).toHaveProperty('overallSentiment', 'positive');
      expect(conversationSentimentResponse.body).toHaveProperty('sentimentScore', 0.7);
      expect(conversationSentimentResponse.body).toHaveProperty('confidence', 0.9);
    });

    it('should handle multiple conversations with different sentiments', async () => {
      const conversations = [];
      const now = new Date();

      // Create multiple conversations with different sentiments
      const sentimentData = [
        {
          overallSentiment: 'positive',
          sentimentScore: 0.8,
          confidence: 0.9,
          patientMood: 'very happy',
          keyEmotions: ['joy', 'satisfaction'],
          concernLevel: 'low'
        },
        {
          overallSentiment: 'negative',
          sentimentScore: -0.6,
          confidence: 0.8,
          patientMood: 'frustrated',
          keyEmotions: ['frustration', 'concern'],
          concernLevel: 'high'
        },
        {
          overallSentiment: 'neutral',
          sentimentScore: 0.1,
          confidence: 0.7,
          patientMood: 'calm',
          keyEmotions: ['neutrality'],
          concernLevel: 'low'
        }
      ];

      for (let i = 0; i < 3; i++) {
        const conversation = new Conversation({
          patientId: patientId,
          callSid: `test-call-sid-${i}`,
          lineItemId: null,
          messages: [],
          history: `Test conversation ${i}`,
          analyzedData: {
            sentiment: sentimentData[i],
            sentimentAnalyzedAt: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
          },
          metadata: {},
          startTime: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000)),
          endTime: new Date(now.getTime() - (i * 24 * 60 * 60 * 1000) + 300000),
          duration: 300000,
          status: 'completed'
        });
        await conversation.save();
        conversations.push(conversation);
      }

      // Test sentiment trend with multiple conversations
      const trendResponse = await request(app)
        .get(`/v1/sentiment/patient/${patientId}/trend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeRange: 'month' })
        .expect(200);

      expect(trendResponse.body.dataPoints).toHaveLength(3);
      expect(trendResponse.body.summary.averageSentiment).toBeCloseTo(0.1, 1); // (0.8 + (-0.6) + 0.1) / 3
      expect(trendResponse.body.summary.sentimentDistribution.positive).toBe(1);
      expect(trendResponse.body.summary.sentimentDistribution.negative).toBe(1);
      expect(trendResponse.body.summary.sentimentDistribution.neutral).toBe(1);

      // Test sentiment summary
      const summaryResponse = await request(app)
        .get(`/v1/sentiment/patient/${patientId}/summary`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(summaryResponse.body.analyzedConversations).toBe(3);
      expect(summaryResponse.body.averageSentiment).toBeCloseTo(0.1, 1);
      expect(summaryResponse.body.sentimentDistribution.positive).toBe(1);
      expect(summaryResponse.body.sentimentDistribution.negative).toBe(1);
      expect(summaryResponse.body.sentimentDistribution.neutral).toBe(1);
    });

    it('should handle sentiment analysis failure gracefully', async () => {
      // Create a conversation
      const conversation = new Conversation({
        patientId: patientId,
        callSid: 'test-call-sid-fail',
        lineItemId: null,
        messages: [],
        history: 'Test conversation for failure',
        analyzedData: {},
        metadata: {},
        startTime: new Date(),
        endTime: null,
        duration: 0,
        status: 'active'
      });
      await conversation.save();

      // Add messages
      const messages = [
        new Message({
          conversationId: conversation._id,
          role: 'patient',
          content: 'I am feeling good today!',
          createdAt: new Date()
        })
      ];

      for (const message of messages) {
        await message.save();
      }

      conversation.messages = messages.map(m => m._id);
      await conversation.save();

      // Mock OpenAI error
      const OpenAI = require('openai').OpenAI;
      const mockOpenAI = new OpenAI();
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('OpenAI API error'));

      // Finalize conversation (should handle error gracefully)
      const finalizationResult = await conversationService.finalizeConversation(conversation._id, false);

      expect(finalizationResult).toHaveProperty('summary');
      expect(finalizationResult.sentimentAnalysis).toBeNull();

      // Verify conversation was still finalized
      const updatedConversation = await Conversation.findById(conversation._id);
      expect(updatedConversation.status).toBe('completed');
      expect(updatedConversation.analyzedData.sentiment).toBeUndefined();

      // Test that sentiment endpoints still work (with no sentiment data)
      const trendResponse = await request(app)
        .get(`/v1/sentiment/patient/${patientId}/trend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeRange: 'month' })
        .expect(200);

      expect(trendResponse.body.dataPoints).toHaveLength(0);
      expect(trendResponse.body.summary.averageSentiment).toBe(0);
    });

    it('should handle manual sentiment analysis', async () => {
      // Create a completed conversation without sentiment
      const conversation = new Conversation({
        patientId: patientId,
        callSid: 'test-call-sid-manual',
        lineItemId: null,
        messages: [],
        history: 'Test conversation for manual analysis',
        analyzedData: {},
        metadata: {},
        startTime: new Date(),
        endTime: new Date(),
        duration: 300000,
        status: 'completed'
      });
      await conversation.save();

      // Add messages
      const messages = [
        new Message({
          conversationId: conversation._id,
          role: 'patient',
          content: 'I am feeling really frustrated today.',
          createdAt: new Date()
        }),
        new Message({
          conversationId: conversation._id,
          role: 'assistant',
          content: 'I understand you are feeling frustrated. Can you tell me more?',
          createdAt: new Date()
        })
      ];

      for (const message of messages) {
        await message.save();
      }

      conversation.messages = messages.map(m => m._id);
      await conversation.save();

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

      // Test manual sentiment analysis endpoint
      const analysisResponse = await request(app)
        .post(`/v1/sentiment/conversation/${conversation._id}/analyze`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(analysisResponse.body).toHaveProperty('overallSentiment', 'negative');
      expect(analysisResponse.body).toHaveProperty('sentimentScore', -0.5);
      expect(analysisResponse.body).toHaveProperty('confidence', 0.8);

      // Verify conversation was updated
      const updatedConversation = await Conversation.findById(conversation._id);
      expect(updatedConversation.analyzedData.sentiment).toBeDefined();
      expect(updatedConversation.analyzedData.sentiment.overallSentiment).toBe('negative');
      expect(updatedConversation.analyzedData.sentimentAnalyzedAt).toBeDefined();
    });

    it('should handle different time ranges correctly', async () => {
      const now = new Date();
      const conversations = [];

      // Create conversations with different dates
      const dates = [
        new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000)), // 5 days ago
        new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000)), // 15 days ago
        new Date(now.getTime() - (45 * 24 * 60 * 60 * 1000)), // 45 days ago
        new Date(now.getTime() - (400 * 24 * 60 * 60 * 1000)) // 400 days ago
      ];

      for (let i = 0; i < 4; i++) {
        const conversation = new Conversation({
          patientId: patientId,
          callSid: `test-call-sid-${i}`,
          lineItemId: null,
          messages: [],
          history: `Test conversation ${i}`,
          analyzedData: {
            sentiment: {
              overallSentiment: 'positive',
              sentimentScore: 0.6,
              confidence: 0.8,
              patientMood: 'happy',
              keyEmotions: ['happiness'],
              concernLevel: 'low'
            },
            sentimentAnalyzedAt: dates[i]
          },
          metadata: {},
          startTime: dates[i],
          endTime: new Date(dates[i].getTime() + 300000),
          duration: 300000,
          status: 'completed'
        });
        await conversation.save();
        conversations.push(conversation);
      }

      // Test month time range (should include 3 conversations)
      const monthResponse = await request(app)
        .get(`/v1/sentiment/patient/${patientId}/trend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeRange: 'month' })
        .expect(200);

      expect(monthResponse.body.dataPoints).toHaveLength(3);

      // Test year time range (should include all 4 conversations)
      const yearResponse = await request(app)
        .get(`/v1/sentiment/patient/${patientId}/trend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeRange: 'year' })
        .expect(200);

      expect(yearResponse.body.dataPoints).toHaveLength(4);

      // Test lifetime time range (should include all 4 conversations)
      const lifetimeResponse = await request(app)
        .get(`/v1/sentiment/patient/${patientId}/trend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeRange: 'lifetime' })
        .expect(200);

      expect(lifetimeResponse.body.dataPoints).toHaveLength(4);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid patient ID', async () => {
      const invalidPatientId = new mongoose.Types.ObjectId();

      await request(app)
        .get(`/v1/sentiment/patient/${invalidPatientId}/trend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      await request(app)
        .get(`/v1/sentiment/patient/${invalidPatientId}/summary`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should handle invalid conversation ID', async () => {
      const invalidConversationId = new mongoose.Types.ObjectId();

      await request(app)
        .get(`/v1/sentiment/conversation/${invalidConversationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      await request(app)
        .post(`/v1/sentiment/conversation/${invalidConversationId}/analyze`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should handle unauthorized access', async () => {
      await request(app)
        .get(`/v1/sentiment/patient/${patientId}/trend`)
        .expect(401);

      await request(app)
        .get(`/v1/sentiment/patient/${patientId}/summary`)
        .expect(401);

      await request(app)
        .get(`/v1/sentiment/conversation/${conversationId}`)
        .expect(401);

      await request(app)
        .post(`/v1/sentiment/conversation/${conversationId}/analyze`)
        .expect(401);
    });

    it('should handle malformed requests', async () => {
      // Test with invalid time range
      await request(app)
        .get(`/v1/sentiment/patient/${patientId}/trend`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeRange: 'invalid' })
        .expect(400);
    });
  });
});


