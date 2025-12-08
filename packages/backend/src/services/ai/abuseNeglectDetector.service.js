// src/services/ai/abuseNeglectDetector.service.js

const natural = require('natural');
const logger = require('../../config/logger');

/**
 * Abuse and Neglect Detector Service
 * Detects patterns indicating physical, emotional abuse, or neglect
 */
class AbuseNeglectDetector {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer();
    
    // Physical abuse indicators
    this.physicalAbuseIndicators = {
      injuries: [
        'bruise', 'bruised', 'cut', 'cut me', 'hit', 'hit me', 'punched', 'slapped',
        'pushed', 'shoved', 'grabbed', 'pulled', 'hurt me', 'injured', 'wound',
        'black eye', 'swollen', 'bleeding', 'sore', 'painful'
      ],
      inconsistentExplanations: [
        'fell', 'accident', 'bumped into', 'tripped', 'slipped',
        'don\'t remember', 'not sure how', 'happened somehow'
      ],
      fearOfPerson: [
        'afraid of', 'scared of', 'fear', 'worried about', 'don\'t like',
        'makes me nervous', 'intimidated by', 'threatened by'
      ],
      punishment: [
        'punished', 'punishment', 'disciplined', 'taught a lesson',
        'got what i deserved', 'had it coming', 'deserved it'
      ]
    };

    // Emotional abuse indicators
    this.emotionalAbuseIndicators = {
      isolation: [
        'not allowed to', 'can\'t talk to', 'forbidden to', 'not supposed to',
        'told me not to', 'said i can\'t', 'won\'t let me', 'keeps me from'
      ],
      control: [
        'controls', 'tells me what to do', 'makes decisions for me',
        'won\'t let me', 'has to approve', 'needs permission'
      ],
      threats: [
        'threatened', 'threat', 'threatens', 'warned me', 'said they would',
        'going to', 'will hurt', 'will take away', 'will leave'
      ],
      belittling: [
        'stupid', 'worthless', 'useless', 'burden', 'incompetent',
        'can\'t do anything right', 'always wrong', 'never right'
      ],
      fearLanguage: [
        'afraid to', 'scared to', 'fear', 'worried', 'anxious about',
        'don\'t want to upset', 'don\'t want trouble', 'walking on eggshells'
      ]
    };

    // Neglect indicators
    this.neglectIndicators = {
      basicNeeds: [
        'no food', 'hungry', 'haven\'t eaten', 'no medication', 'missed medication',
        'out of medicine', 'no water', 'thirsty', 'dirty', 'haven\'t showered',
        'no clean clothes', 'cold', 'no heat', 'no electricity'
      ],
      medicalCare: [
        'can\'t see doctor', 'no doctor', 'missed appointment', 'no medical care',
        'pain', 'sick', 'not feeling well', 'need help', 'need care'
      ],
      isolation: [
        'alone', 'no one visits', 'no one calls', 'lonely', 'isolated',
        'left alone', 'abandoned', 'forgotten', 'no one cares'
      ],
      timeAlone: [
        'days alone', 'weeks alone', 'left me', 'gone for', 'hasn\'t been here',
        'no one here', 'by myself', 'all alone'
      ]
    };

    // Weights for different types
    this.weights = {
      physicalAbuse: 0.40,
      emotionalAbuse: 0.35,
      neglect: 0.25
    };
  }

  /**
   * Detect abuse and neglect patterns
   * @param {Array} patientMessages - Array of patient message strings
   * @param {string} combinedText - Combined text from all messages
   * @returns {Object} Abuse/neglect analysis results
   */
  detectAbuseNeglect(patientMessages, combinedText) {
    try {
      if (!patientMessages || patientMessages.length === 0) {
        return this.getDefaultMetrics();
      }

      const lowerText = combinedText.toLowerCase();
      
      // Analyze different types
      const physicalAbuseAnalysis = this.analyzePhysicalAbuse(lowerText, patientMessages);
      const emotionalAbuseAnalysis = this.analyzeEmotionalAbuse(lowerText);
      const neglectAnalysis = this.analyzeNeglect(lowerText);

      // Calculate risk score
      const riskScore = this.calculateRiskScore({
        physicalAbuse: physicalAbuseAnalysis,
        emotionalAbuse: emotionalAbuseAnalysis,
        neglect: neglectAnalysis
      });

      // Detect temporal patterns
      const temporalPatterns = this.analyzeTemporalPatterns(patientMessages);

      // Generate indicators
      const indicators = this.generateIndicators({
        physicalAbuse: physicalAbuseAnalysis,
        emotionalAbuse: emotionalAbuseAnalysis,
        neglect: neglectAnalysis,
        temporalPatterns
      });

      return {
        riskScore: Math.round(riskScore * 100) / 100,
        confidence: this.calculateConfidence(combinedText.length, patientMessages.length),
        indicators,
        physicalAbuseScore: physicalAbuseAnalysis.score,
        emotionalAbuseScore: emotionalAbuseAnalysis.score,
        neglectScore: neglectAnalysis.score,
        injuryMentions: physicalAbuseAnalysis.injuryCount,
        isolationMentions: emotionalAbuseAnalysis.isolationCount + neglectAnalysis.isolationCount,
        fearMentions: physicalAbuseAnalysis.fearCount + emotionalAbuseAnalysis.fearCount,
        basicNeedsMentions: neglectAnalysis.basicNeedsCount,
        temporalPatterns,
        flaggedPhrases: [
          ...physicalAbuseAnalysis.phrases,
          ...emotionalAbuseAnalysis.phrases,
          ...neglectAnalysis.phrases
        ].slice(0, 10)
      };
    } catch (error) {
      logger.error('Error in AbuseNeglectDetector:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Analyze physical abuse indicators
   */
  analyzePhysicalAbuse(lowerText, messages) {
    const injuries = [];
    const fears = [];
    const punishments = [];
    const phrases = [];

    // Check for injuries
    this.physicalAbuseIndicators.injuries.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const found = lowerText.match(regex);
      if (found) {
        injuries.push(...found);
        phrases.push(keyword);
      }
    });

    // Check for fear of person
    this.physicalAbuseIndicators.fearOfPerson.forEach(phrase => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const found = lowerText.match(regex);
      if (found) {
        fears.push(...found);
        phrases.push(phrase);
      }
    });

    // Check for punishment language
    this.physicalAbuseIndicators.punishment.forEach(phrase => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const found = lowerText.match(regex);
      if (found) {
        punishments.push(...found);
        phrases.push(phrase);
      }
    });

    // Check for inconsistent explanations (injuries with vague causes)
    let inconsistentCount = 0;
    const injuryMessages = messages.filter(msg => {
      const lowerMsg = msg.toLowerCase();
      return this.physicalAbuseIndicators.injuries.some(keyword => 
        lowerMsg.includes(keyword)
      );
    });

    injuryMessages.forEach(msg => {
      const lowerMsg = msg.toLowerCase();
      if (this.physicalAbuseIndicators.inconsistentExplanations.some(phrase => 
        lowerMsg.includes(phrase)
      )) {
        inconsistentCount++;
      }
    });

    // Calculate score
    const injuryScore = Math.min(injuries.length * 15, 100);
    const fearScore = Math.min(fears.length * 20, 100);
    const punishmentScore = Math.min(punishments.length * 25, 100);
    const inconsistentScore = inconsistentCount * 30;
    
    const score = Math.min(
      (injuryScore * 0.3 + fearScore * 0.3 + punishmentScore * 0.3 + inconsistentScore * 0.1),
      100
    );

    return {
      score,
      injuryCount: injuries.length,
      fearCount: fears.length,
      punishmentCount: punishments.length,
      inconsistentExplanations: inconsistentCount,
      phrases: [...new Set(phrases)]
    };
  }

  /**
   * Analyze emotional abuse indicators
   */
  analyzeEmotionalAbuse(lowerText) {
    const isolations = [];
    const controls = [];
    const threats = [];
    const belittlings = [];
    const fears = [];
    const phrases = [];

    // Isolation
    this.emotionalAbuseIndicators.isolation.forEach(phrase => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const found = lowerText.match(regex);
      if (found) {
        isolations.push(...found);
        phrases.push(phrase);
      }
    });

    // Control
    this.emotionalAbuseIndicators.control.forEach(phrase => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const found = lowerText.match(regex);
      if (found) {
        controls.push(...found);
        phrases.push(phrase);
      }
    });

    // Threats
    this.emotionalAbuseIndicators.threats.forEach(phrase => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const found = lowerText.match(regex);
      if (found) {
        threats.push(...found);
        phrases.push(phrase);
      }
    });

    // Belittling
    this.emotionalAbuseIndicators.belittling.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const found = lowerText.match(regex);
      if (found) {
        belittlings.push(...found);
        phrases.push(keyword);
      }
    });

    // Fear language
    this.emotionalAbuseIndicators.fearLanguage.forEach(phrase => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const found = lowerText.match(regex);
      if (found) {
        fears.push(...found);
        phrases.push(phrase);
      }
    });

    // Calculate score
    const isolationScore = Math.min(isolations.length * 15, 100);
    const controlScore = Math.min(controls.length * 20, 100);
    const threatScore = Math.min(threats.length * 25, 100);
    const belittlingScore = Math.min(belittlings.length * 18, 100);
    const fearScore = Math.min(fears.length * 15, 100);
    
    const score = Math.min(
      (isolationScore * 0.25 + controlScore * 0.25 + threatScore * 0.20 + 
       belittlingScore * 0.15 + fearScore * 0.15),
      100
    );

    return {
      score,
      isolationCount: isolations.length,
      controlCount: controls.length,
      threatCount: threats.length,
      belittlingCount: belittlings.length,
      fearCount: fears.length,
      phrases: [...new Set(phrases)]
    };
  }

  /**
   * Analyze neglect indicators
   */
  analyzeNeglect(lowerText) {
    const basicNeeds = [];
    const medicalCare = [];
    const isolations = [];
    const timeAlone = [];
    const phrases = [];

    // Basic needs
    this.neglectIndicators.basicNeeds.forEach(phrase => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const found = lowerText.match(regex);
      if (found) {
        basicNeeds.push(...found);
        phrases.push(phrase);
      }
    });

    // Medical care
    this.neglectIndicators.medicalCare.forEach(phrase => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const found = lowerText.match(regex);
      if (found) {
        medicalCare.push(...found);
        phrases.push(phrase);
      }
    });

    // Isolation
    this.neglectIndicators.isolation.forEach(phrase => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const found = lowerText.match(regex);
      if (found) {
        isolations.push(...found);
        phrases.push(phrase);
      }
    });

    // Time alone
    this.neglectIndicators.timeAlone.forEach(phrase => {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const found = lowerText.match(regex);
      if (found) {
        timeAlone.push(...found);
        phrases.push(phrase);
      }
    });

    // Calculate score
    const basicNeedsScore = Math.min(basicNeeds.length * 20, 100);
    const medicalCareScore = Math.min(medicalCare.length * 25, 100);
    const isolationScore = Math.min(isolations.length * 15, 100);
    const timeAloneScore = Math.min(timeAlone.length * 18, 100);
    
    const score = Math.min(
      (basicNeedsScore * 0.30 + medicalCareScore * 0.35 + 
       isolationScore * 0.20 + timeAloneScore * 0.15),
      100
    );

    return {
      score,
      basicNeedsCount: basicNeeds.length,
      medicalCareCount: medicalCare.length,
      isolationCount: isolations.length,
      timeAloneCount: timeAlone.length,
      phrases: [...new Set(phrases)]
    };
  }

  /**
   * Analyze temporal patterns
   */
  analyzeTemporalPatterns(messages) {
    if (messages.length < 3) {
      return { hasEscalation: false, trend: 'insufficient_data' };
    }

    // Count abuse/neglect mentions per message
    const abuseMentions = messages.map((msg, idx) => {
      const lowerMsg = msg.toLowerCase();
      let count = 0;
      
      [...Object.values(this.physicalAbuseIndicators).flat(),
       ...Object.values(this.emotionalAbuseIndicators).flat(),
       ...Object.values(this.neglectIndicators).flat()].forEach(keyword => {
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        if (lowerMsg.match(regex)) count++;
      });
      
      return { index: idx, count };
    });

    const recent = abuseMentions.slice(-5);
    const earlier = abuseMentions.slice(0, Math.max(1, Math.floor(abuseMentions.length / 2)));
    
    const recentAvg = recent.reduce((sum, m) => sum + m.count, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, m) => sum + m.count, 0) / earlier.length;

    return {
      hasEscalation: recentAvg > earlierAvg * 1.5,
      trend: recentAvg > earlierAvg ? 'increasing' : recentAvg < earlierAvg ? 'decreasing' : 'stable',
      recentAverage: recentAvg,
      earlierAverage: earlierAvg
    };
  }

  /**
   * Calculate overall risk score
   */
  calculateRiskScore(analyses) {
    let score = 0;

    // Physical abuse
    if (analyses.physicalAbuse.score > 0) {
      score += analyses.physicalAbuse.score * this.weights.physicalAbuse;
    }

    // Emotional abuse
    if (analyses.emotionalAbuse.score > 0) {
      score += analyses.emotionalAbuse.score * this.weights.emotionalAbuse;
    }

    // Neglect
    if (analyses.neglect.score > 0) {
      score += analyses.neglect.score * this.weights.neglect;
    }

    // Temporal escalation bonus
    if (analyses.temporalPatterns?.hasEscalation) {
      score += 15;
    }

    return Math.min(score, 100);
  }

  /**
   * Generate indicators
   */
  generateIndicators(analyses) {
    const indicators = [];

    if (analyses.physicalAbuse.score > 30) {
      indicators.push({
        type: 'physical_abuse',
        severity: analyses.physicalAbuse.score > 60 ? 'high' : 'medium',
        message: `Physical abuse indicators detected (score: ${analyses.physicalAbuse.score.toFixed(0)})`
      });
    }

    if (analyses.emotionalAbuse.score > 30) {
      indicators.push({
        type: 'emotional_abuse',
        severity: analyses.emotionalAbuse.score > 60 ? 'high' : 'medium',
        message: `Emotional abuse indicators detected (score: ${analyses.emotionalAbuse.score.toFixed(0)})`
      });
    }

    if (analyses.neglect.score > 30) {
      indicators.push({
        type: 'neglect',
        severity: analyses.neglect.score > 60 ? 'high' : 'medium',
        message: `Neglect indicators detected (score: ${analyses.neglect.score.toFixed(0)})`
      });
    }

    if (analyses.temporalPatterns?.hasEscalation) {
      indicators.push({
        type: 'escalation',
        severity: 'high',
        message: `Abuse/neglect mentions have increased over time`
      });
    }

    return indicators;
  }

  /**
   * Calculate confidence level
   */
  calculateConfidence(textLength, messageCount) {
    if (textLength < 500 || messageCount < 3) return 'low';
    if (textLength < 2000 || messageCount < 10) return 'medium';
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
      physicalAbuseScore: 0,
      emotionalAbuseScore: 0,
      neglectScore: 0,
      injuryMentions: 0,
      isolationMentions: 0,
      fearMentions: 0,
      basicNeedsMentions: 0,
      temporalPatterns: { hasEscalation: false, trend: 'insufficient_data' },
      flaggedPhrases: []
    };
  }
}

module.exports = AbuseNeglectDetector;

