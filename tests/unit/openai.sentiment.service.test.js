// src/services/openai.sentiment.service.test.js
const { OpenAISentimentService, getOpenAISentimentServiceInstance } = require('./openai.sentiment.service');

describe('OpenAI Sentiment Service', () => {
  let sentimentService;

  beforeEach(() => {
    sentimentService = new OpenAISentimentService();
  });

  describe('analyzeSentiment', () => {
    it('should analyze positive sentiment correctly', async () => {
      const positiveConversation = `
        Patient: Hi Bianca, I'm feeling really good today!
        Bianca: That's wonderful to hear! What's making you feel so good?
        Patient: I had a great walk this morning and my medication seems to be working well.
        Bianca: I'm so happy to hear that! Regular exercise and proper medication can make such a difference.
        Patient: Yes, I feel like I have more energy and I'm sleeping better too.
      `;

      const result = await sentimentService.analyzeSentiment(positiveConversation, { detailed: true });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.overallSentiment).toBeDefined();
      expect(result.data.sentimentScore).toBeDefined();
      expect(result.data.confidence).toBeDefined();
      expect(result.data.summary).toBeDefined();
    }, 30000); // 30 second timeout for API call

    it('should analyze negative sentiment correctly', async () => {
      const negativeConversation = `
        Patient: Hi Bianca, I'm feeling really frustrated today.
        Bianca: I'm sorry to hear that. What's been bothering you?
        Patient: My pain medication isn't working and I can't sleep at night.
        Bianca: That sounds very difficult. Have you spoken with your doctor about adjusting your medication?
        Patient: I have an appointment next week, but I'm worried it won't help.
      `;

      const result = await sentimentService.analyzeSentiment(negativeConversation, { detailed: true });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.overallSentiment).toBeDefined();
      expect(result.data.sentimentScore).toBeDefined();
      expect(result.data.confidence).toBeDefined();
    }, 30000);

    it('should handle empty conversation text', async () => {
      const result = await sentimentService.analyzeSentiment('');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Conversation text is required');
    });

    it('should handle basic sentiment analysis without detailed mode', async () => {
      const conversation = `
        Patient: I'm doing okay today.
        Bianca: That's good to hear. How are you feeling overall?
        Patient: Pretty neutral, nothing too exciting happening.
      `;

      const result = await sentimentService.analyzeSentiment(conversation, { detailed: false });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.overallSentiment).toBeDefined();
      expect(result.data.sentimentScore).toBeDefined();
      expect(result.data.confidence).toBeDefined();
      expect(result.data.summary).toBeDefined();
      // Should not have detailed fields
      expect(result.data.keyEmotions).toBeUndefined();
      expect(result.data.concernLevel).toBeUndefined();
    }, 30000);
  });

  describe('parseSentimentResponse', () => {
    it('should parse valid JSON response correctly', () => {
      const validResponse = `
        Here is the sentiment analysis:
        {
          "overallSentiment": "positive",
          "sentimentScore": 0.7,
          "confidence": 0.9,
          "summary": "The patient expressed positive feelings and satisfaction."
        }
      `;

      const result = sentimentService.parseSentimentResponse(validResponse, false);

      expect(result.overallSentiment).toBe('positive');
      expect(result.sentimentScore).toBe(0.7);
      expect(result.confidence).toBe(0.9);
      expect(result.summary).toBeDefined();
    });

    it('should handle invalid JSON with fallback extraction', () => {
      const invalidResponse = `
        The conversation shows a positive sentiment overall. The patient seems happy and satisfied with their care.
        They expressed gratitude and positive emotions throughout the conversation.
      `;

      const result = sentimentService.parseSentimentResponse(invalidResponse, false);

      expect(result.overallSentiment).toBeDefined();
      expect(result.sentimentScore).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.fallback).toBe(true);
    });

    it('should clamp sentiment score to valid range', () => {
      const responseWithInvalidScore = `
        {
          "overallSentiment": "positive",
          "sentimentScore": 1.5,
          "confidence": 1.2,
          "summary": "Test"
        }
      `;

      const result = sentimentService.parseSentimentResponse(responseWithInvalidScore, false);

      expect(result.sentimentScore).toBe(1); // Clamped to 1
      expect(result.confidence).toBe(1); // Clamped to 1
    });
  });

  describe('extractBasicSentiment', () => {
    it('should detect positive sentiment from keywords', () => {
      const positiveText = 'The patient is happy and satisfied with their care. They feel positive about the treatment.';
      
      const result = sentimentService.extractBasicSentiment(positiveText);

      expect(result.overallSentiment).toBe('positive');
      expect(result.sentimentScore).toBe(0.3);
      expect(result.fallback).toBe(true);
    });

    it('should detect negative sentiment from keywords', () => {
      const negativeText = 'The patient is frustrated and disappointed with the service. They feel angry about the delay.';
      
      const result = sentimentService.extractBasicSentiment(negativeText);

      expect(result.overallSentiment).toBe('negative');
      expect(result.sentimentScore).toBe(-0.3);
      expect(result.fallback).toBe(true);
    });

    it('should default to neutral when no clear sentiment', () => {
      const neutralText = 'The patient discussed their symptoms and medication schedule.';
      
      const result = sentimentService.extractBasicSentiment(neutralText);

      expect(result.overallSentiment).toBe('neutral');
      expect(result.sentimentScore).toBe(0);
      expect(result.fallback).toBe(true);
    });
  });

  describe('getOpenAISentimentServiceInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = getOpenAISentimentServiceInstance();
      const instance2 = getOpenAISentimentServiceInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(OpenAISentimentService);
    });
  });
});


