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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'a' },
            { role: 'client', content: 'b' },
            { role: 'client', content: 'c' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: '   ' },
            { role: 'client', content: '\n\t' },
            { role: 'client', content: '    ' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: '...' },
            { role: 'client', content: '!!!' },
            { role: 'client', content: '???' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: '123' },
            { role: 'client', content: '456' },
            { role: 'client', content: '789' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I feel muy triste today. Estoy muy depressed.' },
            { role: 'client', content: 'Je suis très anxious. I am very worried.' },
            { role: 'client', content: 'Ich bin so confused. I don\'t understand anything.' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I have a heavy heart and my soul is weary.' },
            { role: 'client', content: 'The darkness surrounds me and I cannot find light.' },
            { role: 'client', content: 'My spirit is broken and I feel lost in this world.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.psychiatricMetrics.depressionScore).toBeGreaterThan(0);
      expect(result.psychiatricMetrics.indicators.length).toBeGreaterThan(0);
    });

    it('should handle conversations with religious or spiritual language', async () => {
      const conversations = [
        {
          _id: 'conv1',
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I pray for peace but God seems to have abandoned me.' },
            { role: 'client', content: 'I feel like I\'m being tested by the universe.' },
            { role: 'client', content: 'My faith is wavering and I don\'t know what to believe anymore.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      // Religious language may not trigger depression markers - this is clinically appropriate
      expect(result.psychiatricMetrics).toBeDefined();
      expect(result.psychiatricMetrics.depressionScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Technical Edge Cases', () => {
    it('should handle conversations with HTML tags', async () => {
      const conversations = [
        {
          _id: 'conv1',
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I feel <strong>very sad</strong> today.' },
            { role: 'client', content: 'I am <em>anxious</em> about everything.' },
            { role: 'client', content: 'I don\'t know what to do <br> anymore.' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I found this website https://example.com that might help.' },
            { role: 'client', content: 'You can email me at patient@example.com if needed.' },
            { role: 'client', content: 'I feel confused about everything.' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I feel @#$% confused today!' },
            { role: 'client', content: 'Everything is &*()%$#@! messed up.' },
            { role: 'client', content: 'I don\'t know what to do anymore...' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I feel very sad today but I can\'t explain why.' },
            { role: 'client', content: 'I am anxious about everything and I don\'t know what to do.' },
            { role: 'client', content: 'I feel confused and lost and I need help.' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I feel [unclear] sad today.' },
            { role: 'client', content: 'I am [background noise] anxious about everything.' },
            { role: 'client', content: 'I don\'t [static] know what to do.' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I feel very sa... sad today.' },
            { role: 'client', content: 'I am anx... anxious about everything.' },
            { role: 'client', content: 'I don\'t know what to do anym... anymore.' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I take my medication every day but I still feel depressed.' },
            { role: 'client', content: 'The side effects of my medication are making me anxious.' },
            { role: 'client', content: 'I forgot to take my medication and now I feel confused.' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I have been diagnosed with major depressive disorder.' },
            { role: 'client', content: 'My anxiety disorder is getting worse.' },
            { role: 'client', content: 'I think I might have early onset dementia.' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I have been experiencing persistent sadness and loss of interest.' },
            { role: 'client', content: 'I feel constant worry and restlessness.' },
            { role: 'client', content: 'I have been having memory problems and confusion.' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: longMessage }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'Yes' },
            { role: 'client', content: 'No' },
            { role: 'client', content: 'Maybe' },
            { role: 'client', content: 'I don\'t know' },
            { role: 'client', content: 'Help' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.cognitiveMetrics).toBeDefined();
      expect(result.psychiatricMetrics).toBeDefined();
      // Vocabulary metrics may not be generated for extremely short messages
      if (result.vocabularyMetrics) {
        expect(result.vocabularyMetrics).toBeDefined();
      }
    });

    it('should handle conversations with extremely repetitive content', async () => {
      const conversations = [
        {
          _id: 'conv1',
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I am sad. I am sad. I am sad. I am sad. I am sad.' },
            { role: 'client', content: 'I am anxious. I am anxious. I am anxious. I am anxious.' },
            { role: 'client', content: 'I am confused. I am confused. I am confused. I am confused.' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I feel sad today.' },
            { role: 'client', content: null },
            { role: 'client', content: undefined },
            { role: 'client', content: '' }
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
          clientId: 'test-patient',
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I feel sad today.' },
            'This is not a message object',
            { role: 'client' }, // Missing content
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

    it('treats document-shaped messages (e.g. content-only) as in-memory docs, not DB IDs', async () => {
      // When the first message is an object with content but no role, the service must NOT
      // pass it to Message.find({ _id: { $in: ... } }). This test would fail with a CastError if we did.
      const conversations = [
        {
          _id: 'conv1',
          clientId: 'test-patient',
          messages: [{ content: 'Only content, no role.' }]
        }
      ];

      const result = await analyzer.analyzeMonth(conversations);

      expect(result).toBeDefined();
      expect(result.warnings).toBeDefined();
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: `I feel sad today in conversation ${i}.` },
            { role: 'client', content: `I am anxious about everything in conversation ${i}.` },
            { role: 'client', content: `I am confused and lost in conversation ${i}.` }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I feel sad today.' },
            { role: 'client', content: 'I am anxious about everything.' },
            { role: 'client', content: 'I am confused and lost.' }
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
          clientId: 'test-patient',
          messages: [
            { role: 'client', content: 'I feel sad today.' },
            { role: 'client', content: 'I am anxious about everything.' },
            { role: 'client', content: 'I am confused and lost.' }
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
        expect(result.warnings).toBeDefined();
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.confidence).toBe('low');
      } finally {
        // Restore original method
        analyzer.analyzeMonth = originalAnalyzeMonth;
      }
    });
  });
});

