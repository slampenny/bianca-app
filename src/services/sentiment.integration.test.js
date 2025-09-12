// src/services/sentiment.integration.test.js
const mongoose = require('mongoose');
const { Conversation, Message } = require('../models');
const { getOpenAISentimentServiceInstance } = require('./openai.sentiment.service');
const conversationService = require('./conversation.service');

describe('Sentiment Analysis Integration', () => {
  let sentimentService;
  let testConversationId;
  let testPatientId;

  beforeAll(async () => {
    // Initialize sentiment service
    sentimentService = getOpenAISentimentServiceInstance();
    
    // Create a test patient ID (using a valid ObjectId format)
    testPatientId = new mongoose.Types.ObjectId();
  });

  afterAll(async () => {
    // Clean up test data
    if (testConversationId) {
      await Conversation.findByIdAndDelete(testConversationId);
    }
    await Message.deleteMany({ conversationId: testConversationId });
  });

  describe('analyzeConversationSentiment', () => {
    it('should analyze sentiment for a real conversation', async () => {
      // Create a test conversation
      const conversation = await Conversation.create({
        patientId: testPatientId,
        callSid: 'test-call-sid',
        status: 'in-progress',
        startTime: new Date()
      });
      testConversationId = conversation._id;

      // Create test messages
      const messages = [
        {
          role: 'patient',
          content: 'Hi Bianca, I\'m feeling really good today!',
          conversationId: testConversationId,
          messageType: 'user_message'
        },
        {
          role: 'assistant',
          content: 'That\'s wonderful to hear! What\'s making you feel so good?',
          conversationId: testConversationId,
          messageType: 'assistant_response'
        },
        {
          role: 'patient',
          content: 'I had a great walk this morning and my medication seems to be working well.',
          conversationId: testConversationId,
          messageType: 'user_message'
        },
        {
          role: 'assistant',
          content: 'I\'m so happy to hear that! Regular exercise and proper medication can make such a difference.',
          conversationId: testConversationId,
          messageType: 'assistant_response'
        }
      ];

      await Message.insertMany(messages);

      // Analyze sentiment
      const result = await sentimentService.analyzeConversationSentiment(testConversationId, {
        detailed: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.overallSentiment).toBeDefined();
      expect(result.data.sentimentScore).toBeDefined();
      expect(result.data.confidence).toBeDefined();

      // Verify conversation was updated with sentiment data
      const updatedConversation = await Conversation.findById(testConversationId);
      expect(updatedConversation.analyzedData.sentiment).toBeDefined();
      expect(updatedConversation.analyzedData.sentimentAnalyzedAt).toBeDefined();
      expect(updatedConversation.analyzedData.sentiment.overallSentiment).toBe(result.data.overallSentiment);
    }, 30000);
  });

  describe('conversation finalization with sentiment', () => {
    it('should include sentiment analysis in conversation finalization', async () => {
      // Create another test conversation
      const conversation = await Conversation.create({
        patientId: testPatientId,
        callSid: 'test-call-sid-2',
        status: 'in-progress',
        startTime: new Date()
      });
      const conversationId = conversation._id;

      // Create test messages with mixed sentiment
      const messages = [
        {
          role: 'patient',
          content: 'I\'m feeling a bit worried about my upcoming surgery.',
          conversationId: conversationId,
          messageType: 'user_message'
        },
        {
          role: 'assistant',
          content: 'I understand your concerns. It\'s completely normal to feel anxious before surgery.',
          conversationId: conversationId,
          messageType: 'assistant_response'
        },
        {
          role: 'patient',
          content: 'Thank you for understanding. I feel better talking about it.',
          conversationId: conversationId,
          messageType: 'user_message'
        }
      ];

      await Message.insertMany(messages);

      // Finalize conversation (this should trigger sentiment analysis)
      const finalizationResult = await conversationService.finalizeConversation(conversationId, true);

      expect(finalizationResult).toBeDefined();
      expect(finalizationResult.summary).toBeDefined();
      expect(finalizationResult.sentimentAnalysis).toBeDefined();
      expect(finalizationResult.sentimentAnalysis.overallSentiment).toBeDefined();

      // Verify conversation was updated
      const updatedConversation = await Conversation.findById(conversationId);
      expect(updatedConversation.status).toBe('completed');
      expect(updatedConversation.endTime).toBeDefined();
      expect(updatedConversation.analyzedData.sentiment).toBeDefined();

      // Clean up
      await Conversation.findByIdAndDelete(conversationId);
      await Message.deleteMany({ conversationId: conversationId });
    }, 30000);
  });
});


