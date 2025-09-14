// tests/unit/medicalAnalysis.test.js
const MedicalPatternAnalyzer = require('../../src/services/ai/medicalPatternAnalyzer.service');

describe('Medical Analysis Tests', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new MedicalPatternAnalyzer();
  });

  describe('Cognitive Decline Detection', () => {
    it('should detect cognitive decline indicators in patient conversations', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I um... I think... the thing is... you know what I mean? I forget what I was going to say.' },
            { role: 'patient', content: 'I keep forgetting things and I am so tired all the time. I cannot concentrate on anything.' },
            { role: 'patient', content: 'I need the thing... you know, the thing you use to... I cannot think of the word for it.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.cognitiveMetrics.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.cognitiveMetrics.riskScore).toBeLessThanOrEqual(100);
      expect(result.cognitiveMetrics.confidence).toBeDefined();
      expect(result.cognitiveMetrics.indicators).toBeInstanceOf(Array);
    });

    it('should detect memory-related language patterns', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I forgot what I was going to say. I cannot remember where I put my keys.' },
            { role: 'patient', content: 'I do not recall what happened yesterday. I keep forgetting important things.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.cognitiveMetrics.indicators).toBeInstanceOf(Array);
      expect(result.cognitiveMetrics.riskScore).toBeGreaterThan(0);
    });

    it('should detect word-finding difficulties', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I need the thing... you know, the thing you use to...' },
            { role: 'patient', content: 'I cannot think of the word for it. What do you call that thing that...' },
            { role: 'patient', content: 'I know what I want to say but I cannot find the words.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.cognitiveMetrics.indicators).toBeInstanceOf(Array);
      expect(result.cognitiveMetrics.riskScore).toBeGreaterThan(0);
    });
  });

  describe('Psychiatric Decline Detection', () => {
    it('should detect depression markers in patient conversations', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I have been feeling very sad and depressed lately. I cannot concentrate on anything.' },
            { role: 'patient', content: 'I feel hopeless about the future and I do not see any point in continuing.' },
            { role: 'patient', content: 'I feel worthless and like a burden to everyone around me.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.psychiatricMetrics.depressionScore).toBeGreaterThanOrEqual(0);
      expect(result.psychiatricMetrics.depressionScore).toBeLessThanOrEqual(100);
      expect(result.psychiatricMetrics.anxietyScore).toBeGreaterThanOrEqual(0);
      expect(result.psychiatricMetrics.anxietyScore).toBeLessThanOrEqual(100);
      expect(result.psychiatricMetrics.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(result.psychiatricMetrics.overallRiskScore).toBeLessThanOrEqual(100);
      expect(result.psychiatricMetrics.indicators).toBeInstanceOf(Array);
    });

    it('should detect anxiety markers in patient conversations', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I worry about everything constantly. I cannot stop thinking about all the things that could go wrong.' },
            { role: 'patient', content: 'My heart races and I feel tense all the time. I am always on edge.' },
            { role: 'patient', content: 'I had a panic attack yesterday. I thought I was going to die.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.psychiatricMetrics.anxietyScore).toBeGreaterThan(0);
      expect(result.psychiatricMetrics.overallRiskScore).toBeGreaterThan(0);
    });

    it('should detect crisis indicators in patient conversations', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I do not want to be here anymore. I think about ending my life every day.' },
            { role: 'patient', content: 'I have a plan and I am ready to do it. Everyone would be better off without me.' },
            { role: 'patient', content: 'There is no point in anything anymore. I cannot take this pain anymore.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.psychiatricMetrics.crisisIndicators).toBeDefined();
      expect(result.psychiatricMetrics.crisisIndicators.hasCrisisIndicators).toBeDefined();
      expect(result.psychiatricMetrics.overallRiskScore).toBeGreaterThan(70);
    });
  });

  describe('Vocabulary Analysis', () => {
    it('should analyze vocabulary complexity in patient conversations', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I have been experiencing significant difficulties with my cognitive functioning and overall mental well-being.' },
            { role: 'patient', content: 'The complexity of my current situation requires careful consideration and professional intervention.' },
            { role: 'patient', content: 'I am seeking comprehensive assessment and treatment for my psychological symptoms.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.vocabularyMetrics).toBeDefined();
      expect(result.vocabularyMetrics.totalWords).toBeGreaterThan(0);
      expect(result.vocabularyMetrics.uniqueWords).toBeGreaterThan(0);
      expect(result.vocabularyMetrics.typeTokenRatio).toBeGreaterThanOrEqual(0);
      expect(result.vocabularyMetrics.typeTokenRatio).toBeLessThanOrEqual(1);
      expect(result.vocabularyMetrics.avgWordLength).toBeGreaterThan(0);
      expect(result.vocabularyMetrics.avgSentenceLength).toBeGreaterThan(0);
      expect(result.vocabularyMetrics.complexityScore).toBeGreaterThanOrEqual(0);
      expect(result.vocabularyMetrics.complexityScore).toBeLessThanOrEqual(100);
    });

    it('should detect vocabulary decline over time', async () => {
      // Month 1: Complex vocabulary
      const month1Conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I have been experiencing significant difficulties with my cognitive functioning and overall mental well-being.' }
          ]
        }
      ];

      // Month 6: Simplified vocabulary
      const month6Conversations = [
        {
          _id: 'conv2',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel bad. I cannot think. I am confused.' }
          ]
        }
      ];

      const month1Result = await analyzer.analyzeMonth(month1Conversations);
      const month6Result = await analyzer.analyzeMonth(month6Conversations);

      expect(month1Result).toBeDefined();
      expect(month6Result).toBeDefined();
      expect(month1Result.vocabularyMetrics.complexityScore).toBeGreaterThan(month6Result.vocabularyMetrics.complexityScore);
      expect(month1Result.vocabularyMetrics.avgSentenceLength).toBeGreaterThan(month6Result.vocabularyMetrics.avgSentenceLength);
    });
  });

  describe('Progressive Decline Scenarios', () => {
    it('should detect gradual cognitive decline over time', async () => {
      // Month 1: Normal cognitive function
      const month1Conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'Good morning! I hope you are having a wonderful day. I wanted to discuss my medication schedule with you today.' },
            { role: 'patient', content: 'I take my blood pressure medication every morning at 8 AM, and I have been very consistent with it.' }
          ]
        }
      ];

      // Month 3: Early cognitive changes
      const month3Conversations = [
        {
          _id: 'conv2',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'Hello, I am... I am not sure why I called today. Can you help me remember?' },
            { role: 'patient', content: 'I feel... um, I feel a bit confused today. I was supposed to do something important.' }
          ]
        }
      ];

      // Month 6: Significant cognitive decline
      const month6Conversations = [
        {
          _id: 'conv3',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'Help me... please help me. I do not know where I am or what is happening.' },
            { role: 'patient', content: 'I am... I am at home, I think. But I do not remember how I got here.' }
          ]
        }
      ];

      const month1Result = await analyzer.analyzeMonth(month1Conversations);
      const month3Result = await analyzer.analyzeMonth(month3Conversations);
      const month6Result = await analyzer.analyzeMonth(month6Conversations);

      expect(month1Result).toBeDefined();
      expect(month3Result).toBeDefined();
      expect(month6Result).toBeDefined();

      // Verify progressive decline
      expect(month3Result.cognitiveMetrics.riskScore).toBeGreaterThan(month1Result.cognitiveMetrics.riskScore);
      expect(month6Result.cognitiveMetrics.riskScore).toBeGreaterThan(month3Result.cognitiveMetrics.riskScore);
    });

    it('should detect gradual psychiatric decline over time', async () => {
      // Month 1: Mild psychiatric symptoms
      const month1Conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'Hi, I wanted to talk about how I have been feeling lately. I have been having some ups and downs.' },
            { role: 'patient', content: 'Some days I feel okay, but other days I feel really down. I have been having trouble sleeping.' }
          ]
        }
      ];

      // Month 3: Moderate psychiatric symptoms
      const month3Conversations = [
        {
          _id: 'conv2',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I do not want to be here anymore. I cannot take this pain anymore.' },
            { role: 'patient', content: 'I think about it all the time. I do not see any way out of this darkness.' }
          ]
        }
      ];

      // Month 6: Severe psychiatric symptoms
      const month6Conversations = [
        {
          _id: 'conv3',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I do not know why I keep trying. Nothing ever gets better.' },
            { role: 'patient', content: 'I cannot function anymore. I just want the pain to stop.' }
          ]
        }
      ];

      const month1Result = await analyzer.analyzeMonth(month1Conversations);
      const month3Result = await analyzer.analyzeMonth(month3Conversations);
      const month6Result = await analyzer.analyzeMonth(month6Conversations);

      expect(month1Result).toBeDefined();
      expect(month3Result).toBeDefined();
      expect(month6Result).toBeDefined();

      // Verify progressive psychiatric decline
      expect(month3Result.psychiatricMetrics.depressionScore).toBeGreaterThan(month1Result.psychiatricMetrics.depressionScore);
      expect(month6Result.psychiatricMetrics.depressionScore).toBeGreaterThan(month3Result.psychiatricMetrics.depressionScore);
      expect(month6Result.psychiatricMetrics.overallRiskScore).toBeGreaterThan(month1Result.psychiatricMetrics.overallRiskScore);
    });
  });

  describe('Baseline Comparison', () => {
    it('should compare current analysis with baseline', async () => {
      // Create baseline conversations
      const baselineConversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I am doing well today. I feel good and I have energy.' },
            { role: 'patient', content: 'I am managing my medications properly and I feel stable.' }
          ]
        }
      ];

      // Create current conversations with decline
      const currentConversations = [
        {
          _id: 'conv2',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel confused and I cannot remember things. I am worried about my memory.' },
            { role: 'patient', content: 'I keep forgetting to take my medications and I feel lost.' }
          ]
        }
      ];

      const baselineAnalysis = await analyzer.analyzeMonth(baselineConversations);
      const currentAnalysis = await analyzer.analyzeMonth(currentConversations, baselineAnalysis);

      expect(baselineAnalysis).toBeDefined();
      expect(currentAnalysis).toBeDefined();
      expect(currentAnalysis.changeFromBaseline).toBeDefined();
      expect(currentAnalysis.changeFromBaseline.cognitive).toBeDefined();
      expect(currentAnalysis.changeFromBaseline.psychiatric).toBeDefined();
      expect(currentAnalysis.changeFromBaseline.vocabulary).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle conversations with mixed languages', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel muy triste today. Estoy muy depressed.' },
            { role: 'patient', content: 'Je suis très anxious. I am very worried.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.vocabularyMetrics).toBeDefined();
    });

    it('should handle conversations with special characters', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel @#$% confused today!' },
            { role: 'patient', content: 'Everything is &*()%$#@! messed up.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.vocabularyMetrics).toBeDefined();
    });

    it('should handle conversations with very long messages', async () => {
      const longMessage = 'I feel very sad and depressed and anxious and worried and confused and lost and hopeless and worthless and alone and isolated and scared and frightened and terrified and panicked and overwhelmed and exhausted and tired and fatigued and drained and empty and numb and disconnected and dissociated and derealized and depersonalized and suicidal and homicidal and violent and aggressive and angry and frustrated and irritated and annoyed and agitated and restless and hyperactive and manic and euphoric and elated and grandiose and delusional and paranoid and suspicious and fearful and avoidant and withdrawn and isolated and lonely.';

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
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.vocabularyMetrics).toBeDefined();
      expect(result.totalWords).toBeGreaterThan(100);
    });
  });

  describe('Confidence and Reliability', () => {
    it('should provide appropriate confidence levels based on data quality', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I have been feeling very sad and depressed lately. I cannot concentrate on anything and I feel hopeless about the future. I have trouble sleeping and I wake up feeling exhausted every day. I do not have any energy to do the things I used to enjoy. I feel like I am a burden to everyone around me and I cannot see any point in continuing with my life. This has been going on for several months now and it is getting worse every day.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(['low', 'medium', 'high', 'none']).toContain(result.confidence);
      expect(result.conversationCount).toBe(1);
      expect(result.messageCount).toBe(1);
      expect(result.totalWords).toBeGreaterThan(50);
    });
  });
});
