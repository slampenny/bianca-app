// src/services/ai/fraudAbuseAnalyzer.service.js

const natural = require('natural');
const logger = require('../../config/logger');
const FinancialExploitationDetector = require('./financialExploitationDetector.service');
const AbuseNeglectDetector = require('./abuseNeglectDetector.service');
const RelationshipPatternAnalyzer = require('./relationshipPatternAnalyzer.service');

/**
 * Fraud and Abuse Analyzer
 * Analyzes patient conversations for signs of fraud, exploitation, abuse, or neglect
 */
class FraudAbuseAnalyzer {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    
    this.financialDetector = new FinancialExploitationDetector();
    this.abuseDetector = new AbuseNeglectDetector();
    this.relationshipAnalyzer = new RelationshipPatternAnalyzer();
    
    // Configuration for analysis thresholds
    this.config = {
      financialRiskThreshold: 40,    // Risk score threshold for financial exploitation
      abuseRiskThreshold: 40,          // Risk score threshold for abuse/neglect
      relationshipRiskThreshold: 30,   // Risk score threshold for relationship concerns
      overallRiskThreshold: 50,        // Overall risk score threshold
      baselineMonths: 3,               // Months for rolling baseline
    };
  }

  /**
   * Analyze conversations for fraud and abuse patterns
   * @param {Array} conversations - Array of conversation objects
   * @param {Object} baseline - Previous analysis results for comparison
   * @returns {Object} Analysis results with metrics and warnings
   */
  async analyzeConversations(conversations, baseline = null) {
    try {
      // Extract and combine all patient messages from conversations
      const patientMessages = await this.extractPatientMessages(conversations);
      const combinedText = patientMessages.join(' ');

      if (combinedText.length < 100) {
        return {
          financialRisk: this.financialDetector.getDefaultMetrics(),
          abuseRisk: this.abuseDetector.getDefaultMetrics(),
          relationshipRisk: this.relationshipAnalyzer.getDefaultMetrics(),
          changeFromBaseline: null,
          warnings: ['Insufficient conversation data for analysis (< 100 characters)'],
          confidence: 'low',
          overallRiskScore: 0
        };
      }

      // Perform financial exploitation analysis
      const financialRisk = this.financialDetector.detectFinancialExploitation(
        patientMessages,
        combinedText
      );
      
      // Perform abuse/neglect analysis
      const abuseRisk = this.abuseDetector.detectAbuseNeglect(
        patientMessages,
        combinedText
      );
      
      // Perform relationship pattern analysis
      const relationshipRisk = await this.relationshipAnalyzer.analyzeRelationshipPatterns(
        conversations
      );

      // Calculate overall risk score
      const overallRiskScore = this.calculateOverallRiskScore({
        financial: financialRisk,
        abuse: abuseRisk,
        relationship: relationshipRisk
      });

      // Calculate changes from baseline
      const changeFromBaseline = baseline ? this.calculateBaselineChanges(
        financialRisk,
        abuseRisk,
        relationshipRisk,
        overallRiskScore,
        baseline
      ) : null;

      // Generate warnings based on analysis
      const warnings = this.generateWarnings(
        financialRisk,
        abuseRisk,
        relationshipRisk,
        overallRiskScore,
        changeFromBaseline
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        financialRisk,
        abuseRisk,
        relationshipRisk,
        overallRiskScore
      );

      return {
        financialRisk,
        abuseRisk,
        relationshipRisk,
        overallRiskScore: Math.round(overallRiskScore * 100) / 100,
        changeFromBaseline,
        warnings,
        recommendations,
        confidence: this.calculateConfidence(combinedText.length, conversations.length),
        analysisDate: new Date(),
        conversationCount: conversations.length,
        messageCount: patientMessages.length,
        totalWords: combinedText.split(/\s+/).length
      };

    } catch (error) {
      logger.error('Error in FraudAbuseAnalyzer.analyzeConversations:', error);
      return {
        financialRisk: this.financialDetector.getDefaultMetrics(),
        abuseRisk: this.abuseDetector.getDefaultMetrics(),
        relationshipRisk: this.relationshipAnalyzer.getDefaultMetrics(),
        changeFromBaseline: null,
        warnings: [`Analysis failed: ${error.message}`],
        recommendations: [],
        confidence: 'none',
        overallRiskScore: 0,
        error: error.message
      };
    }
  }

  /**
   * Extract patient messages from conversations
   * @param {Array} conversations - Array of conversation objects
   * @returns {Array} Array of patient message strings
   */
  async extractPatientMessages(conversations) {
    const messages = [];
    const { Message } = require('../../models');
    
    for (const conversation of conversations) {
      if (conversation.messages && Array.isArray(conversation.messages)) {
        // Check if messages are populated objects or just IDs/ObjectIds
        const firstMessage = conversation.messages[0];
        const isPopulated = firstMessage && firstMessage.role !== undefined && firstMessage.content !== undefined;
        
        if (!isPopulated && conversation.messages.length > 0) {
          // Messages are IDs/ObjectIds, need to populate them
          const populatedMessages = await Message.find({ _id: { $in: conversation.messages } })
            .sort({ createdAt: 1 });
          populatedMessages.forEach(message => {
            if (message.role === 'patient' && message.content && message.content.trim()) {
              messages.push(message.content.trim());
            }
          });
        } else {
          // Messages are already populated objects
          conversation.messages.forEach(message => {
            if (message.role === 'patient' && message.content && message.content.trim()) {
              messages.push(message.content.trim());
            }
          });
        }
      }
    }

    return messages;
  }

  /**
   * Calculate overall risk score from all analyses
   */
  calculateOverallRiskScore(analyses) {
    // Weighted combination of all risk scores
    const financialWeight = 0.35;
    const abuseWeight = 0.40;
    const relationshipWeight = 0.25;

    let score = 0;
    let totalWeight = 0;

    if (analyses.financial.riskScore > 0) {
      score += analyses.financial.riskScore * financialWeight;
      totalWeight += financialWeight;
    }

    if (analyses.abuse.riskScore > 0) {
      score += analyses.abuse.riskScore * abuseWeight;
      totalWeight += abuseWeight;
    }

    if (analyses.relationship.riskScore > 0) {
      score += analyses.relationship.riskScore * relationshipWeight;
      totalWeight += relationshipWeight;
    }

    // Normalize if weights don't sum to 1
    if (totalWeight > 0 && totalWeight < 1) {
      score = score / totalWeight;
    }

    // Bonus for multiple high-risk areas
    const highRiskCount = [
      analyses.financial.riskScore >= this.config.financialRiskThreshold,
      analyses.abuse.riskScore >= this.config.abuseRiskThreshold,
      analyses.relationship.riskScore >= this.config.relationshipRiskThreshold
    ].filter(Boolean).length;

    if (highRiskCount >= 2) {
      score += 15; // Multiple concerning areas
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate changes from baseline analysis
   */
  calculateBaselineChanges(financialRisk, abuseRisk, relationshipRisk, overallRiskScore, baseline) {
    const changes = {};

    // Financial risk changes
    if (baseline.financialRisk) {
      changes.financial = {
        riskScore: financialRisk.riskScore - (baseline.financialRisk.riskScore || 0),
        largeAmountMentions: financialRisk.largeAmountMentions - (baseline.financialRisk.largeAmountMentions || 0),
        transferMethodMentions: financialRisk.transferMethodMentions - (baseline.financialRisk.transferMethodMentions || 0)
      };
    }

    // Abuse risk changes
    if (baseline.abuseRisk) {
      changes.abuse = {
        riskScore: abuseRisk.riskScore - (baseline.abuseRisk.riskScore || 0),
        physicalAbuseScore: abuseRisk.physicalAbuseScore - (baseline.abuseRisk.physicalAbuseScore || 0),
        emotionalAbuseScore: abuseRisk.emotionalAbuseScore - (baseline.abuseRisk.emotionalAbuseScore || 0),
        neglectScore: abuseRisk.neglectScore - (baseline.abuseRisk.neglectScore || 0)
      };
    }

    // Relationship risk changes
    if (baseline.relationshipRisk) {
      changes.relationship = {
        riskScore: relationshipRisk.riskScore - (baseline.relationshipRisk.riskScore || 0),
        newPeopleCount: relationshipRisk.newPeopleCount - (baseline.relationshipRisk.newPeopleCount || 0),
        isolationCount: relationshipRisk.isolationCount - (baseline.relationshipRisk.isolationCount || 0)
      };
    }

    // Overall risk change
    if (baseline.overallRiskScore !== undefined) {
      changes.overall = {
        riskScore: overallRiskScore - baseline.overallRiskScore
      };
    }

    return changes;
  }

  /**
   * Generate warnings based on analysis results
   */
  generateWarnings(financialRisk, abuseRisk, relationshipRisk, overallRiskScore, changeFromBaseline) {
    const warnings = [];

    // Financial exploitation warnings
    if (financialRisk.riskScore >= this.config.financialRiskThreshold) {
      warnings.push(`Financial exploitation risk detected (score: ${financialRisk.riskScore.toFixed(0)}/100)`);
    }

    if (financialRisk.largeAmountMentions > 2) {
      warnings.push(`Multiple mentions of large money amounts (${financialRisk.largeAmountMentions} mentions)`);
    }

    if (financialRisk.transferMethodMentions > 0) {
      warnings.push(`Discussed money transfer methods (potential scam indicators)`);
    }

    if (financialRisk.temporalPatterns?.hasEscalation) {
      warnings.push(`Financial topic mentions have escalated over time`);
    }

    // Abuse/neglect warnings
    if (abuseRisk.riskScore >= this.config.abuseRiskThreshold) {
      warnings.push(`Abuse or neglect risk detected (score: ${abuseRisk.riskScore.toFixed(0)}/100)`);
    }

    if (abuseRisk.physicalAbuseScore > 30) {
      warnings.push(`Physical abuse indicators detected (score: ${abuseRisk.physicalAbuseScore.toFixed(0)})`);
    }

    if (abuseRisk.emotionalAbuseScore > 30) {
      warnings.push(`Emotional abuse indicators detected (score: ${abuseRisk.emotionalAbuseScore.toFixed(0)})`);
    }

    if (abuseRisk.neglectScore > 30) {
      warnings.push(`Neglect indicators detected (score: ${abuseRisk.neglectScore.toFixed(0)})`);
    }

    if (abuseRisk.temporalPatterns?.hasEscalation) {
      warnings.push(`Abuse/neglect mentions have escalated over time`);
    }

    // Relationship warnings
    if (relationshipRisk.riskScore >= this.config.relationshipRiskThreshold) {
      warnings.push(`Concerning relationship patterns detected (score: ${relationshipRisk.riskScore.toFixed(0)}/100)`);
    }

    if (relationshipRisk.isolationCount > 2) {
      warnings.push(`Multiple isolation indicators detected (${relationshipRisk.isolationCount} mentions)`);
    }

    if (relationshipRisk.suspiciousBehaviorCount > 0) {
      warnings.push(`Suspicious behavior patterns detected in relationships`);
    }

    if (relationshipRisk.temporalChanges?.hasChanges) {
      warnings.push(`Significant relationship changes detected over time`);
    }

    // Overall risk warnings
    if (overallRiskScore >= this.config.overallRiskThreshold) {
      warnings.push(`HIGH OVERALL RISK: Multiple concerning patterns detected (score: ${overallRiskScore.toFixed(0)}/100)`);
    }

    // Baseline change warnings
    if (changeFromBaseline) {
      if (changeFromBaseline.overall?.riskScore > 20) {
        warnings.push(`Risk score increased significantly from baseline (+${changeFromBaseline.overall.riskScore.toFixed(0)} points)`);
      }

      if (changeFromBaseline.financial?.riskScore > 15) {
        warnings.push(`Financial risk increased from baseline (+${changeFromBaseline.financial.riskScore.toFixed(0)} points)`);
      }

      if (changeFromBaseline.abuse?.riskScore > 15) {
        warnings.push(`Abuse/neglect risk increased from baseline (+${changeFromBaseline.abuse.riskScore.toFixed(0)} points)`);
      }
    }

    return warnings;
  }

  /**
   * Generate recommendations for caregivers
   */
  generateRecommendations(financialRisk, abuseRisk, relationshipRisk, overallRiskScore) {
    const recommendations = [];

    // Financial recommendations
    if (financialRisk.riskScore >= this.config.financialRiskThreshold) {
      recommendations.push({
        category: 'financial',
        priority: financialRisk.riskScore >= 60 ? 'high' : 'medium',
        action: 'Review patient\'s financial accounts and recent transactions',
        description: 'Monitor for unauthorized transfers or unusual spending patterns'
      });

      if (financialRisk.transferMethodMentions > 0) {
        recommendations.push({
          category: 'financial',
          priority: 'high',
          action: 'Educate patient about common financial scams',
          description: 'Patient may be targeted by scammers using money transfer methods'
        });
      }
    }

    // Abuse recommendations
    if (abuseRisk.riskScore >= this.config.abuseRiskThreshold) {
      recommendations.push({
        category: 'abuse',
        priority: abuseRisk.riskScore >= 60 ? 'high' : 'medium',
        action: 'Conduct in-person visit to assess patient\'s safety',
        description: 'Physical or emotional abuse indicators detected'
      });

      if (abuseRisk.physicalAbuseScore > 40) {
        recommendations.push({
          category: 'abuse',
          priority: 'high',
          action: 'Consider reporting to adult protective services',
          description: 'Strong indicators of physical abuse detected'
        });
      }

      if (abuseRisk.neglectScore > 40) {
        recommendations.push({
          category: 'neglect',
          priority: 'high',
          action: 'Verify patient has access to basic needs (food, medication, medical care)',
          description: 'Neglect indicators suggest unmet basic needs'
        });
      }
    }

    // Relationship recommendations
    if (relationshipRisk.riskScore >= this.config.relationshipRiskThreshold) {
      recommendations.push({
        category: 'relationship',
        priority: relationshipRisk.riskScore >= 50 ? 'high' : 'medium',
        action: 'Review patient\'s social connections and recent relationship changes',
        description: 'Concerning patterns in relationships detected'
      });

      if (relationshipRisk.isolationCount > 2) {
        recommendations.push({
          category: 'relationship',
          priority: 'medium',
          action: 'Investigate why patient is isolated from previous support network',
          description: 'Patient appears to be isolated from previous relationships'
        });
      }
    }

    // Overall recommendations
    if (overallRiskScore >= this.config.overallRiskThreshold) {
      recommendations.push({
        category: 'overall',
        priority: 'high',
        action: 'Schedule immediate assessment with healthcare provider',
        description: 'Multiple high-risk indicators detected - comprehensive evaluation recommended'
      });
    }

    // If no specific risks, provide general guidance
    if (recommendations.length === 0) {
      recommendations.push({
        category: 'general',
        priority: 'low',
        action: 'Continue regular monitoring',
        description: 'No significant risk indicators detected at this time'
      });
    }

    return recommendations;
  }

  /**
   * Calculate confidence level of analysis
   */
  calculateConfidence(textLength, conversationCount) {
    if (textLength < 500 || conversationCount < 3) return 'low';
    if (textLength < 2000 || conversationCount < 10) return 'medium';
    return 'high';
  }

  /**
   * Get default metrics structure
   */
  getDefaultMetrics() {
    return {
      financialRisk: this.financialDetector.getDefaultMetrics(),
      abuseRisk: this.abuseDetector.getDefaultMetrics(),
      relationshipRisk: this.relationshipAnalyzer.getDefaultMetrics(),
      overallRiskScore: 0,
      confidence: 'none',
      warnings: [],
      recommendations: []
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

module.exports = FraudAbuseAnalyzer;

