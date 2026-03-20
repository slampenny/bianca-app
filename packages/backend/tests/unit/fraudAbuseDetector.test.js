// tests/unit/fraudAbuseDetector.test.js

const { embeddingAnchorService } = require('../../src/services/ai/embeddingAnchor.service');
const FinancialExploitationDetector = require('../../src/services/ai/financialExploitationDetector.service');
const AbuseNeglectDetector = require('../../src/services/ai/abuseNeglectDetector.service');
const RelationshipPatternAnalyzer = require('../../src/services/ai/relationshipPatternAnalyzer.service');
const FraudAbuseAnalyzer = require('../../src/services/ai/fraudAbuseAnalyzer.service');

function unitVector() {
  const v = new Array(3072).fill(0);
  v[0] = 1;
  return v;
}

function finSims(overrides = {}) {
  return {
    transferMethods: 0.2,
    scamIndicators: 0.2,
    urgencyLanguage: 0.2,
    helpRequests: 0.2,
    relationshipMoney: 0.2,
    ...overrides,
  };
}

function resetEmbeddingServiceState() {
  embeddingAnchorService.ready = false;
  embeddingAnchorService.initPromise = null;
  embeddingAnchorService.abuseVectors = { physical: {}, emotional: {}, neglect: {} };
  embeddingAnchorService.financialVectors = {};
  embeddingAnchorService._abuseAllNorms = [];
  embeddingAnchorService._financialTemporalNorms = [];
}

function abuseSims(overrides = {}) {
  const base = {
    physical: {
      injuries: 0.2,
      inconsistentExplanations: 0.2,
      fearOfPerson: 0.2,
      punishment: 0.2,
    },
    emotional: {
      isolation: 0.2,
      control: 0.2,
      threats: 0.2,
      belittling: 0.2,
      fearLanguage: 0.2,
    },
    neglect: {
      basicNeeds: 0.2,
      medicalCare: 0.2,
      isolation: 0.2,
      timeAlone: 0.2,
    },
  };
  return { ...base, ...overrides, physical: { ...base.physical, ...(overrides.physical || {}) }, emotional: { ...base.emotional, ...(overrides.emotional || {}) }, neglect: { ...base.neglect, ...(overrides.neglect || {}) } };
}

describe('Financial Exploitation Detector', () => {
  let detector;

  beforeEach(() => {
    resetEmbeddingServiceState();
    detector = new FinancialExploitationDetector();
    jest.spyOn(embeddingAnchorService, 'ensureInitialized').mockResolvedValue();
    jest.spyOn(embeddingAnchorService, 'embedQuery').mockResolvedValue(unitVector());
    jest.spyOn(embeddingAnchorService, 'embedQueries').mockResolvedValue([unitVector(), unitVector(), unitVector()]);
    jest.spyOn(embeddingAnchorService, 'hasFinancialEmbeddings').mockReturnValue(true);
    jest.spyOn(embeddingAnchorService, 'maxSimilarityFinancialTemporal').mockReturnValue(0.5);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('detectFinancialExploitation', () => {
    it('should detect large money amounts via regex without embeddings', async () => {
      jest.spyOn(embeddingAnchorService, 'embedQuery').mockResolvedValue(null);
      const messages = ['I need to send ten thousand dollars to someone'];
      const result = await detector.detectFinancialExploitation(messages, messages.join(' '));

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.largeAmountMentions).toBeGreaterThan(0);
    });

    it('should not count transfer methods without corroborating financial signal', async () => {
      jest.spyOn(embeddingAnchorService, 'getFinancialBucketSimilarities').mockReturnValue(
        finSims({ transferMethods: 0.95, scamIndicators: 0.1, relationshipMoney: 0.1 })
      );
      const messages = ['I sent money through Western Union'];
      const result = await detector.detectFinancialExploitation(messages, messages.join(' '));

      expect(result.transferMethodMentions).toBe(0);
    });

    it('should count transfer methods when scam signal corroborates', async () => {
      jest.spyOn(embeddingAnchorService, 'getFinancialBucketSimilarities').mockReturnValue(
        finSims({ transferMethods: 0.9, scamIndicators: 0.85 })
      );
      const messages = ['Western Union wire transfer'];
      const result = await detector.detectFinancialExploitation(messages, messages.join(' '));

      expect(result.transferMethodMentions).toBeGreaterThan(0);
      expect(result.scamIndicatorMentions).toBeGreaterThan(0);
    });

    it('should detect scam indicators from embeddings', async () => {
      jest.spyOn(embeddingAnchorService, 'getFinancialBucketSimilarities').mockReturnValue(
        finSims({ scamIndicators: 0.9 })
      );
      const messages = ['Prize lottery IRS call'];
      const result = await detector.detectFinancialExploitation(messages, messages.join(' '));

      expect(result.scamIndicatorMentions).toBeGreaterThan(0);
    });

    it('should detect urgency only with corroboration', async () => {
      jest
        .spyOn(embeddingAnchorService, 'getFinancialBucketSimilarities')
        .mockReturnValue(finSims({ urgencyLanguage: 0.9, scamIndicators: 0.85 }));
      const messages = ['Urgent secret payment'];
      const result = await detector.detectFinancialExploitation(messages, messages.join(' '));

      expect(result.urgencyMentions).toBeGreaterThan(0);
    });

    it('should not count urgency without corroboration', async () => {
      jest
        .spyOn(embeddingAnchorService, 'getFinancialBucketSimilarities')
        .mockReturnValue(finSims({ urgencyLanguage: 0.9, scamIndicators: 0.1, relationshipMoney: 0.1 }));
      const messages = ['urgent'];
      const result = await detector.detectFinancialExploitation(messages, messages.join(' '));

      expect(result.urgencyMentions).toBe(0);
    });

    it('should analyze temporal patterns when embeddings rise over messages', async () => {
      jest.spyOn(embeddingAnchorService, 'getFinancialBucketSimilarities').mockReturnValue(finSims({ scamIndicators: 0.85 }));
      let n = 0;
      jest.spyOn(embeddingAnchorService, 'maxSimilarityFinancialTemporal').mockImplementation(() => {
        n += 1;
        return n <= 2 ? 0.2 : 0.9;
      });
      const messages = ['a', 'b', 'c', 'd', 'e'];
      const result = await detector.detectFinancialExploitation(messages, messages.join(' '));

      expect(result.temporalPatterns).toBeDefined();
      expect(result.temporalPatterns.trend).toBeDefined();
    });

    it('should return default metrics for empty input', async () => {
      const result = await detector.detectFinancialExploitation([], '');

      expect(result.riskScore).toBe(0);
      expect(result.confidence).toBe('none');
    });
  });
});

describe('Abuse Neglect Detector', () => {
  let detector;

  beforeEach(() => {
    resetEmbeddingServiceState();
    detector = new AbuseNeglectDetector();
    jest.spyOn(embeddingAnchorService, 'ensureInitialized').mockResolvedValue();
    jest.spyOn(embeddingAnchorService, 'embedQuery').mockResolvedValue(unitVector());
    jest.spyOn(embeddingAnchorService, 'embedQueries').mockImplementation((texts) => texts.map(() => unitVector()));
    jest.spyOn(embeddingAnchorService, 'hasAbuseEmbeddings').mockReturnValue(true);
    jest.spyOn(embeddingAnchorService, 'maxSimilarityToAllAbuseAnchors').mockReturnValue(0.5);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('detectAbuseNeglect', () => {
    it('should detect physical abuse indicators from embeddings', async () => {
      jest.spyOn(embeddingAnchorService, 'getAbuseBucketSimilarities').mockReturnValue(
        abuseSims({ physical: { injuries: 0.9, inconsistentExplanations: 0.2, fearOfPerson: 0.2, punishment: 0.2 } })
      );
      const messages = ['Someone hurt me'];
      const result = await detector.detectAbuseNeglect(messages, messages.join(' '));

      expect(result.physicalAbuseScore).toBeGreaterThan(0);
      expect(result.injuryMentions).toBeGreaterThan(0);
    });

    it('should detect emotional abuse indicators', async () => {
      jest.spyOn(embeddingAnchorService, 'getAbuseBucketSimilarities').mockReturnValue(
        abuseSims({ emotional: { isolation: 0.9, control: 0.2, threats: 0.2, belittling: 0.2, fearLanguage: 0.2 } })
      );
      const messages = ['not allowed to talk'];
      const result = await detector.detectAbuseNeglect(messages, messages.join(' '));

      expect(result.emotionalAbuseScore).toBeGreaterThan(0);
      expect(result.isolationMentions).toBeGreaterThan(0);
    });

    it('should detect neglect basic needs with strict threshold', async () => {
      jest.spyOn(embeddingAnchorService, 'getAbuseBucketSimilarities').mockReturnValue(
        abuseSims({ neglect: { basicNeeds: 0.75, medicalCare: 0.2, isolation: 0.2, timeAlone: 0.2 } })
      );
      const messages = ['hungry'];
      const result = await detector.detectAbuseNeglect(messages, messages.join(' '));

      expect(result.basicNeedsMentions).toBe(0);
      expect(result.neglectScore).toBe(0);
    });

    it('should detect neglect basic needs above strict threshold', async () => {
      jest.spyOn(embeddingAnchorService, 'getAbuseBucketSimilarities').mockReturnValue(
        abuseSims({
          neglect: { basicNeeds: 0.9, medicalCare: 0.2, isolation: 0.2, timeAlone: 0.2 },
        })
      );
      const messages = ['no food no help'];
      const result = await detector.detectAbuseNeglect(messages, messages.join(' '));

      expect(result.neglectScore).toBeGreaterThan(0);
      expect(result.basicNeedsMentions).toBeGreaterThan(0);
    });

    it('should detect fear language', async () => {
      jest.spyOn(embeddingAnchorService, 'getAbuseBucketSimilarities').mockReturnValue(
        abuseSims({
          emotional: { isolation: 0.2, control: 0.2, threats: 0.2, belittling: 0.2, fearLanguage: 0.9 },
        })
      );
      const messages = ['walking on eggshells'];
      const result = await detector.detectAbuseNeglect(messages, messages.join(' '));

      expect(result.fearMentions).toBeGreaterThan(0);
    });

    it('should detect inconsistent injury explanations when injury signal present', async () => {
      jest.spyOn(embeddingAnchorService, 'getAbuseBucketSimilarities').mockReturnValue(
        abuseSims({
          physical: { injuries: 0.85, inconsistentExplanations: 0.85, fearOfPerson: 0.2, punishment: 0.2 },
        })
      );
      const messages = ['injury'];
      const result = await detector.detectAbuseNeglect(messages, messages.join(' '));

      expect(result.physicalAbuseScore).toBeGreaterThan(0);
    });

    it('should return default metrics for empty input', async () => {
      const result = await detector.detectAbuseNeglect([], '');

      expect(result.riskScore).toBe(0);
      expect(result.confidence).toBe('none');
    });

    it('should return default when no query embedding', async () => {
      jest.spyOn(embeddingAnchorService, 'embedQuery').mockResolvedValue(null);
      const result = await detector.detectAbuseNeglect(['x'], 'x');
      expect(result.riskScore).toBe(0);
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
      const conversations = [
        {
          _id: new mongoose.Types.ObjectId(),
          messages: [
            {
              role: 'client',
              content: 'I met someone new online',
              createdAt: new Date(),
            },
          ],
          createdAt: new Date(),
        },
      ];

      const result = await analyzer.analyzeRelationshipPatterns(conversations);

      expect(result.newPeopleCount).toBeGreaterThan(0);
    });

    it('should detect isolation patterns', async () => {
      const mongoose = require('mongoose');
      const conversations = [
        {
          _id: new mongoose.Types.ObjectId(),
          messages: [
            {
              role: 'client',
              content: 'I am not allowed to talk to my friends',
              createdAt: new Date(),
            },
          ],
          createdAt: new Date(),
        },
      ];

      const result = await analyzer.analyzeRelationshipPatterns(conversations);

      expect(result.isolationCount).toBeGreaterThan(0);
    });

    it('should detect control patterns', async () => {
      const mongoose = require('mongoose');
      const conversations = [
        {
          _id: new mongoose.Types.ObjectId(),
          messages: [
            {
              role: 'client',
              content:
                "They tell me what to do. They make decisions for me. They won't let me do anything. I have to ask permission for everything.",
              createdAt: new Date(),
            },
          ],
          createdAt: new Date(),
        },
      ];

      const result = await analyzer.analyzeRelationshipPatterns(conversations);

      expect(result.controlCount).toBeGreaterThan(0);
    });

    it('should detect suspicious behavior', async () => {
      const mongoose = require('mongoose');
      const conversations = [
        {
          _id: new mongoose.Types.ObjectId(),
          messages: [
            {
              role: 'client',
              content: 'This new person I met asks for money',
              createdAt: new Date(),
            },
          ],
          createdAt: new Date(),
        },
      ];

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

const mockFinancialHigh = {
  riskScore: 55,
  confidence: 'high',
  indicators: [{ type: 'scam_indicators', severity: 'high', message: 'test' }],
  largeAmountMentions: 2,
  transferMethodMentions: 1,
  scamIndicatorMentions: 2,
  urgencyMentions: 1,
  helpRequestMentions: 0,
  relationshipMoneyMentions: 1,
  temporalPatterns: { hasEscalation: true, trend: 'increasing', recentAverage: 1, earlierAverage: 0.2 },
  flaggedPhrases: ['scam'],
};

const mockAbuseHigh = {
  riskScore: 48,
  confidence: 'medium',
  indicators: [],
  physicalAbuseScore: 45,
  emotionalAbuseScore: 42,
  neglectScore: 38,
  injuryMentions: 2,
  isolationMentions: 2,
  fearMentions: 2,
  basicNeedsMentions: 1,
  temporalPatterns: { hasEscalation: true, trend: 'increasing', recentAverage: 1, earlierAverage: 0.2 },
  flaggedPhrases: [],
};

/** FraudAbuseAnalyzer skips analysis when combined patient text is < 100 chars */
const PAD = ' Additional client context for analysis threshold. '.repeat(4);

const mockRelationshipHigh = {
  riskScore: 38,
  confidence: 'medium',
  indicators: [],
  newPeopleCount: 2,
  isolationCount: 3,
  controlCount: 1,
  dependencyCount: 0,
  suspiciousBehaviorCount: 1,
  temporalChanges: { hasChanges: true, trend: 'increasing' },
  flaggedPeople: [],
  relationshipTimeline: [],
};

describe('Fraud Abuse Analyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new FraudAbuseAnalyzer();
    analyzer.financialDetector.detectFinancialExploitation = jest
      .fn()
      .mockResolvedValue({ ...mockFinancialHigh });
    analyzer.abuseDetector.detectAbuseNeglect = jest.fn().mockResolvedValue({ ...mockAbuseHigh });
    analyzer.relationshipAnalyzer.analyzeRelationshipPatterns = jest
      .fn()
      .mockResolvedValue({ ...mockRelationshipHigh });
  });

  describe('analyzeConversations', () => {
    it('should analyze financial exploitation', async () => {
      const mongoose = require('mongoose');
      const conversations = [
        {
          _id: new mongoose.Types.ObjectId(),
          messages: [
            {
              role: 'client',
              content:
                'I sent five thousand dollars through Western Union. IRS prize urgent. Do not tell anyone.' +
                PAD,
              createdAt: new Date(),
            },
          ],
          createdAt: new Date(),
        },
      ];

      const result = await analyzer.analyzeConversations(conversations);

      expect(result.financialRisk.riskScore).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(0);
    });

    it('should analyze abuse patterns', async () => {
      const mongoose = require('mongoose');
      const conversations = [
        {
          _id: new mongoose.Types.ObjectId(),
          messages: [
            {
              role: 'client',
              content: 'Someone hit me. I am scared. No food.' + PAD,
              createdAt: new Date(),
            },
          ],
          createdAt: new Date(),
        },
      ];

      const result = await analyzer.analyzeConversations(conversations);

      expect(result.abuseRisk.riskScore).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(0);
    });

    it('should generate warnings for high risk', async () => {
      const mongoose = require('mongoose');
      const conversations = [
        {
          _id: new mongoose.Types.ObjectId(),
          messages: [
            {
              role: 'client',
              content:
                'Prize lottery ten thousand Western Union gift cards urgent secret IRS',
              createdAt: new Date(),
            },
          ],
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          messages: [
            {
              role: 'client',
              content: 'More money Western Union verify',
              createdAt: new Date(),
            },
          ],
          createdAt: new Date(),
        },
      ];

      const result = await analyzer.analyzeConversations(conversations);

      expect(result.warnings.length + result.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate overall risk score from multiple indicators', async () => {
      const mongoose = require('mongoose');
      const conversations = [
        {
          _id: new mongoose.Types.ObjectId(),
          messages: [
            {
              role: 'client',
              content: 'New friend money isolation hungry' + PAD,
              createdAt: new Date(),
            },
            {
              role: 'client',
              content: 'Western Union scam' + PAD,
              createdAt: new Date(),
            },
            {
              role: 'client',
              content: 'Abuse neglect alone' + PAD,
              createdAt: new Date(),
            },
          ],
          createdAt: new Date(),
        },
      ];

      const result = await analyzer.analyzeConversations(conversations);

      expect(result.overallRiskScore).toBeGreaterThan(0);
      expect(result.financialRisk.riskScore).toBeGreaterThan(0);
      expect(result.abuseRisk.riskScore).toBeGreaterThan(0);
      expect(result.relationshipRisk.riskScore).toBeGreaterThan(0);
    });

    it('should return default metrics for insufficient data', async () => {
      const mongoose = require('mongoose');
      const conversations = [
        {
          _id: new mongoose.Types.ObjectId(),
          messages: [
            {
              role: 'client',
              content: 'Hi',
              createdAt: new Date(),
            },
          ],
          createdAt: new Date(),
        },
      ];

      const result = await analyzer.analyzeConversations(conversations);

      expect(result.warnings).toContain('Insufficient conversation data for analysis (< 100 characters)');
      expect(result.confidence).toBe('low');
    });
  });
});
