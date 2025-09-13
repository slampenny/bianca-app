// tests/unit/medicalBasic.test.js
const MedicalPatternAnalyzer = require('../../src/services/ai/medicalPatternAnalyzer.service');

describe('Medical Analysis Basic Tests', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new MedicalPatternAnalyzer();
  });

  describe('Basic Medical Pattern Analyzer', () => {
    it('should create analyzer instance', () => {
      expect(analyzer).toBeDefined();
      expect(analyzer.config).toBeDefined();
      expect(analyzer.config.cognitiveDeclineThreshold).toBe(70);
      expect(analyzer.config.psychiatricAlertThreshold).toBe(75);
    });

    it('should handle empty conversations', async () => {
      const result = await analyzer.analyzeMonth([]);

      expect(result).toBeDefined();
      expect(result.warnings).toContain('Insufficient conversation data for analysis (< 100 characters)');
      expect(result.confidence).toBe('low');
    });

    it('should handle conversations with minimal data', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'Hello' },
            { role: 'patient', content: 'Goodbye' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.warnings).toContain('Insufficient conversation data for analysis (< 100 characters)');
      expect(result.confidence).toBe('low');
    });

    it('should analyze conversations with sufficient data', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I have been feeling very sad and depressed lately. I cannot concentrate on anything and I feel hopeless about the future.' },
            { role: 'patient', content: 'I have trouble sleeping and I wake up feeling exhausted every day. I do not have any energy to do the things I used to enjoy.' },
            { role: 'patient', content: 'I feel like I am a burden to everyone around me and I cannot see any point in continuing with my life.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.vocabularyMetrics).toBeDefined();
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.confidence).toBeDefined();
      expect(result.analysisDate).toBeInstanceOf(Date);
      expect(result.conversationCount).toBe(1);
      expect(result.messageCount).toBe(3);
      expect(result.totalWords).toBeGreaterThan(0);
    });

    it('should extract patient messages correctly', () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel sad today.' },
            { role: 'assistant', content: 'I understand you are feeling sad.' },
            { role: 'patient', content: 'I am also anxious.' }
          ]
        }
      ];

      const patientMessages = analyzer.extractPatientMessages(conversations);

      expect(patientMessages).toHaveLength(2);
      expect(patientMessages[0]).toBe('I feel sad today.');
      expect(patientMessages[1]).toBe('I am also anxious.');
    });

    it('should calculate confidence levels correctly', () => {
      // Test low confidence
      expect(analyzer.calculateConfidence(100, 1)).toBe('low');
      expect(analyzer.calculateConfidence(300, 2)).toBe('low');

      // Test medium confidence
      expect(analyzer.calculateConfidence(600, 5)).toBe('medium');
      expect(analyzer.calculateConfidence(1500, 8)).toBe('medium');

      // Test high confidence
      expect(analyzer.calculateConfidence(2500, 15)).toBe('high');
      expect(analyzer.calculateConfidence(5000, 20)).toBe('high');
    });

    it('should get default metrics', () => {
      const defaultMetrics = analyzer.getDefaultMetrics();

      expect(defaultMetrics).toBeDefined();
      expect(defaultMetrics.riskScore).toBe(0);
      expect(defaultMetrics.confidence).toBe('none');
      expect(defaultMetrics.indicators).toBeInstanceOf(Array);
      expect(defaultMetrics.timestamp).toBeInstanceOf(Date);
    });

    it('should update configuration', () => {
      const newConfig = {
        cognitiveDeclineThreshold: 80,
        psychiatricAlertThreshold: 85
      };

      analyzer.updateConfig(newConfig);

      expect(analyzer.config.cognitiveDeclineThreshold).toBe(80);
      expect(analyzer.config.psychiatricAlertThreshold).toBe(85);
      // Other config should remain unchanged
      expect(analyzer.config.vocabularyDiversityThreshold).toBe(0.2);
    });

    it('should get current configuration', () => {
      const config = analyzer.getConfig();

      expect(config).toBeDefined();
      expect(config.cognitiveDeclineThreshold).toBe(70);
      expect(config.psychiatricAlertThreshold).toBe(75);
      expect(config.vocabularyDiversityThreshold).toBe(0.2);
      expect(config.sentenceLengthThreshold).toBe(0.3);
      expect(config.baselineMonths).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle analysis errors gracefully', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel sad today.' }
          ]
        }
      ];

      // The analyzer should handle errors internally and return a result
      const result = await analyzer.analyzeMonth(conversations);
      
      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.confidence).toBeDefined();
    });
  });
});
