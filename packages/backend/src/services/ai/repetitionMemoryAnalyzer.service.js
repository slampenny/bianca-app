// src/services/ai/repetitionMemoryAnalyzer.service.js

const natural = require('natural');
const logger = require('../../config/logger');

/**
 * Repetition & Memory Analyzer Service
 * Detects repeated phrases, stories, and questions using n-gram analysis
 */
class RepetitionMemoryAnalyzer {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    
    // Configuration for n-gram analysis
    this.config = {
      minNgramSize: 4,      // Minimum n-gram size
      maxNgramSize: 10,     // Maximum n-gram size
      minRepetitions: 2,    // Minimum repetitions to be significant
      minPhraseLength: 20,  // Minimum character length for phrases
      significanceThreshold: 0.1, // Threshold for concerning repetitions
      temporalWindow: 30    // Days to consider for temporal analysis
    };

    // Stop words to exclude from n-grams
    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
    ]);
  }

  /**
   * Find repetitions across conversations
   * @param {Array} conversations - Array of conversation objects
   * @returns {Object} Repetition analysis results
   */
  findRepetitions(conversations) {
    try {
      if (!conversations || conversations.length === 0) {
        return this.getDefaultMetrics();
      }

      // Extract patient messages with timestamps
      const patientMessages = this.extractPatientMessagesWithTimestamps(conversations);
      
      if (patientMessages.length === 0) {
        return this.getDefaultMetrics();
      }

      // Generate n-grams from all messages
      const allNgrams = this.generateAllNgrams(patientMessages);
      
      // Find significant repetitions
      const repeatedPhrases = this.findSignificantRepetitions(allNgrams);
      
      // Analyze within-conversation repetitions
      const withinConversationRepetitions = this.analyzeWithinConversationRepetitions(conversations);
      
      // Analyze across-conversation repetitions
      const acrossConversationRepetitions = this.analyzeAcrossConversationRepetitions(patientMessages);
      
      // Calculate repetition index
      const repetitionIndex = this.calculateRepetitionIndex(repeatedPhrases, patientMessages.length);
      
      // Detect concerning repetition patterns
      const concerningRepetitions = this.detectConcerningRepetitions(repeatedPhrases);
      
      // Analyze temporal patterns
      const temporalPatterns = this.analyzeTemporalPatterns(repeatedPhrases, patientMessages);

      return {
        repeatedPhrases: repeatedPhrases.slice(0, 20), // Top 20 repetitions
        repetitionIndex: Math.round(repetitionIndex * 100) / 100,
        concerningRepetitions: concerningRepetitions,
        withinConversationRepetitions,
        acrossConversationRepetitions,
        temporalPatterns,
        confidence: this.calculateConfidence(patientMessages.length, conversations.length),
        analysisDate: new Date(),
        conversationCount: conversations.length,
        messageCount: patientMessages.length,
        totalNgrams: allNgrams.length,
        significantRepetitions: repeatedPhrases.length
      };

    } catch (error) {
      logger.error('Error in RepetitionMemoryAnalyzer.findRepetitions:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Extract patient messages with timestamps
   * @param {Array} conversations - Array of conversation objects
   * @returns {Array} Array of message objects with timestamps
   */
  extractPatientMessagesWithTimestamps(conversations) {
    const messages = [];
    
    conversations.forEach(conversation => {
      if (conversation.messages && Array.isArray(conversation.messages)) {
        conversation.messages.forEach(message => {
          if (message.role === 'patient' && message.content && message.content.trim()) {
            messages.push({
              content: message.content.trim(),
              timestamp: message.createdAt || conversation.createdAt,
              conversationId: conversation._id,
              messageId: message._id
            });
          }
        });
      }
    });

    // Sort by timestamp
    return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Generate all n-grams from patient messages
   * @param {Array} messages - Array of message objects
   * @returns {Array} Array of n-gram objects
   */
  generateAllNgrams(messages) {
    const allNgrams = [];

    messages.forEach(message => {
      const words = this.tokenizer.tokenize(message.content.toLowerCase());
      
      // Filter out stop words and short words
      const filteredWords = words.filter(word => 
        word.length > 2 && !this.stopWords.has(word) && /^[a-zA-Z]+$/.test(word)
      );

      // Generate n-grams of different sizes
      for (let n = this.config.minNgramSize; n <= this.config.maxNgramSize && n <= filteredWords.length; n++) {
        for (let i = 0; i <= filteredWords.length - n; i++) {
          const ngram = filteredWords.slice(i, i + n).join(' ');
          
          // Only include meaningful n-grams
          if (ngram.length >= this.config.minPhraseLength) {
            allNgrams.push({
              phrase: ngram,
              words: filteredWords.slice(i, i + n),
              size: n,
              timestamp: message.timestamp,
              conversationId: message.conversationId,
              messageId: message.messageId,
              messageContent: message.content
            });
          }
        }
      }
    });

    return allNgrams;
  }

  /**
   * Find significant repetitions in n-grams
   * @param {Array} ngrams - Array of n-gram objects
   * @returns {Array} Array of repeated phrase objects
   */
  findSignificantRepetitions(ngrams) {
    const phraseCounts = {};
    const phraseOccurrences = {};

    // Count occurrences of each phrase
    ngrams.forEach(ngram => {
      const phrase = ngram.phrase;
      phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
      
      if (!phraseOccurrences[phrase]) {
        phraseOccurrences[phrase] = [];
      }
      phraseOccurrences[phrase].push({
        timestamp: ngram.timestamp,
        conversationId: ngram.conversationId,
        messageId: ngram.messageId,
        messageContent: ngram.messageContent
      });
    });

    // Find phrases that meet minimum repetition threshold
    const repeatedPhrases = [];
    
    Object.entries(phraseCounts).forEach(([phrase, count]) => {
      if (count >= this.config.minRepetitions) {
        const occurrences = phraseOccurrences[phrase];
        
        // Calculate additional metrics
        const firstOccurrence = new Date(Math.min(...occurrences.map(o => new Date(o.timestamp))));
        const lastOccurrence = new Date(Math.max(...occurrences.map(o => new Date(o.timestamp))));
        const timeSpan = lastOccurrence - firstOccurrence;
        const daysSpan = timeSpan / (1000 * 60 * 60 * 24);
        
        // Calculate frequency (occurrences per day)
        const frequency = daysSpan > 0 ? count / daysSpan : count;
        
        // Calculate severity
        const severity = this.calculateRepetitionSeverity(count, frequency, daysSpan);
        
        repeatedPhrases.push({
          phrase,
          count,
          frequency: Math.round(frequency * 100) / 100,
          severity,
          firstOccurrence,
          lastOccurrence,
          daysSpan: Math.round(daysSpan * 100) / 100,
          occurrences: occurrences.slice(0, 10), // Limit to first 10 occurrences
          uniqueConversations: new Set(occurrences.map(o => o.conversationId)).size,
          wordCount: phrase.split(' ').length
        });
      }
    });

    // Sort by count and frequency
    return repeatedPhrases.sort((a, b) => {
      // Primary sort by count, secondary by frequency
      if (b.count !== a.count) return b.count - a.count;
      return b.frequency - a.frequency;
    });
  }

  /**
   * Analyze within-conversation repetitions
   * @param {Array} conversations - Array of conversation objects
   * @returns {Object} Within-conversation repetition analysis
   */
  analyzeWithinConversationRepetitions(conversations) {
    const conversationStats = [];
    let totalWithinRepetitions = 0;

    conversations.forEach(conversation => {
      if (conversation.messages && conversation.messages.length > 1) {
        const patientMessages = conversation.messages
          .filter(msg => msg.role === 'patient' && msg.content)
          .map(msg => msg.content.trim());

        if (patientMessages.length > 1) {
          const withinRepetitions = this.findWithinConversationRepetitions(patientMessages);
          totalWithinRepetitions += withinRepetitions.length;
          
          conversationStats.push({
            conversationId: conversation._id,
            messageCount: patientMessages.length,
            repetitions: withinRepetitions.length,
            repetitionRate: withinRepetitions.length / patientMessages.length
          });
        }
      }
    });

    const avgRepetitionRate = conversationStats.length > 0 
      ? conversationStats.reduce((sum, stat) => sum + stat.repetitionRate, 0) / conversationStats.length 
      : 0;

    return {
      totalWithinRepetitions,
      conversationStats: conversationStats.slice(0, 10), // Top 10 conversations
      averageRepetitionRate: Math.round(avgRepetitionRate * 10000) / 10000,
      conversationsWithRepetitions: conversationStats.filter(stat => stat.repetitions > 0).length
    };
  }

  /**
   * Find repetitions within a single conversation
   * @param {Array} messages - Array of message strings
   * @returns {Array} Array of repeated phrases
   */
  findWithinConversationRepetitions(messages) {
    const allNgrams = [];
    
    messages.forEach((message, messageIndex) => {
      const words = this.tokenizer.tokenize(message.toLowerCase());
      const filteredWords = words.filter(word => 
        word.length > 2 && !this.stopWords.has(word) && /^[a-zA-Z]+$/.test(word)
      );

      for (let n = 4; n <= 8 && n <= filteredWords.length; n++) {
        for (let i = 0; i <= filteredWords.length - n; i++) {
          const ngram = filteredWords.slice(i, i + n).join(' ');
          if (ngram.length >= 20) {
            allNgrams.push({
              phrase: ngram,
              messageIndex,
              message
            });
          }
        }
      }
    });

    // Count repetitions
    const phraseCounts = {};
    allNgrams.forEach(ngram => {
      phraseCounts[ngram.phrase] = (phraseCounts[ngram.phrase] || 0) + 1;
    });

    // Return phrases that appear more than once
    return Object.entries(phraseCounts)
      .filter(([, count]) => count > 1)
      .map(([phrase, count]) => ({ phrase, count }));
  }

  /**
   * Analyze across-conversation repetitions
   * @param {Array} messages - Array of message objects with timestamps
   * @returns {Object} Across-conversation repetition analysis
   */
  analyzeAcrossConversationRepetitions(messages) {
    // Group messages by conversation
    const conversationGroups = {};
    messages.forEach(message => {
      if (!conversationGroups[message.conversationId]) {
        conversationGroups[message.conversationId] = [];
      }
      conversationGroups[message.conversationId].push(message);
    });

    const conversationIds = Object.keys(conversationGroups);
    const crossConversationPhrases = [];

    // Compare phrases across different conversations
    for (let i = 0; i < conversationIds.length; i++) {
      for (let j = i + 1; j < conversationIds.length; j++) {
        const conv1 = conversationGroups[conversationIds[i]];
        const conv2 = conversationGroups[conversationIds[j]];
        
        const sharedPhrases = this.findSharedPhrases(conv1, conv2);
        crossConversationPhrases.push(...sharedPhrases);
      }
    }

    // Aggregate shared phrases
    const phraseMap = {};
    crossConversationPhrases.forEach(phrase => {
      if (!phraseMap[phrase.phrase]) {
        phraseMap[phrase.phrase] = {
          phrase: phrase.phrase,
          conversations: new Set(),
          count: 0
        };
      }
      phraseMap[phrase.phrase].conversations.add(phrase.conversationId);
      phraseMap[phrase.phrase].count++;
    });

    const sharedPhrases = Object.values(phraseMap)
      .map(item => ({
        phrase: item.phrase,
        conversationCount: item.conversations.size,
        totalOccurrences: item.count
      }))
      .sort((a, b) => b.conversationCount - a.conversationCount);

    return {
      sharedPhrases: sharedPhrases.slice(0, 15), // Top 15 shared phrases
      totalSharedPhrases: sharedPhrases.length,
      conversationsAnalyzed: conversationIds.length,
      averagePhrasesPerConversation: conversationIds.length > 0 
        ? sharedPhrases.length / conversationIds.length 
        : 0
    };
  }

  /**
   * Find phrases shared between two conversations
   * @param {Array} conv1 - First conversation messages
   * @param {Array} conv2 - Second conversation messages
   * @returns {Array} Array of shared phrases
   */
  findSharedPhrases(conv1, conv2) {
    const phrases1 = this.extractPhrases(conv1);
    const phrases2 = this.extractPhrases(conv2);
    const sharedPhrases = [];

    const phrases1Set = new Set(phrases1.map(p => p.phrase));
    
    phrases2.forEach(phrase => {
      if (phrases1Set.has(phrase.phrase)) {
        sharedPhrases.push({
          phrase: phrase.phrase,
          conversationId: phrase.conversationId
        });
      }
    });

    return sharedPhrases;
  }

  /**
   * Extract phrases from conversation messages
   * @param {Array} messages - Array of message objects
   * @returns {Array} Array of phrase objects
   */
  extractPhrases(messages) {
    const phrases = [];
    
    messages.forEach(message => {
      const words = this.tokenizer.tokenize(message.content.toLowerCase());
      const filteredWords = words.filter(word => 
        word.length > 2 && !this.stopWords.has(word) && /^[a-zA-Z]+$/.test(word)
      );

      for (let n = 4; n <= 8 && n <= filteredWords.length; n++) {
        for (let i = 0; i <= filteredWords.length - n; i++) {
          const phrase = filteredWords.slice(i, i + n).join(' ');
          if (phrase.length >= 20) {
            phrases.push({
              phrase,
              conversationId: message.conversationId
            });
          }
        }
      }
    });

    return phrases;
  }

  /**
   * Calculate repetition index
   * @param {Array} repeatedPhrases - Array of repeated phrases
   * @param {number} totalMessages - Total number of messages
   * @returns {number} Repetition index (0-100)
   */
  calculateRepetitionIndex(repeatedPhrases, totalMessages) {
    if (totalMessages === 0) return 0;

    // Calculate weighted repetition score
    let totalScore = 0;
    let totalWeight = 0;

    repeatedPhrases.forEach(phrase => {
      const weight = phrase.wordCount; // Longer phrases get higher weight
      const score = phrase.count * phrase.frequency * weight;
      totalScore += score;
      totalWeight += weight;
    });

    const baseIndex = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
    
    // Normalize based on total messages
    const normalizedIndex = Math.min(baseIndex / Math.max(totalMessages / 10, 1), 100);
    
    return Math.round(normalizedIndex * 100) / 100;
  }

  /**
   * Detect concerning repetition patterns
   * @param {Array} repeatedPhrases - Array of repeated phrases
   * @returns {Object} Concerning repetition analysis
   */
  detectConcerningRepetitions(repeatedPhrases) {
    const concerning = repeatedPhrases.filter(phrase => 
      phrase.severity === 'high' || 
      phrase.frequency > 1.0 || // More than once per day
      phrase.count > 5 // More than 5 total repetitions
    );

    const veryConcerning = concerning.filter(phrase => 
      phrase.severity === 'high' && 
      phrase.frequency > 0.5 &&
      phrase.uniqueConversations > 2
    );

    return {
      hasConcerningRepetitions: concerning.length > 0,
      concerningCount: concerning.length,
      veryConcerningCount: veryConcerning.length,
      concerningPhrases: concerning.slice(0, 10),
      veryConcerningPhrases: veryConcerning.slice(0, 5),
      severity: veryConcerning.length > 0 ? 'high' : concerning.length > 0 ? 'medium' : 'low'
    };
  }

  /**
   * Analyze temporal patterns in repetitions
   * @param {Array} repeatedPhrases - Array of repeated phrases
   * @param {Array} messages - Array of message objects
   * @returns {Object} Temporal pattern analysis
   */
  analyzeTemporalPatterns(repeatedPhrases, messages) {
    if (messages.length === 0) {
      return {
        timeSpan: 0,
        repetitionFrequency: 0,
        patterns: []
      };
    }

    const firstMessage = new Date(Math.min(...messages.map(m => new Date(m.timestamp))));
    const lastMessage = new Date(Math.max(...messages.map(m => new Date(m.timestamp))));
    const totalTimeSpan = lastMessage - firstMessage;
    const totalDays = totalTimeSpan / (1000 * 60 * 60 * 24);

    const patterns = repeatedPhrases.slice(0, 10).map(phrase => ({
      phrase: phrase.phrase.substring(0, 50) + '...',
      count: phrase.count,
      frequency: phrase.frequency,
      timeSpan: phrase.daysSpan,
      pattern: phrase.frequency > 1 ? 'frequent' : phrase.count > 3 ? 'persistent' : 'occasional'
    }));

    const avgFrequency = repeatedPhrases.length > 0 
      ? repeatedPhrases.reduce((sum, p) => sum + p.frequency, 0) / repeatedPhrases.length 
      : 0;

    return {
      timeSpan: Math.round(totalDays * 100) / 100,
      repetitionFrequency: Math.round(avgFrequency * 100) / 100,
      patterns,
      trend: avgFrequency > 0.5 ? 'increasing' : avgFrequency > 0.1 ? 'stable' : 'decreasing'
    };
  }

  /**
   * Calculate repetition severity
   * @param {number} count - Number of repetitions
   * @param {number} frequency - Frequency per day
   * @param {number} daysSpan - Days over which repetitions occurred
   * @returns {string} Severity level
   */
  calculateRepetitionSeverity(count, frequency, daysSpan) {
    if (count >= 10 || frequency >= 2.0) return 'high';
    if (count >= 5 || frequency >= 1.0) return 'medium';
    if (count >= 2) return 'low';
    return 'minimal';
  }

  /**
   * Calculate confidence level of analysis
   * @param {number} messageCount - Number of messages
   * @param {number} conversationCount - Number of conversations
   * @returns {string} Confidence level
   */
  calculateConfidence(messageCount, conversationCount) {
    if (messageCount < 10 || conversationCount < 2) return 'low';
    if (messageCount < 50 || conversationCount < 5) return 'medium';
    return 'high';
  }

  /**
   * Get default metrics structure
   * @returns {Object} Default metrics
   */
  getDefaultMetrics() {
    return {
      repeatedPhrases: [],
      repetitionIndex: 0,
      concerningRepetitions: {
        hasConcerningRepetitions: false,
        concerningCount: 0,
        veryConcerningCount: 0,
        concerningPhrases: [],
        veryConcerningPhrases: [],
        severity: 'low'
      },
      withinConversationRepetitions: {
        totalWithinRepetitions: 0,
        conversationStats: [],
        averageRepetitionRate: 0,
        conversationsWithRepetitions: 0
      },
      acrossConversationRepetitions: {
        sharedPhrases: [],
        totalSharedPhrases: 0,
        conversationsAnalyzed: 0,
        averagePhrasesPerConversation: 0
      },
      temporalPatterns: {
        timeSpan: 0,
        repetitionFrequency: 0,
        patterns: [],
        trend: 'stable'
      },
      confidence: 'none',
      analysisDate: new Date(),
      conversationCount: 0,
      messageCount: 0,
      totalNgrams: 0,
      significantRepetitions: 0
    };
  }
}

// Create singleton instance
const repetitionMemoryAnalyzer = new RepetitionMemoryAnalyzer();

// Export both the class and the singleton function
module.exports = {
  RepetitionMemoryAnalyzer,
  findRepetitions: (conversations) => repetitionMemoryAnalyzer.findRepetitions(conversations)
};
