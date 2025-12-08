// src/services/openai.sentiment.service.js
const OpenAI = require('openai');
const config = require('../config/config');
const logger = require('../config/logger');

/**
 * OpenAI Sentiment Analysis Service
 * Performs sentiment analysis on conversations using ChatGPT
 */
class OpenAISentimentService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    
    logger.info('[OpenAI Sentiment] Service initialized');
  }

  /**
   * Analyze sentiment of a conversation
   * @param {string} conversationText - The full conversation text
   * @param {Object} options - Analysis options
   * @param {string} [options.model] - OpenAI model to use (default: gpt-4o)
   * @param {boolean} [options.detailed] - Whether to return detailed analysis (default: true)
   * @returns {Promise<Object>} Sentiment analysis results
   */
  async analyzeSentiment(conversationText, options = {}) {
    try {
      if (!conversationText || !conversationText.trim()) {
        throw new Error('Conversation text is required for sentiment analysis');
      }

      const model = options.model || config.openai.model || 'gpt-4o';
      const detailed = options.detailed !== false; // Default to true

      logger.info(`[OpenAI Sentiment] Starting sentiment analysis using model: ${model}`);

      const prompt = this.buildSentimentPrompt(conversationText, detailed);

      const response = await this.openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert sentiment analysis AI specialized in healthcare conversations. Analyze the emotional tone, mood, and sentiment of patient conversations with care and accuracy.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1, // Low temperature for consistent analysis
        max_tokens: detailed ? 1000 : 200,
      });

      const analysisText = response.choices[0]?.message?.content;
      if (!analysisText) {
        throw new Error('No analysis returned from OpenAI');
      }

      const sentimentData = this.parseSentimentResponse(analysisText, detailed);
      
      logger.info(`[OpenAI Sentiment] Analysis completed - Overall sentiment: ${sentimentData.overallSentiment}`);
      
      return {
        success: true,
        data: sentimentData,
        model: model,
        analyzedAt: new Date(),
        conversationLength: conversationText.length
      };

    } catch (error) {
      logger.error(`[OpenAI Sentiment] Error analyzing sentiment: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        analyzedAt: new Date()
      };
    }
  }

  /**
   * Build the sentiment analysis prompt
   * @param {string} conversationText - The conversation text
   * @param {boolean} detailed - Whether to request detailed analysis
   * @returns {string} The formatted prompt
   */
  buildSentimentPrompt(conversationText, detailed) {
    const basePrompt = `Please analyze the sentiment and emotional tone of this healthcare conversation between a patient and an AI assistant named Bianca.

CONVERSATION:
${conversationText}

Please provide your analysis in the following JSON format:`;

    if (detailed) {
      return `${basePrompt}
{
  "overallSentiment": "positive|negative|neutral|mixed",
  "sentimentScore": -1.0 to 1.0,
  "confidence": 0.0 to 1.0,
  "patientMood": "description of patient's emotional state",
  "keyEmotions": ["emotion1", "emotion2", "emotion3"],
  "concernLevel": "low|medium|high",
  "satisfactionIndicators": {
    "positive": ["indicator1", "indicator2"],
    "negative": ["indicator1", "indicator2"]
  },
  "summary": "Brief summary of the emotional analysis",
  "recommendations": "Any recommendations for follow-up care based on emotional state"
}`;
    } else {
      return `${basePrompt}
{
  "overallSentiment": "positive|negative|neutral|mixed",
  "sentimentScore": -1.0 to 1.0,
  "confidence": 0.0 to 1.0,
  "summary": "Brief summary of the emotional analysis"
}`;
    }
  }

  /**
   * Parse the sentiment analysis response from OpenAI
   * @param {string} responseText - The raw response text
   * @param {boolean} detailed - Whether detailed analysis was requested
   * @returns {Object} Parsed sentiment data
   */
  parseSentimentResponse(responseText, detailed) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.overallSentiment || !parsed.sentimentScore === undefined || !parsed.confidence === undefined) {
        throw new Error('Missing required sentiment fields');
      }

      // Ensure sentiment score is within valid range
      parsed.sentimentScore = Math.max(-1, Math.min(1, parseFloat(parsed.sentimentScore) || 0));
      parsed.confidence = Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0));

      return parsed;

    } catch (error) {
      logger.warn(`[OpenAI Sentiment] Failed to parse response as JSON: ${error.message}`);
      
      // Fallback: try to extract basic sentiment from text
      return this.extractBasicSentiment(responseText);
    }
  }

  /**
   * Extract basic sentiment information from unstructured text
   * @param {string} text - The response text
   * @returns {Object} Basic sentiment data
   */
  extractBasicSentiment(text) {
    const lowerText = text.toLowerCase();
    
    let overallSentiment = 'neutral';
    let sentimentScore = 0;
    let confidence = 0.5;

    // Simple keyword-based sentiment detection
    const positiveWords = ['positive', 'happy', 'satisfied', 'good', 'pleased', 'content'];
    const negativeWords = ['negative', 'sad', 'frustrated', 'angry', 'disappointed', 'concerned'];
    
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount) {
      overallSentiment = 'positive';
      sentimentScore = 0.3;
    } else if (negativeCount > positiveCount) {
      overallSentiment = 'negative';
      sentimentScore = -0.3;
    }

    return {
      overallSentiment,
      sentimentScore,
      confidence,
      summary: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
      fallback: true // Indicate this was a fallback analysis
    };
  }

  /**
   * Analyze sentiment for a specific conversation ID
   * @param {string} conversationId - The conversation ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Sentiment analysis results
   */
  async analyzeConversationSentiment(conversationId, options = {}) {
    try {
      const { Conversation, Message } = require('../models');
      
      // Get the conversation and its messages
      const conversation = await Conversation.findById(conversationId)
        .populate('patientId', 'name age')
        .lean();

      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      // Get messages from the conversation
      const messages = await Message.find({ conversationId })
        .sort({ createdAt: 1 })
        .select('role content')
        .lean();

      if (!messages || messages.length === 0) {
        throw new Error(`No messages found for conversation ${conversationId}`);
      }

      // Format conversation text
      const conversationText = messages
        .map(msg => {
          const speaker = msg.role === 'assistant' ? 'Bianca' : 'Patient';
          return `${speaker}: ${msg.content}`;
        })
        .join('\n');

      // Perform sentiment analysis
      const analysisResult = await this.analyzeSentiment(conversationText, options);

      if (analysisResult.success) {
        // Update conversation with sentiment analysis
        await Conversation.findByIdAndUpdate(conversationId, {
          $set: {
            'analyzedData.sentiment': analysisResult.data,
            'analyzedData.sentimentAnalyzedAt': new Date()
          }
        });

        logger.info(`[OpenAI Sentiment] Updated conversation ${conversationId} with sentiment analysis`);
      }

      return analysisResult;

    } catch (error) {
      logger.error(`[OpenAI Sentiment] Error analyzing conversation ${conversationId}: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        conversationId,
        analyzedAt: new Date()
      };
    }
  }

  /**
   * Batch analyze sentiment for multiple conversations
   * @param {Array<string>} conversationIds - Array of conversation IDs
   * @param {Object} options - Analysis options
   * @returns {Promise<Array>} Array of analysis results
   */
  async batchAnalyzeSentiment(conversationIds, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 5; // Process 5 at a time to avoid rate limits

    logger.info(`[OpenAI Sentiment] Starting batch analysis for ${conversationIds.length} conversations`);

    for (let i = 0; i < conversationIds.length; i += batchSize) {
      const batch = conversationIds.slice(i, i + batchSize);
      
      const batchPromises = batch.map(conversationId => 
        this.analyzeConversationSentiment(conversationId, options)
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < conversationIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        logger.error(`[OpenAI Sentiment] Error in batch ${i}-${i + batchSize}: ${error.message}`);
        // Add error results for this batch
        batch.forEach(conversationId => {
          results.push({
            success: false,
            error: error.message,
            conversationId,
            analyzedAt: new Date()
          });
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info(`[OpenAI Sentiment] Batch analysis completed: ${successCount}/${conversationIds.length} successful`);

    return results;
  }
}

// Create singleton instance
let openAISentimentServiceInstance = null;

function getOpenAISentimentServiceInstance() {
  if (!openAISentimentServiceInstance) {
    openAISentimentServiceInstance = new OpenAISentimentService();
  }
  return openAISentimentServiceInstance;
}

function resetInstance() {
  openAISentimentServiceInstance = null;
}

module.exports = {
  OpenAISentimentService,
  getOpenAISentimentServiceInstance,
  resetInstance
};


