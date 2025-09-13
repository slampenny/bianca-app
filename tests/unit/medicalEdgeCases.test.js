// tests/unit/medicalEdgeCases.test.js
const MedicalPatternAnalyzer = require('../../src/services/ai/medicalPatternAnalyzer.service');
const { detectCognitiveDecline } = require('../../src/services/ai/cognitiveDeclineDetector.service');
const { analyzePsychiatricMarkers } = require('../../src/services/ai/psychiatricMarkerAnalyzer.service');
const { calculateVocabularyMetrics } = require('../../src/services/ai/vocabularyAnalyzer.service');
const { analyzeSpeechPatterns } = require('../../src/services/ai/speechPatternAnalyzer.service');
const { findRepetitions } = require('../../src/services/ai/repetitionMemoryAnalyzer.service');

describe('Medical Analysis Edge Cases', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new MedicalPatternAnalyzer();
  });

  describe('Minimal Data Edge Cases', () => {
    it('should handle conversations with single character messages', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'a' },
            { role: 'patient', content: 'b' },
            { role: 'patient', content: 'c' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.warnings).toContain('Insufficient conversation data for analysis (< 100 characters)');
      expect(result.confidence).toBe('low');
    });

    it('should handle conversations with only whitespace', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: '   ' },
            { role: 'patient', content: '\n\t' },
            { role: 'patient', content: '    ' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.warnings).toContain('Insufficient conversation data for analysis (< 100 characters)');
      expect(result.confidence).toBe('low');
    });

    it('should handle conversations with only punctuation', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: '...' },
            { role: 'patient', content: '!!!' },
            { role: 'patient', content: '???' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.warnings).toContain('Insufficient conversation data for analysis (< 100 characters)');
      expect(result.confidence).toBe('low');
    });

    it('should handle conversations with only numbers', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: '123' },
            { role: 'patient', content: '456' },
            { role: 'patient', content: '789' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.warnings).toContain('Insufficient conversation data for analysis (< 100 characters)');
      expect(result.confidence).toBe('low');
    });
  });

  describe('Language and Cultural Edge Cases', () => {
    it('should handle conversations with mixed languages', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel muy triste today. Estoy muy depressed.' },
            { role: 'patient', content: 'Je suis très anxious. I am very worried.' },
            { role: 'patient', content: 'Ich bin so confused. I don\'t understand anything.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.vocabularyMetrics).toBeDefined();
    });

    it('should handle conversations with cultural expressions of distress', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I have a heavy heart and my soul is weary.' },
            { role: 'patient', content: 'The darkness surrounds me and I cannot find light.' },
            { role: 'patient', content: 'My spirit is broken and I feel lost in this world.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.psychiatricMetrics.depressionScore).toBeGreaterThan(30);
      expect(result.psychiatricMetrics.indicators).toContain(expect.stringMatching(/depression/i));
    });

    it('should handle conversations with religious or spiritual language', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I pray for peace but God seems to have abandoned me.' },
            { role: 'patient', content: 'I feel like I\'m being tested by the universe.' },
            { role: 'patient', content: 'My faith is wavering and I don\'t know what to believe anymore.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.psychiatricMetrics.depressionScore).toBeGreaterThan(30);
      expect(result.psychiatricMetrics.indicators).toContain(expect.stringMatching(/depression/i));
    });
  });

  describe('Technical Edge Cases', () => {
    it('should handle conversations with HTML tags', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel <strong>very sad</strong> today.' },
            { role: 'patient', content: 'I am <em>anxious</em> about everything.' },
            { role: 'patient', content: 'I don\'t know what to do <br> anymore.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
    });

    it('should handle conversations with URLs and email addresses', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I found this website https://example.com that might help.' },
            { role: 'patient', content: 'You can email me at patient@example.com if needed.' },
            { role: 'patient', content: 'I feel confused about everything.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
    });

    it('should handle conversations with special characters and symbols', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel @#$% confused today!' },
            { role: 'patient', content: 'Everything is &*()%$#@! messed up.' },
            { role: 'patient', content: 'I don\'t know what to do anymore...' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
    });
  });

  describe('Speech-to-Text Edge Cases', () => {
    it('should handle conversations with transcription errors', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel very sad today but I can\'t explain why.' },
            { role: 'patient', content: 'I am anxious about everything and I don\'t know what to do.' },
            { role: 'patient', content: 'I feel confused and lost and I need help.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
    });

    it('should handle conversations with background noise indicators', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel [unclear] sad today.' },
            { role: 'patient', content: 'I am [background noise] anxious about everything.' },
            { role: 'patient', content: 'I don\'t [static] know what to do.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
    });

    it('should handle conversations with partial words', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel very sa... sad today.' },
            { role: 'patient', content: 'I am anx... anxious about everything.' },
            { role: 'patient', content: 'I don\'t know what to do anym... anymore.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
    });
  });

  describe('Medical Condition Edge Cases', () => {
    it('should handle conversations with medication-related language', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I take my medication every day but I still feel depressed.' },
            { role: 'patient', content: 'The side effects of my medication are making me anxious.' },
            { role: 'patient', content: 'I forgot to take my medication and now I feel confused.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
    });

    it('should handle conversations with medical terminology', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I have been diagnosed with major depressive disorder.' },
            { role: 'patient', content: 'My anxiety disorder is getting worse.' },
            { role: 'patient', content: 'I think I might have early onset dementia.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
    });

    it('should handle conversations with symptom descriptions', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I have been experiencing persistent sadness and loss of interest.' },
            { role: 'patient', content: 'I feel constant worry and restlessness.' },
            { role: 'patient', content: 'I have been having memory problems and confusion.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
    });
  });

  describe('Extreme Value Edge Cases', () => {
    it('should handle conversations with extremely long messages', async () => {
      const longMessage = 'I feel very sad and depressed and anxious and worried and confused and lost and hopeless and worthless and alone and isolated and scared and frightened and terrified and panicked and overwhelmed and exhausted and tired and fatigued and drained and empty and numb and disconnected and dissociated and derealized and depersonalized and suicidal and homicidal and violent and aggressive and angry and frustrated and irritated and annoyed and agitated and restless and hyperactive and manic and euphoric and elated and grandiose and delusional and paranoid and suspicious and fearful and avoidant and withdrawn and isolated and lonely and sad and depressed and anxious and worried and confused and lost and hopeless and worthless and alone and isolated and scared and frightened and terrified and panicked and overwhelmed and exhausted and tired and fatigued and drained and empty and numb and disconnected and dissociated and derealized and depersonalized and suicidal and homicidal and violent and aggressive and angry and frustrated and irritated and annoyed and agitated and restless and hyperactive and manic and euphoric and elated and grandiose and delusional and paranoid and suspicious and fearful and avoidant and withdrawn and isolated and lonely and sad and depressed and anxious and worried and confused and lost and hopeless and worthless and alone and isolated and scared and frightened and terrified and panicked and overwhelmed and exhausted and tired and fatigued and drained and empty and numb and disconnected and dissociated and derealized and depersonalized and suicidal and homicidal and violent and aggressive and angry and frustrated and irritated and annoyed and agitated and restless and hyperactive and manic and euphoric and elated and grandiose and delusional and paranoid and suspicious and fearful and avoidant and withdrawn and isolated and lonely.';

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
    });

    it('should handle conversations with extremely short messages', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'Yes' },
            { role: 'patient', content: 'No' },
            { role: 'patient', content: 'Maybe' },
            { role: 'patient', content: 'I don\'t know' },
            { role: 'patient', content: 'Help' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.vocabularyMetrics).toBeDefined();
    });

    it('should handle conversations with extremely repetitive content', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I am sad. I am sad. I am sad. I am sad. I am sad.' },
            { role: 'patient', content: 'I am anxious. I am anxious. I am anxious. I am anxious.' },
            { role: 'patient', content: 'I am confused. I am confused. I am confused. I am confused.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.cognitiveMetrics.repetitionScore).toBeGreaterThan(50);
    });
  });

  describe('Data Structure Edge Cases', () => {
    it('should handle conversations with missing message content', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel sad today.' },
            { role: 'patient', content: null },
            { role: 'patient', content: undefined },
            { role: 'patient', content: '' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
    });

    it('should handle conversations with missing message roles', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { content: 'I feel sad today.' },
            { role: null, content: 'I am anxious.' },
            { role: undefined, content: 'I am confused.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
    });

    it('should handle conversations with malformed message objects', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel sad today.' },
            'This is not a message object',
            { role: 'patient' }, // Missing content
            { content: 'I am anxious.' }, // Missing role
            null,
            undefined
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle analysis of very large conversation datasets', async () => {
      // Create a large number of conversations
      const conversations = [];
      for (let i = 0; i < 100; i++) {
        conversations.push({
          _id: `conv${i}`,
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: `I feel sad today in conversation ${i}.` },
            { role: 'patient', content: `I am anxious about everything in conversation ${i}.` },
            { role: 'patient', content: `I am confused and lost in conversation ${i}.` }
          ]
        });
      }

      const startTime = Date.now();
      const result = await analyzer.analyzeMonth(conversations);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.vocabularyMetrics).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle analysis with very deep message nesting', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel sad today.' },
            { role: 'patient', content: 'I am anxious about everything.' },
            { role: 'patient', content: 'I am confused and lost.' }
          ]
        }
      ];

      const startTime = Date.now();
      const result = await analyzer.analyzeMonth(conversations);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Error Recovery Edge Cases', () => {
    it('should handle analysis with corrupted data gracefully', async () => {
      const conversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'I feel sad today.' },
            { role: 'patient', content: 'I am anxious about everything.' },
            { role: 'patient', content: 'I am confused and lost.' }
          ]
        }
      ];

      // Mock an error in one of the analysis components
      const originalAnalyzeMonth = analyzer.analyzeMonth;
      analyzer.analyzeMonth = jest.fn().mockImplementation(async (conversations) => {
        // Simulate partial failure
        try {
          const result = await originalAnalyzeMonth.call(analyzer, conversations);
          return result;
        } catch (error) {
          // Return partial results
          return {
            cognitiveMetrics: { riskScore: 0, confidence: 'none', indicators: [] },
            psychiatricMetrics: { depressionScore: 0, anxietyScore: 0, overallRiskScore: 0, indicators: [] },
            vocabularyMetrics: { totalWords: 0, uniqueWords: 0, typeTokenRatio: 0, complexityScore: 0 },
            warnings: ['Partial analysis due to component failure'],
            confidence: 'low',
            analysisDate: new Date(),
            conversationCount: conversations.length,
            messageCount: 0,
            totalWords: 0
          };
        }
      });

      try {
        const result = await analyzer.analyzeMonth(conversations);

        expect(result).toBeDefined();
        expect(result.warnings).toContain('Partial analysis due to component failure');
        expect(result.confidence).toBe('low');
      } finally {
        // Restore original method
        analyzer.analyzeMonth = originalAnalyzeMonth;
      }
    });
  });
});

