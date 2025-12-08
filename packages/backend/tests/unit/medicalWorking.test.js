// tests/unit/medicalWorking.test.js
const MedicalPatternAnalyzer = require('../../src/services/ai/medicalPatternAnalyzer.service');

describe('Medical Analysis Working Tests', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new MedicalPatternAnalyzer();
  });

  describe('Basic Medical Analysis', () => {
    it('should analyze patient conversations with sufficient data', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I have been feeling very sad and depressed lately. I cannot concentrate on anything and I feel hopeless about the future. I have trouble sleeping and I wake up feeling exhausted every day.' }
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
      expect(result.messageCount).toBe(1);
      expect(result.totalWords).toBeGreaterThan(0);
    });

    it('should detect depression markers', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel very sad and depressed. I have no energy and I cannot sleep. I feel worthless and hopeless about everything. I do not want to see anyone and I just want to stay in bed all day.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.psychiatricMetrics.depressionScore).toBeGreaterThan(0);
      expect(result.psychiatricMetrics.overallRiskScore).toBeGreaterThan(0);
      expect(result.psychiatricMetrics.indicators).toBeInstanceOf(Array);
      expect(result.psychiatricMetrics.detailedAnalysis.depression.negativeEmotions.count).toBeGreaterThan(0);
    });

    it('should detect anxiety markers', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I worry about everything constantly. My heart races and I feel tense all the time. I cannot stop thinking about all the things that could go wrong. I had a panic attack yesterday and I thought I was going to die. I am always on edge and I cannot relax.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.psychiatricMetrics.anxietyScore).toBeGreaterThanOrEqual(0);
      expect(result.psychiatricMetrics.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(result.psychiatricMetrics.detailedAnalysis.anxiety).toBeDefined();
      expect(result.psychiatricMetrics.detailedAnalysis.anxiety.catastrophicThinking.count).toBeGreaterThan(0);
      expect(result.psychiatricMetrics.detailedAnalysis.anxiety.hypervigilance.count).toBeGreaterThan(0);
    });

    it('should detect cognitive decline indicators', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I um... I think... the thing is... you know what I mean? I forget what I was going to say. I need the thing... you know, the thing you use to... I cannot think of the word for it.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.cognitiveMetrics.riskScore).toBeGreaterThan(0);
      expect(result.cognitiveMetrics.fillerWordDensity).toBeGreaterThan(0);
      expect(result.cognitiveMetrics.vagueReferenceDensity).toBeGreaterThan(0);
      expect(result.cognitiveMetrics.detailedAnalysis.fillerWords.count).toBeGreaterThan(0);
      expect(result.cognitiveMetrics.detailedAnalysis.vagueReferences.count).toBeGreaterThan(0);
    });
  });

  describe('Progressive Decline Scenarios', () => {
    it('should detect cognitive decline progression', async () => {
      // Month 1: Normal function
      const month1Conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'Good morning! I hope you are having a wonderful day. I wanted to discuss my medication schedule with you today. I take my blood pressure medication every morning at 8 AM, and I have been very consistent with it. I feel good and I have energy. I am managing my health well and everything is going smoothly.' }
          ]
        }
      ];

      // Month 6: Cognitive decline
      const month6Conversations = [
        {
          _id: 'conv2',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'Help me... please help me. I do not know where I am or what is happening. I am... I am at home, I think. But I do not remember how I got here. I feel confused and afraid. I cannot think clearly and I keep forgetting things. The thing is... you know what I mean?' }
          ]
        }
      ];

      const month1Result = await analyzer.analyzeMonth(month1Conversations);
      const month6Result = await analyzer.analyzeMonth(month6Conversations);

      // Both should have cognitive analysis
      expect(month1Result.cognitiveMetrics.riskScore).toBeGreaterThanOrEqual(0);
      expect(month6Result.cognitiveMetrics.riskScore).toBeGreaterThanOrEqual(0);
      
      // Month 6 should show more cognitive decline indicators overall
      expect(month6Result.cognitiveMetrics.vagueReferenceDensity).toBeGreaterThan(month1Result.cognitiveMetrics.vagueReferenceDensity);
    });

    it('should detect psychiatric decline progression', async () => {
      // Month 1: Mild symptoms
      const month1Conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'Hi, I wanted to talk about how I have been feeling lately. I have been having some ups and downs. Some days I feel okay, but other days I feel really down. I have been having trouble sleeping and I worry a lot about work. I am managing okay though.' }
          ]
        }
      ];

      // Month 6: Severe symptoms
      const month6Conversations = [
        {
          _id: 'conv2',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I do not know why I keep trying. Nothing ever gets better. I cannot function anymore. I cannot work, I cannot take care of myself, I cannot even get out of bed most days. I just want the pain to stop. I feel worthless and hopeless about everything.' }
          ]
        }
      ];

      const month1Result = await analyzer.analyzeMonth(month1Conversations);
      const month6Result = await analyzer.analyzeMonth(month6Conversations);

      expect(month6Result.psychiatricMetrics.depressionScore).toBeGreaterThan(month1Result.psychiatricMetrics.depressionScore);
      expect(month6Result.psychiatricMetrics.overallRiskScore).toBeGreaterThan(month1Result.psychiatricMetrics.overallRiskScore);
    });
  });

  describe('Vocabulary Analysis', () => {
    it('should analyze vocabulary complexity', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I have been experiencing significant difficulties with my cognitive functioning and overall mental well-being. The complexity of my current situation requires careful consideration and professional intervention.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.vocabularyMetrics.totalWords).toBeGreaterThan(0);
      expect(result.vocabularyMetrics.uniqueWords).toBeGreaterThan(0);
      expect(result.vocabularyMetrics.typeTokenRatio).toBeGreaterThan(0);
      expect(result.vocabularyMetrics.typeTokenRatio).toBeLessThanOrEqual(1);
      expect(result.vocabularyMetrics.avgWordLength).toBeGreaterThan(0);
      expect(result.vocabularyMetrics.avgSentenceLength).toBeGreaterThan(0);
      expect(result.vocabularyMetrics.complexityScore).toBeGreaterThan(0);
      expect(result.vocabularyMetrics.complexityScore).toBeLessThanOrEqual(100);
      expect(result.vocabularyMetrics.sentenceCount).toBeGreaterThan(0);
    });

    it('should detect vocabulary decline', async () => {
      // Complex vocabulary
      const complexConversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I have been experiencing significant difficulties with my cognitive functioning and overall mental well-being. The complexity of my current situation requires careful consideration and professional intervention.' }
          ]
        }
      ];

      // Simple vocabulary
      const simpleConversations = [
        {
          _id: 'conv2',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel bad. I cannot think. I am confused. Everything is hard. I do not know what to do. I am lost and scared.' }
          ]
        }
      ];

      const complexResult = await analyzer.analyzeMonth(complexConversations);
      const simpleResult = await analyzer.analyzeMonth(simpleConversations);

      expect(complexResult.vocabularyMetrics.complexityScore).toBeGreaterThan(simpleResult.vocabularyMetrics.complexityScore);
      expect(complexResult.vocabularyMetrics.avgSentenceLength).toBeGreaterThan(simpleResult.vocabularyMetrics.avgSentenceLength);
      expect(complexResult.vocabularyMetrics.typeTokenRatio).toBeGreaterThan(simpleResult.vocabularyMetrics.typeTokenRatio);
    });
  });

  describe('Crisis Detection', () => {
    it('should detect crisis indicators', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I do not want to be here anymore. I think about ending my life every day. I have a plan and I am ready to do it. Everyone would be better off without me. There is no point in anything anymore.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.psychiatricMetrics.crisisIndicators).toBeDefined();
      expect(result.psychiatricMetrics.crisisIndicators.hasCrisisIndicators).toBeDefined();
      expect(result.psychiatricMetrics.crisisIndicators.crisisCount).toBeDefined();
      expect(result.psychiatricMetrics.overallRiskScore).toBeGreaterThan(0);
    });
  });

  describe('Baseline Comparison', () => {
    it('should compare with baseline analysis', async () => {
      // Baseline
      const baselineConversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I am doing well today. I feel good and I have energy. I am managing my medications properly and I feel stable.' }
          ]
        }
      ];

      // Current with decline
      const currentConversations = [
        {
          _id: 'conv2',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel confused and I cannot remember things. I am worried about my memory. I keep forgetting to take my medications and I feel lost.' }
          ]
        }
      ];

      const baselineAnalysis = await analyzer.analyzeMonth(baselineConversations);
      const currentAnalysis = await analyzer.analyzeMonth(currentConversations, baselineAnalysis);

      expect(currentAnalysis.changeFromBaseline).toBeDefined();
      expect(currentAnalysis.changeFromBaseline.cognitive).toBeDefined();
      expect(currentAnalysis.changeFromBaseline.psychiatric).toBeDefined();
      expect(currentAnalysis.changeFromBaseline.vocabulary).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle mixed languages', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel muy triste today. Estoy muy depressed. Je suis très anxious. I am very worried about everything.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.vocabularyMetrics).toBeDefined();
    });

    it('should handle special characters', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel @#$% confused today! Everything is &*()%$#@! messed up. I do not know what to do anymore. I am very worried and scared about everything that is happening to me.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.vocabularyMetrics).toBeDefined();
    });

    it('should handle very long messages', async () => {
      const longMessage = 'I feel very sad and depressed and anxious and worried and confused and lost and hopeless and worthless and alone and isolated and scared and frightened and terrified and panicked and overwhelmed and exhausted and tired and fatigued and drained and empty and numb and disconnected and dissociated and derealized and depersonalized.';

      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: longMessage }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.totalWords).toBeGreaterThan(50);
      expect(result.vocabularyMetrics.totalWords).toBeGreaterThan(50);
    });

    it('should handle minimal data gracefully', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'Hi' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.warnings).toContain('Insufficient conversation data for analysis (< 100 characters)');
      expect(result.confidence).toBe('low');
    });
  });

  describe('Data Validation', () => {
    it('should return valid data structure', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I have been feeling very sad and depressed lately. I cannot concentrate on anything and I feel hopeless about the future.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      // Validate cognitive metrics
      expect(result.cognitiveMetrics.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.cognitiveMetrics.riskScore).toBeLessThanOrEqual(100);
      expect(result.cognitiveMetrics.confidence).toBeDefined();
      expect(result.cognitiveMetrics.indicators).toBeInstanceOf(Array);
      expect(result.cognitiveMetrics.timestamp).toBeInstanceOf(Date);

      // Validate psychiatric metrics
      expect(result.psychiatricMetrics.depressionScore).toBeGreaterThanOrEqual(0);
      expect(result.psychiatricMetrics.depressionScore).toBeLessThanOrEqual(100);
      expect(result.psychiatricMetrics.anxietyScore).toBeGreaterThanOrEqual(0);
      expect(result.psychiatricMetrics.anxietyScore).toBeLessThanOrEqual(100);
      expect(result.psychiatricMetrics.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(result.psychiatricMetrics.overallRiskScore).toBeLessThanOrEqual(100);
      expect(result.psychiatricMetrics.indicators).toBeInstanceOf(Array);

      // Validate vocabulary metrics
      expect(result.vocabularyMetrics.totalWords).toBeGreaterThanOrEqual(0);
      expect(result.vocabularyMetrics.uniqueWords).toBeGreaterThanOrEqual(0);
      expect(result.vocabularyMetrics.typeTokenRatio).toBeGreaterThanOrEqual(0);
      expect(result.vocabularyMetrics.typeTokenRatio).toBeLessThanOrEqual(1);
      expect(result.vocabularyMetrics.complexityScore).toBeGreaterThanOrEqual(0);
      expect(result.vocabularyMetrics.complexityScore).toBeLessThanOrEqual(100);

      // Validate overall structure
      expect(result.warnings).toBeInstanceOf(Array);
      expect(['low', 'medium', 'high', 'none']).toContain(result.confidence);
      expect(result.analysisDate).toBeInstanceOf(Date);
      expect(result.conversationCount).toBeGreaterThanOrEqual(0);
      expect(result.messageCount).toBeGreaterThanOrEqual(0);
      expect(result.totalWords).toBeGreaterThanOrEqual(0);
    });
  });
});
