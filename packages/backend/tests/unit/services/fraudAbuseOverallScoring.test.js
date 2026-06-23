const FraudAbuseAnalyzer = require('../../../src/services/ai/fraudAbuseAnalyzer.service');
const { buildPatientConversations } = require('../../helpers/patientConversation.fixture');

describe('FraudAbuseAnalyzer overall risk scoring', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new FraudAbuseAnalyzer();
  });

  describe('calculateOverallRiskScore', () => {
    it('normalizes partial weights when only one category has risk', () => {
      const score = analyzer.calculateOverallRiskScore({
        financial: { riskScore: 50 },
        abuse: { riskScore: 0 },
        relationship: { riskScore: 0 },
      });
      expect(score).toBe(50);
    });

    it('applies 35/40/25 weights across all categories without high-risk bonus', () => {
      const score = analyzer.calculateOverallRiskScore({
        financial: { riskScore: 30 },
        abuse: { riskScore: 30 },
        relationship: { riskScore: 20 },
      });
      // Below per-category thresholds (40/40/30) — no +15 bonus
      expect(score).toBeCloseTo(27.5, 5);
    });

    it('adds +15 when two or more categories exceed thresholds', () => {
      const score = analyzer.calculateOverallRiskScore({
        financial: { riskScore: 40 },
        abuse: { riskScore: 50 },
        relationship: { riskScore: 20 },
      });
      // 40*0.35 + 50*0.40 + 20*0.25 = 39, +15 bonus
      expect(score).toBe(54);
    });

    it('adds +15 bonus on top of normalized two-category blend', () => {
      const score = analyzer.calculateOverallRiskScore({
        financial: { riskScore: 50 },
        abuse: { riskScore: 45 },
        relationship: { riskScore: 0 },
      });
      // (50*0.35 + 45*0.40) / 0.75 = 47.33… + 15
      expect(score).toBeCloseTo(62.33, 1);
    });

    it('caps combined score at 100', () => {
      const score = analyzer.calculateOverallRiskScore({
        financial: { riskScore: 100 },
        abuse: { riskScore: 100 },
        relationship: { riskScore: 100 },
      });
      expect(score).toBe(100);
    });
  });

  describe('analyzeConversations (keyword path, patient messages only)', () => {
    it('returns non-zero financial and overall scores for scam conversation text', async () => {
      const conversations = buildPatientConversations([
        'I won a prize and need to send ten thousand dollars through Western Union immediately. Do not tell anyone.',
      ]);
      const result = await analyzer.analyzeConversations(conversations);
      expect(result.financialRisk.riskScore).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(0);
    });

    it('returns non-zero abuse score for physical abuse conversation text', async () => {
      const conversations = buildPatientConversations([
        'Someone hit me and I have a bruise on my arm. I am afraid of them and they threatened me if I tell anyone. They said I deserved it because I did something wrong.',
      ]);
      const result = await analyzer.analyzeConversations(conversations);
      expect(result.abuseRisk.riskScore).toBeGreaterThan(0);
      expect(result.abuseRisk.physicalAbuseScore).toBeGreaterThan(0);
    });

    it('returns non-zero relationship score for isolation and control language', async () => {
      const conversations = buildPatientConversations([
        'I met someone new online. They tell me what to do and I am not allowed to talk to my friends.',
        'They asked for money and want me to send it. I feel isolated and alone.',
      ]);
      const result = await analyzer.analyzeConversations(conversations);
      expect(result.relationshipRisk.riskScore).toBeGreaterThan(0);
      expect(result.relationshipRisk.isolationCount).toBeGreaterThan(0);
    });
  });
});
