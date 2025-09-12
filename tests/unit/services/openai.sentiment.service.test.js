const { getOpenAISentimentServiceInstance } = require('../../../src/services/openai.sentiment.service');

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
jest.mock('../../../src/config/config', () => ({
  openai: {
    apiKey: 'test-api-key'
  }
}));

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('OpenAI Sentiment Service', () => {
  let sentimentService;
  let mockOpenAI;

  beforeEach(() => {
    jest.clearAllMocks();
    sentimentService = getOpenAISentimentServiceInstance();
    
    // Get the mocked OpenAI instance
    const OpenAI = require('openai').OpenAI;
    mockOpenAI = new OpenAI();
  });

  describe('analyzeSentiment', () => {
    it('should analyze sentiment successfully with detailed response', async () => {
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

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const conversationText = 'Patient: Hi Bianca, I am feeling really good today! Bianca: That is wonderful to hear!';
      
      const result = await sentimentService.analyzeSentiment(conversationText, { detailed: true });

      expect(result.success).toBe(true);
      expect(result.data.overallSentiment).toBe('positive');
      expect(result.data.sentimentScore).toBe(0.7);
      expect(result.data.confidence).toBe(0.9);
      expect(result.data.patientMood).toBe('cheerful and optimistic');
      expect(result.data.keyEmotions).toEqual(['happiness', 'satisfaction']);
      expect(result.data.concernLevel).toBe('low');
      expect(result.data.summary).toBe('Patient shows positive sentiment with high confidence');
      expect(result.data.recommendations).toBe('Continue current care approach');
    });

    it('should analyze sentiment with basic response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              overallSentiment: 'negative',
              sentimentScore: -0.5,
              confidence: 0.8
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const conversationText = 'Patient: I am feeling really frustrated today.';
      
      const result = await sentimentService.analyzeSentiment(conversationText, { detailed: false });

      expect(result.success).toBe(true);
      expect(result.data.overallSentiment).toBe('negative');
      expect(result.data.sentimentScore).toBe(-0.5);
      expect(result.data.confidence).toBe(0.8);
      expect(result.data.patientMood).toBeUndefined();
      expect(result.data.keyEmotions).toBeUndefined();
    });

    it('should handle invalid JSON response with fallback parsing', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: 'The patient seems positive overall with a score of 0.6 and high confidence.'
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const conversationText = 'Patient: I am feeling good today!';
      
      const result = await sentimentService.analyzeSentiment(conversationText, { detailed: true });

      expect(result.success).toBe(true);
      expect(result.data.fallback).toBe(true);
      expect(result.data.overallSentiment).toBe('positive');
      expect(result.data.sentimentScore).toBe(0.6);
      expect(result.data.confidence).toBe(0.8);
    });

    it('should handle OpenAI API errors', async () => {
      const error = new Error('OpenAI API error');
      mockOpenAI.chat.completions.create.mockRejectedValue(error);

      const conversationText = 'Patient: I am feeling good today!';
      
      const result = await sentimentService.analyzeSentiment(conversationText, { detailed: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain('OpenAI API error');
    });

    it('should handle empty conversation text', async () => {
      const result = await sentimentService.analyzeSentiment('', { detailed: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Conversation text is required');
    });

    it('should handle malformed JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: '{"invalid": json}'
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const conversationText = 'Patient: I am feeling good today!';
      
      const result = await sentimentService.analyzeSentiment(conversationText, { detailed: true });

      expect(result.success).toBe(true);
      expect(result.data.fallback).toBe(true);
      expect(result.data.overallSentiment).toBeDefined();
    });

    it('should handle missing choices in response', async () => {
      const mockResponse = {
        choices: []
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const conversationText = 'Patient: I am feeling good today!';
      
      const result = await sentimentService.analyzeSentiment(conversationText, { detailed: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No response from OpenAI');
    });

    it('should handle missing message content', async () => {
      const mockResponse = {
        choices: [{
          message: {}
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const conversationText = 'Patient: I am feeling good today!';
      
      const result = await sentimentService.analyzeSentiment(conversationText, { detailed: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No response content from OpenAI');
    });
  });

  describe('analyzeConversationSentiment', () => {
    it('should analyze conversation sentiment successfully', async () => {
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              overallSentiment: 'neutral',
              sentimentScore: 0.1,
              confidence: 0.7,
              patientMood: 'calm and collected',
              keyEmotions: ['neutrality', 'acceptance'],
              concernLevel: 'low',
              summary: 'Patient shows neutral sentiment',
              recommendations: 'Monitor for changes'
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValue(mockResponse);

      const conversationId = 'test-conversation-id';
      const options = { detailed: true };
      
      const result = await sentimentService.analyzeConversationSentiment(conversationId, options);

      expect(result.success).toBe(true);
      expect(result.data.overallSentiment).toBe('neutral');
      expect(result.data.sentimentScore).toBe(0.1);
      expect(result.data.confidence).toBe(0.7);
    });

    it('should handle conversation not found', async () => {
      const conversationId = 'non-existent-conversation';
      const options = { detailed: true };
      
      const result = await sentimentService.analyzeConversationSentiment(conversationId, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Conversation not found');
    });
  });

  describe('getServiceStatus', () => {
    it('should return service status', () => {
      const status = sentimentService.getServiceStatus();
      
      expect(status).toHaveProperty('isHealthy');
      expect(status).toHaveProperty('lastChecked');
      expect(status).toHaveProperty('version');
      expect(typeof status.isHealthy).toBe('boolean');
    });
  });

  describe('validateSentimentData', () => {
    it('should validate correct sentiment data', () => {
      const validData = {
        overallSentiment: 'positive',
        sentimentScore: 0.7,
        confidence: 0.9
      };

      const result = sentimentService.validateSentimentData(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid sentiment data', () => {
      const invalidData = {
        overallSentiment: 'invalid',
        sentimentScore: 2.0, // Invalid score
        confidence: -0.1 // Invalid confidence
      };

      const result = sentimentService.validateSentimentData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject missing required fields', () => {
      const incompleteData = {
        overallSentiment: 'positive'
        // Missing sentimentScore and confidence
      };

      const result = sentimentService.validateSentimentData(incompleteData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('sentimentScore is required');
      expect(result.errors).toContain('confidence is required');
    });
  });
});


