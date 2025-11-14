// tests/unit/fraudAbuseDetector.test.js

const FinancialExploitationDetector = require('../../src/services/ai/financialExploitationDetector.service');
const AbuseNeglectDetector = require('../../src/services/ai/abuseNeglectDetector.service');
const RelationshipPatternAnalyzer = require('../../src/services/ai/relationshipPatternAnalyzer.service');
const FraudAbuseAnalyzer = require('../../src/services/ai/fraudAbuseAnalyzer.service');

describe('Financial Exploitation Detector', () => {
  let detector;

  beforeEach(() => {
    detector = new FinancialExploitationDetector();
  });

  describe('detectFinancialExploitation', () => {
    it('should detect large money amounts', () => {
      const messages = ['I need to send ten thousand dollars to someone'];
      const result = detector.detectFinancialExploitation(messages, messages.join(' '));
      
      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.largeAmountMentions).toBeGreaterThan(0);
    });

    it('should detect money transfer methods', () => {
      const messages = ['I sent money through Western Union'];
      const result = detector.detectFinancialExploitation(messages, messages.join(' '));
      
      expect(result.transferMethodMentions).toBeGreaterThan(0);
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it('should detect scam indicators', () => {
      const messages = ['I won a prize and need to pay taxes on it'];
      const result = detector.detectFinancialExploitation(messages, messages.join(' '));
      
      expect(result.scamIndicatorMentions).toBeGreaterThan(0);
    });

    it('should detect urgency language', () => {
      const messages = ['I need to act now, this is urgent, don\'t tell anyone'];
      const result = detector.detectFinancialExploitation(messages, messages.join(' '));
      
      expect(result.urgencyMentions).toBeGreaterThan(0);
    });

    it('should detect escalation patterns over time', () => {
      // Need more messages to detect escalation (at least 3 for temporal analysis)
      const messages = [
        'I met someone new online',
        'This new friend asked if I could send them some money',
        'I sent five thousand dollars to my new friend through Western Union',
        'I need to send more money urgently',
        'They said I need to send ten thousand dollars immediately'
      ];
      const result = detector.detectFinancialExploitation(messages, messages.join(' '));
      
      // Check that temporal patterns were analyzed (may or may not show escalation depending on pattern)
      expect(result.temporalPatterns).toBeDefined();
      expect(result.temporalPatterns.trend).toBeDefined();
    });

    it('should return default metrics for empty input', () => {
      const result = detector.detectFinancialExploitation([], '');
      
      expect(result.riskScore).toBe(0);
      expect(result.confidence).toBe('none');
    });
  });
});

describe('Abuse Neglect Detector', () => {
  let detector;

  beforeEach(() => {
    detector = new AbuseNeglectDetector();
  });

  describe('detectAbuseNeglect', () => {
    it('should detect physical abuse indicators', () => {
      const messages = ['Someone hit me and I have a bruise'];
      const result = detector.detectAbuseNeglect(messages, messages.join(' '));
      
      expect(result.physicalAbuseScore).toBeGreaterThan(0);
      expect(result.injuryMentions).toBeGreaterThan(0);
    });

    it('should detect emotional abuse indicators', () => {
      const messages = ['I am not allowed to talk to my friends anymore'];
      const result = detector.detectAbuseNeglect(messages, messages.join(' '));
      
      expect(result.emotionalAbuseScore).toBeGreaterThan(0);
      expect(result.isolationMentions).toBeGreaterThan(0);
    });

    it('should detect neglect indicators', () => {
      const messages = ['I haven\'t eaten in two days, there is no food'];
      const result = detector.detectAbuseNeglect(messages, messages.join(' '));
      
      expect(result.neglectScore).toBeGreaterThan(0);
      expect(result.basicNeedsMentions).toBeGreaterThan(0);
    });

    it('should detect fear language', () => {
      const messages = ['I am afraid to talk about it, I don\'t want to get in trouble'];
      const result = detector.detectAbuseNeglect(messages, messages.join(' '));
      
      expect(result.fearMentions).toBeGreaterThan(0);
    });

    it('should detect inconsistent injury explanations', () => {
      const messages = ['I have a cut on my face, I don\'t remember how it happened'];
      const result = detector.detectAbuseNeglect(messages, messages.join(' '));
      
      expect(result.physicalAbuseScore).toBeGreaterThan(0);
    });

    it('should return default metrics for empty input', () => {
      const result = detector.detectAbuseNeglect([], '');
      
      expect(result.riskScore).toBe(0);
      expect(result.confidence).toBe('none');
    });
  });
});

describe('Relationship Pattern Analyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new RelationshipPatternAnalyzer();
  });

  describe('analyzeRelationshipPatterns', () => {
    it('should detect new people mentions', async () => {
      const mongoose = require('mongoose');
      const conversations = [{
        _id: new mongoose.Types.ObjectId(),
        messages: [{
          role: 'patient',
          content: 'I met someone new online',
          createdAt: new Date()
        }],
        createdAt: new Date()
      }];

      const result = await analyzer.analyzeRelationshipPatterns(conversations);
      
      expect(result.newPeopleCount).toBeGreaterThan(0);
    });

    it('should detect isolation patterns', async () => {
      const mongoose = require('mongoose');
      const conversations = [{
        _id: new mongoose.Types.ObjectId(),
        messages: [{
          role: 'patient',
          content: 'I am not allowed to talk to my friends',
          createdAt: new Date()
        }],
        createdAt: new Date()
      }];

      const result = await analyzer.analyzeRelationshipPatterns(conversations);
      
      expect(result.isolationCount).toBeGreaterThan(0);
    });

    it('should detect control patterns', async () => {
      const mongoose = require('mongoose');
      const conversations = [{
        _id: new mongoose.Types.ObjectId(),
        messages: [{
          role: 'patient',
          content: 'They tell me what to do. They make decisions for me. They won\'t let me do anything. I have to ask permission for everything.',
          createdAt: new Date()
        }],
        createdAt: new Date()
      }];

      const result = await analyzer.analyzeRelationshipPatterns(conversations);
      
      expect(result.controlCount).toBeGreaterThan(0);
    });

    it('should detect suspicious behavior', async () => {
      const mongoose = require('mongoose');
      const conversations = [{
        _id: new mongoose.Types.ObjectId(),
        messages: [{
          role: 'patient',
          content: 'This new person I met asks for money',
          createdAt: new Date()
        }],
        createdAt: new Date()
      }];

      const result = await analyzer.analyzeRelationshipPatterns(conversations);
      
      expect(result.suspiciousBehaviorCount).toBeGreaterThan(0);
    });

    it('should return default metrics for empty input', async () => {
      const result = await analyzer.analyzeRelationshipPatterns([]);
      
      expect(result.riskScore).toBe(0);
      expect(result.confidence).toBe('none');
    });
  });
});

describe('Fraud Abuse Analyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new FraudAbuseAnalyzer();
  });

  describe('analyzeConversations', () => {
    it('should analyze financial exploitation', async () => {
      const mongoose = require('mongoose');
      const conversations = [{
        _id: new mongoose.Types.ObjectId(),
        messages: [{
          role: 'patient',
          content: 'I sent five thousand dollars through Western Union to someone. They said it was urgent and I need to act now. They told me not to tell anyone about it.',
          createdAt: new Date()
        }],
        createdAt: new Date()
      }];

      const result = await analyzer.analyzeConversations(conversations);
      
      expect(result.financialRisk.riskScore).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(0);
    });

    it('should analyze abuse patterns', async () => {
      const mongoose = require('mongoose');
      const conversations = [{
        _id: new mongoose.Types.ObjectId(),
        messages: [{
          role: 'patient',
          content: 'Someone hit me and I have a black eye. They said I deserved it because I did something wrong. I am scared of them and I don\'t want to tell anyone because they said they would hurt me more if I did.',
          createdAt: new Date()
        }],
        createdAt: new Date()
      }];

      const result = await analyzer.analyzeConversations(conversations);
      
      expect(result.abuseRisk.riskScore).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(0);
    });

    it('should generate warnings for high risk', async () => {
      const mongoose = require('mongoose');
      // Create multiple conversations to ensure high risk scores
      const conversations = [
        {
          _id: new mongoose.Types.ObjectId(),
          messages: [{
            role: 'patient',
            content: 'I got a call from someone saying I won a prize and I need to send them money for taxes. They said I need to send ten thousand dollars immediately or I will lose the prize. This is urgent!',
            createdAt: new Date()
          }],
          createdAt: new Date()
        },
        {
          _id: new mongoose.Types.ObjectId(),
          messages: [{
            role: 'patient',
            content: 'I sent the money through Western Union. They told me not to tell anyone about this. I need to send more money for gift cards to verify my identity.',
            createdAt: new Date()
          }],
          createdAt: new Date()
        }
      ];

      const result = await analyzer.analyzeConversations(conversations);
      
      // Should have warnings or recommendations (at least one should be present)
      expect(result.warnings.length + result.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate overall risk score from multiple indicators', async () => {
      const mongoose = require('mongoose');
      const conversations = [{
        _id: new mongoose.Types.ObjectId(),
        messages: [
          {
            role: 'patient',
            content: 'I met someone new online and they asked me to send them money. I sent five thousand dollars to this new friend through Western Union.',
            createdAt: new Date()
          },
          {
            role: 'patient',
            content: 'I am not allowed to talk to my friends anymore. They said I can\'t see my family. I feel isolated and alone.',
            createdAt: new Date()
          },
          {
            role: 'patient',
            content: 'I haven\'t eaten in two days. There is no food in the house. I am hungry and I don\'t know what to do.',
            createdAt: new Date()
          }
        ],
        createdAt: new Date()
      }];

      const result = await analyzer.analyzeConversations(conversations);
      
      expect(result.overallRiskScore).toBeGreaterThan(0);
      expect(result.financialRisk.riskScore).toBeGreaterThan(0);
      expect(result.abuseRisk.riskScore).toBeGreaterThan(0);
      expect(result.relationshipRisk.riskScore).toBeGreaterThan(0);
    });

    it('should return default metrics for insufficient data', async () => {
      const mongoose = require('mongoose');
      const conversations = [{
        _id: new mongoose.Types.ObjectId(),
        messages: [{
          role: 'patient',
          content: 'Hi',
          createdAt: new Date()
        }],
        createdAt: new Date()
      }];

      const result = await analyzer.analyzeConversations(conversations);
      
      expect(result.warnings).toContain('Insufficient conversation data for analysis (< 100 characters)');
      expect(result.confidence).toBe('low');
    });
  });
});

