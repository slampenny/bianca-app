const { PsychiatricMarkerAnalyzer, analyzePsychiatricMarkers } = require('../../../src/services/ai/psychiatricMarkerAnalyzer.service');

describe('PsychiatricMarkerAnalyzer scoring formulas', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new PsychiatricMarkerAnalyzer();
  });

  describe('calculateDepressionScore / calculateAnxietyScore', () => {
    it('scales weighted depression score by 10 and clamps to 0–100', () => {
      expect(analyzer.calculateDepressionScore({ weightedScore: 4.2 })).toBe(42);
      expect(analyzer.calculateDepressionScore({ weightedScore: 0 })).toBe(0);
      expect(analyzer.calculateDepressionScore({ weightedScore: 15 })).toBe(100);
    });

    it('scales weighted anxiety score by 10 and clamps to 0–100', () => {
      expect(analyzer.calculateAnxietyScore({ weightedScore: 3.5 })).toBe(35);
      expect(analyzer.calculateAnxietyScore({ weightedScore: 0 })).toBe(0);
      expect(analyzer.calculateAnxietyScore({ weightedScore: 12 })).toBe(100);
    });
  });

  describe('calculateGeneralRiskScore / calculateOverallRiskScore', () => {
    it('scales general psychiatric weighted score by 15', () => {
      expect(analyzer.calculateGeneralRiskScore({ weightedScore: 2 })).toBe(30);
      expect(analyzer.calculateGeneralRiskScore({ weightedScore: 10 })).toBe(100);
    });

    it('combines depression, anxiety, and general risk with 30/30/40 weights', () => {
      const overall = analyzer.calculateOverallRiskScore(40, 30, 20);
      expect(overall).toBeCloseTo(29, 5);
    });
  });

  describe('analyzePsychiatricMarkers (patient text only)', () => {
    it('computes depression score from marker categories', () => {
      const text = 'I am sad and depressed. I feel hopeless and worthless.';
      const result = analyzePsychiatricMarkers(text, [text]);
      const depressionAnalysis = analyzer.analyzeDepressionMarkers(text.toLowerCase());
      const expected = analyzer.calculateDepressionScore(depressionAnalysis);
      expect(result.depressionScore).toBeCloseTo(expected, 2);
      expect(result.depressionScore).toBeGreaterThan(0);
    });

    it('computes anxiety score from marker categories', () => {
      const text = 'I am worried and anxious. My heart is racing and I cannot breathe.';
      const result = analyzePsychiatricMarkers(text, [text]);
      const anxietyAnalysis = analyzer.analyzeAnxietyMarkers(text.toLowerCase());
      const expected = analyzer.calculateAnxietyScore(anxietyAnalysis);
      expect(result.anxietyScore).toBe(expected);
      expect(result.anxietyScore).toBeGreaterThan(0);
    });

    it('computes generalRiskScore from self-harm and psychiatric markers', () => {
      const text = 'I want to hurt myself. People are watching me and talking about me.';
      const result = analyzePsychiatricMarkers(text, [text]);
      expect(result.generalRiskScore).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(0);
    });

    it('populates emotionalTone from patient messages', () => {
      const messages = [
        'I am sad and hopeless today.',
        'Everything is terrible and I feel worthless.',
      ];
      const text = messages.join(' ');
      const result = analyzePsychiatricMarkers(text, messages);
      expect(result.emotionalTone.dominantTone).toBe('negative');
      expect(result.emotionalTone.negativeRatio).toBeGreaterThan(0.5);
      expect(result.emotionalTone.totalWords).toBeGreaterThan(0);
    });

    it('counts protectiveFactors from coping and hope markers', () => {
      const text =
        'Therapy is helping me cope. I feel hopeful about the future and I have good support from family.';
      const result = analyzePsychiatricMarkers(text, [text]);
      expect(result.protectiveFactors).toBeGreaterThan(0);
      expect(result.detailedAnalysis.positive.score).toBe(result.protectiveFactors);
    });

    it('returns zeros for empty patient text', () => {
      const result = analyzePsychiatricMarkers('', []);
      expect(result.depressionScore).toBe(0);
      expect(result.anxietyScore).toBe(0);
      expect(result.generalRiskScore).toBe(0);
      expect(result.overallRiskScore).toBe(0);
    });
  });
});
