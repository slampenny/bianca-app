// src/services/ai/relationshipPatternAnalyzer.service.js

const natural = require('natural');
const logger = require('../../config/logger');

/**
 * Relationship Pattern Analyzer Service
 * Tracks changes in relationships and social connections that might indicate exploitation
 */
class RelationshipPatternAnalyzer {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    
    // Relationship indicators
    this.relationshipKeywords = {
      newPeople: [
        'new friend', 'met someone', 'someone i met', 'person i know',
        'new person', 'stranger', 'someone new', 'just met',
        'recently met', 'new acquaintance', 'someone contacted me'
      ],
      isolation: [
        'don\'t see', 'haven\'t seen', 'stopped visiting', 'no longer',
        'cut off', 'not allowed', 'forbidden', 'told not to',
        'isolated', 'alone', 'no one visits', 'no one calls'
      ],
      control: [
        'tells me', 'makes me', 'won\'t let me', 'doesn\'t want me to',
        'controls', 'decides for me', 'has to approve', 'needs permission'
      ],
      dependency: [
        'only person', 'only one', 'only friend', 'only help',
        'depends on', 'rely on', 'need them', 'can\'t without'
      ],
      suspiciousBehavior: [
        'asks for money', 'wants money', 'needs money', 'borrow',
        'loan', 'help financially', 'send money', 'give money',
        'takes care of', 'manages', 'handles', 'in charge of'
      ]
    };
  }

  /**
   * Analyze relationship patterns across conversations
   * @param {Array} conversations - Array of conversation objects with messages
   * @returns {Object} Relationship pattern analysis results
   */
  async analyzeRelationshipPatterns(conversations) {
    try {
      if (!conversations || conversations.length === 0) {
        return this.getDefaultMetrics();
      }

      // Extract patient messages with timestamps
      const patientMessages = await this.extractPatientMessagesWithTimestamps(conversations);
      
      if (patientMessages.length === 0) {
        return this.getDefaultMetrics();
      }

      // Analyze new people mentions
      const newPeopleAnalysis = this.analyzeNewPeople(patientMessages);
      
      // Analyze isolation patterns
      const isolationAnalysis = this.analyzeIsolation(patientMessages);
      
      // Analyze control patterns
      const controlAnalysis = this.analyzeControl(patientMessages);
      
      // Analyze dependency patterns
      const dependencyAnalysis = this.analyzeDependency(patientMessages);
      
      // Analyze suspicious behavior
      const suspiciousAnalysis = this.analyzeSuspiciousBehavior(patientMessages);
      
      // Temporal analysis (changes over time)
      const temporalAnalysis = this.analyzeTemporalChanges(patientMessages);
      
      // Calculate risk score
      const riskScore = this.calculateRiskScore({
        newPeople: newPeopleAnalysis,
        isolation: isolationAnalysis,
        control: controlAnalysis,
        dependency: dependencyAnalysis,
        suspicious: suspiciousAnalysis,
        temporal: temporalAnalysis
      });

      // Generate indicators
      const indicators = this.generateIndicators({
        newPeople: newPeopleAnalysis,
        isolation: isolationAnalysis,
        control: controlAnalysis,
        dependency: dependencyAnalysis,
        suspicious: suspiciousAnalysis,
        temporal: temporalAnalysis
      });

      return {
        riskScore: Math.round(riskScore * 100) / 100,
        confidence: this.calculateConfidence(patientMessages.length),
        indicators,
        newPeopleCount: newPeopleAnalysis.count,
        isolationCount: isolationAnalysis.count,
        controlCount: controlAnalysis.count,
        dependencyCount: dependencyAnalysis.count,
        suspiciousBehaviorCount: suspiciousAnalysis.count,
        temporalChanges: temporalAnalysis,
        flaggedPeople: this.extractFlaggedPeople(patientMessages),
        relationshipTimeline: this.buildRelationshipTimeline(patientMessages)
      };
    } catch (error) {
      logger.error('Error in RelationshipPatternAnalyzer:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Extract patient messages with timestamps
   */
  async extractPatientMessagesWithTimestamps(conversations) {
    const messages = [];
    const { Message } = require('../../models');
    
    for (const conversation of conversations) {
      let conversationMessages = [];
      
      if (conversation.messages && Array.isArray(conversation.messages)) {
        const firstMessage = conversation.messages[0];
        const isPopulated = firstMessage && firstMessage.role !== undefined;
        
        if (!isPopulated && conversation.messages.length > 0) {
          conversationMessages = await Message.find({ _id: { $in: conversation.messages } })
            .sort({ createdAt: 1 });
        } else {
          conversationMessages = conversation.messages;
        }
      }
      
      conversationMessages.forEach(message => {
        if (message.role === 'patient' && message.content && message.content.trim()) {
          messages.push({
            content: message.content.trim(),
            timestamp: message.createdAt || conversation.createdAt || new Date(),
            conversationId: conversation._id || conversation.id
          });
        }
      });
    }
    
    // Sort by timestamp
    return messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Analyze mentions of new people
   */
  analyzeNewPeople(messages) {
    const matches = [];
    const phrases = [];
    
    messages.forEach(msg => {
      const lowerText = msg.content.toLowerCase();
      this.relationshipKeywords.newPeople.forEach(phrase => {
        const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (lowerText.match(regex)) {
          matches.push({ message: msg, phrase });
          phrases.push(phrase);
        }
      });
    });

    return {
      count: matches.length,
      matches: matches.slice(0, 10), // Keep top 10
      phrases: [...new Set(phrases)]
    };
  }

  /**
   * Analyze isolation patterns
   */
  analyzeIsolation(messages) {
    const matches = [];
    const phrases = [];
    
    messages.forEach(msg => {
      const lowerText = msg.content.toLowerCase();
      this.relationshipKeywords.isolation.forEach(phrase => {
        const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (lowerText.match(regex)) {
          matches.push({ message: msg, phrase });
          phrases.push(phrase);
        }
      });
    });

    return {
      count: matches.length,
      matches: matches.slice(0, 10),
      phrases: [...new Set(phrases)]
    };
  }

  /**
   * Analyze control patterns
   */
  analyzeControl(messages) {
    const matches = [];
    const phrases = [];
    
    messages.forEach(msg => {
      const lowerText = msg.content.toLowerCase();
      this.relationshipKeywords.control.forEach(phrase => {
        const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (lowerText.match(regex)) {
          matches.push({ message: msg, phrase });
          phrases.push(phrase);
        }
      });
    });

    return {
      count: matches.length,
      matches: matches.slice(0, 10),
      phrases: [...new Set(phrases)]
    };
  }

  /**
   * Analyze dependency patterns
   */
  analyzeDependency(messages) {
    const matches = [];
    const phrases = [];
    
    messages.forEach(msg => {
      const lowerText = msg.content.toLowerCase();
      this.relationshipKeywords.dependency.forEach(phrase => {
        const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (lowerText.match(regex)) {
          matches.push({ message: msg, phrase });
          phrases.push(phrase);
        }
      });
    });

    return {
      count: matches.length,
      matches: matches.slice(0, 10),
      phrases: [...new Set(phrases)]
    };
  }

  /**
   * Analyze suspicious behavior
   */
  analyzeSuspiciousBehavior(messages) {
    const matches = [];
    const phrases = [];
    
    messages.forEach(msg => {
      const lowerText = msg.content.toLowerCase();
      this.relationshipKeywords.suspiciousBehavior.forEach(phrase => {
        const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        if (lowerText.match(regex)) {
          matches.push({ message: msg, phrase });
          phrases.push(phrase);
        }
      });
    });

    return {
      count: matches.length,
      matches: matches.slice(0, 10),
      phrases: [...new Set(phrases)]
    };
  }

  /**
   * Analyze temporal changes
   */
  analyzeTemporalChanges(messages) {
    if (messages.length < 3) {
      return { hasChanges: false, trend: 'insufficient_data' };
    }

    // Split into early, middle, late periods
    const third = Math.floor(messages.length / 3);
    const early = messages.slice(0, third);
    const middle = messages.slice(third, third * 2);
    const late = messages.slice(third * 2);

    const countMentions = (msgSet) => {
      let count = 0;
      msgSet.forEach(msg => {
        const lowerText = msg.content.toLowerCase();
        [...this.relationshipKeywords.newPeople,
         ...this.relationshipKeywords.isolation,
         ...this.relationshipKeywords.control].forEach(phrase => {
          const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          if (lowerText.match(regex)) count++;
        });
      });
      return count;
    };

    const earlyCount = countMentions(early);
    const middleCount = countMentions(middle);
    const lateCount = countMentions(late);

    const hasIsolationIncrease = lateCount > earlyCount * 1.5;
    const hasNewPeopleIncrease = this.analyzeNewPeople(late).count > this.analyzeNewPeople(early).count * 1.5;

    return {
      hasChanges: hasIsolationIncrease || hasNewPeopleIncrease,
      hasIsolationIncrease,
      hasNewPeopleIncrease,
      earlyPeriod: { count: earlyCount, messages: early.length },
      middlePeriod: { count: middleCount, messages: middle.length },
      latePeriod: { count: lateCount, messages: late.length },
      trend: lateCount > earlyCount ? 'increasing' : lateCount < earlyCount ? 'decreasing' : 'stable'
    };
  }

  /**
   * Extract flagged people (mentioned in concerning contexts)
   */
  extractFlaggedPeople(messages) {
    const flagged = [];
    
    // Look for new people mentioned alongside suspicious behavior
    messages.forEach(msg => {
      const lowerText = msg.content.toLowerCase();
      const hasNewPerson = this.relationshipKeywords.newPeople.some(phrase => 
        lowerText.includes(phrase)
      );
      const hasSuspicious = this.relationshipKeywords.suspiciousBehavior.some(phrase => 
        lowerText.includes(phrase)
      );
      
      if (hasNewPerson && hasSuspicious) {
        // Try to extract person name/description
        const sentences = this.sentenceTokenizer.tokenize(msg.content);
        sentences.forEach(sentence => {
          if (sentence.toLowerCase().includes('new') || sentence.toLowerCase().includes('met')) {
            flagged.push({
              context: sentence.substring(0, 200),
              timestamp: msg.timestamp,
              conversationId: msg.conversationId
            });
          }
        });
      }
    });

    return flagged.slice(0, 5); // Top 5
  }

  /**
   * Build relationship timeline
   */
  buildRelationshipTimeline(messages) {
    const timeline = [];
    
    messages.forEach(msg => {
      const lowerText = msg.content.toLowerCase();
      const hasNewPerson = this.relationshipKeywords.newPeople.some(phrase => 
        lowerText.includes(phrase)
      );
      const hasIsolation = this.relationshipKeywords.isolation.some(phrase => 
        lowerText.includes(phrase)
      );
      
      if (hasNewPerson || hasIsolation) {
        timeline.push({
          timestamp: msg.timestamp,
          type: hasNewPerson ? 'new_person' : 'isolation',
          excerpt: msg.content.substring(0, 150)
        });
      }
    });

    return timeline.slice(0, 10); // Top 10 events
  }

  /**
   * Calculate risk score
   */
  calculateRiskScore(analyses) {
    let score = 0;

    // New people (moderate concern)
    if (analyses.newPeople.count > 0) {
      score += Math.min(analyses.newPeople.count * 8, 30);
    }

    // Isolation (high concern)
    if (analyses.isolation.count > 0) {
      score += Math.min(analyses.isolation.count * 12, 40);
    }

    // Control (high concern)
    if (analyses.control.count > 0) {
      score += Math.min(analyses.control.count * 15, 45);
    }

    // Dependency (moderate concern)
    if (analyses.dependency.count > 0) {
      score += Math.min(analyses.dependency.count * 10, 35);
    }

    // Suspicious behavior (very high concern)
    if (analyses.suspicious.count > 0) {
      score += Math.min(analyses.suspicious.count * 20, 50);
    }

    // Temporal changes (escalation bonus)
    if (analyses.temporal.hasChanges) {
      score += 20;
    }

    // Combination bonus (multiple indicators together)
    const indicatorCount = [
      analyses.newPeople.count > 0,
      analyses.isolation.count > 0,
      analyses.control.count > 0,
      analyses.dependency.count > 0,
      analyses.suspicious.count > 0
    ].filter(Boolean).length;

    if (indicatorCount >= 3) {
      score += 15; // Multiple concerning patterns
    }

    return Math.min(score, 100);
  }

  /**
   * Generate indicators
   */
  generateIndicators(analyses) {
    const indicators = [];

    if (analyses.newPeople.count > 2) {
      indicators.push({
        type: 'new_people',
        severity: analyses.newPeople.count > 5 ? 'high' : 'medium',
        message: `Mentioned new people ${analyses.newPeople.count} time(s)`
      });
    }

    if (analyses.isolation.count > 0) {
      indicators.push({
        type: 'isolation',
        severity: analyses.isolation.count > 3 ? 'high' : 'medium',
        message: `Isolation indicators detected ${analyses.isolation.count} time(s)`
      });
    }

    if (analyses.control.count > 0) {
      indicators.push({
        type: 'control',
        severity: analyses.control.count > 2 ? 'high' : 'medium',
        message: `Control patterns detected ${analyses.control.count} time(s)`
      });
    }

    if (analyses.dependency.count > 0) {
      indicators.push({
        type: 'dependency',
        severity: analyses.dependency.count > 2 ? 'high' : 'medium',
        message: `Dependency patterns detected ${analyses.dependency.count} time(s)`
      });
    }

    if (analyses.suspicious.count > 0) {
      indicators.push({
        type: 'suspicious_behavior',
        severity: 'high',
        message: `Suspicious behavior patterns detected ${analyses.suspicious.count} time(s)`
      });
    }

    if (analyses.temporal.hasChanges) {
      indicators.push({
        type: 'temporal_changes',
        severity: 'high',
        message: `Significant relationship changes detected over time`
      });
    }

    return indicators;
  }

  /**
   * Calculate confidence level
   */
  calculateConfidence(messageCount) {
    if (messageCount < 5) return 'low';
    if (messageCount < 15) return 'medium';
    return 'high';
  }

  /**
   * Get default metrics
   */
  getDefaultMetrics() {
    return {
      riskScore: 0,
      confidence: 'none',
      indicators: [],
      newPeopleCount: 0,
      isolationCount: 0,
      controlCount: 0,
      dependencyCount: 0,
      suspiciousBehaviorCount: 0,
      temporalChanges: { hasChanges: false, trend: 'insufficient_data' },
      flaggedPeople: [],
      relationshipTimeline: []
    };
  }
}

module.exports = RelationshipPatternAnalyzer;

