// tests/unit/medicalCognitiveDecline.test.js
const MedicalPatternAnalyzer = require('../../src/services/ai/medicalPatternAnalyzer.service');
const { detectCognitiveDecline } = require('../../src/services/ai/cognitiveDeclineDetector.service');
const { calculateVocabularyMetrics } = require('../../src/services/ai/vocabularyAnalyzer.service');
const { analyzeSpeechPatterns } = require('../../src/services/ai/speechPatternAnalyzer.service');
const { findRepetitions } = require('../../src/services/ai/repetitionMemoryAnalyzer.service');
const {
  medicalPatients,
  cognitiveDeclineConversations,
  mixedDeclineConversations,
  stablePatientConversations,
  createConversationsFromFixture
} = require('../fixtures/medicalConversations.fixture');

describe('Medical Cognitive Decline Detection', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new MedicalPatternAnalyzer();
  });

  describe('Progressive Cognitive Decline Scenarios', () => {
    it('should detect gradual cognitive decline over 6 months', async () => {
      // Create conversations from the cognitive decline fixture
      const conversations = await createConversationsFromFixture(
        medicalPatients.cognitiveDeclinePatient._id,
        cognitiveDeclineConversations
      );

      // Analyze each month separately to track progression
      const monthlyAnalyses = {};
      
      // Group conversations by month for analysis
      const conversationsByMonth = {
        month1: conversations.filter(c => c.startTime.getMonth() === 0), // January
        month2: conversations.filter(c => c.startTime.getMonth() === 1), // February
        month3: conversations.filter(c => c.startTime.getMonth() === 2), // March
        month4: conversations.filter(c => c.startTime.getMonth() === 3), // April
        month5: conversations.filter(c => c.startTime.getMonth() === 4), // May
        month6: conversations.filter(c => c.startTime.getMonth() === 5)  // June
      };

      // Analyze each month
      for (const [month, monthConversations] of Object.entries(conversationsByMonth)) {
        if (monthConversations.length > 0) {
          monthlyAnalyses[month] = await analyzer.analyzeMonth(monthConversations);
        }
      }

      // Verify cognitive decline progression
      expect(monthlyAnalyses.month1.cognitiveMetrics.riskScore).toBeLessThan(30);
      expect(monthlyAnalyses.month2.cognitiveMetrics.riskScore).toBeGreaterThan(monthlyAnalyses.month1.cognitiveMetrics.riskScore);
      expect(monthlyAnalyses.month3.cognitiveMetrics.riskScore).toBeGreaterThan(monthlyAnalyses.month2.cognitiveMetrics.riskScore);
      expect(monthlyAnalyses.month4.cognitiveMetrics.riskScore).toBeGreaterThan(monthlyAnalyses.month3.cognitiveMetrics.riskScore);
      expect(monthlyAnalyses.month5.cognitiveMetrics.riskScore).toBeGreaterThan(monthlyAnalyses.month4.cognitiveMetrics.riskScore);
      expect(monthlyAnalyses.month6.cognitiveMetrics.riskScore).toBeGreaterThan(monthlyAnalyses.month5.cognitiveMetrics.riskScore);

      // Verify high-risk indicators in later months
      expect(monthlyAnalyses.month6.cognitiveMetrics.riskScore).toBeGreaterThan(70);
      expect(monthlyAnalyses.month6.warnings).toContain(expect.stringMatching(/cognitive decline/i));
    });

    it('should detect vocabulary complexity decline over time', async () => {
      const conversations = await createConversationsFromFixture(
        medicalPatients.cognitiveDeclinePatient._id,
        cognitiveDeclineConversations
      );

      const monthlyAnalyses = {};
      const conversationsByMonth = {
        month1: conversations.filter(c => c.startTime.getMonth() === 0),
        month6: conversations.filter(c => c.startTime.getMonth() === 5)
      };

      for (const [month, monthConversations] of Object.entries(conversationsByMonth)) {
        if (monthConversations.length > 0) {
          monthlyAnalyses[month] = await analyzer.analyzeMonth(monthConversations);
        }
      }

      // Vocabulary complexity should decrease over time
      expect(monthlyAnalyses.month6.vocabularyMetrics.complexityScore)
        .toBeLessThan(monthlyAnalyses.month1.vocabularyMetrics.complexityScore);

      expect(monthlyAnalyses.month6.vocabularyMetrics.avgSentenceLength)
        .toBeLessThan(monthlyAnalyses.month1.vocabularyMetrics.avgSentenceLength);

      expect(monthlyAnalyses.month6.vocabularyMetrics.typeTokenRatio)
        .toBeLessThan(monthlyAnalyses.month1.vocabularyMetrics.typeTokenRatio);
    });

    it('should detect increasing filler word usage and speech patterns', async () => {
      const conversations = await createConversationsFromFixture(
        medicalPatients.cognitiveDeclinePatient._id,
        cognitiveDeclineConversations
      );

      const monthlyAnalyses = {};
      const conversationsByMonth = {
        month1: conversations.filter(c => c.startTime.getMonth() === 0),
        month6: conversations.filter(c => c.startTime.getMonth() === 5)
      };

      for (const [month, monthConversations] of Object.entries(conversationsByMonth)) {
        if (monthConversations.length > 0) {
          monthlyAnalyses[month] = await analyzer.analyzeMonth(monthConversations);
        }
      }

      // Filler word density should increase over time
      expect(monthlyAnalyses.month6.cognitiveMetrics.fillerWordDensity)
        .toBeGreaterThan(monthlyAnalyses.month1.cognitiveMetrics.fillerWordDensity);

      // Vague reference density should increase
      expect(monthlyAnalyses.month6.cognitiveMetrics.vagueReferenceDensity)
        .toBeGreaterThan(monthlyAnalyses.month1.cognitiveMetrics.vagueReferenceDensity);
    });
  });

  describe('Cognitive Decline Indicators', () => {
    it('should detect memory-related language patterns', () => {
      const messages = [
        'I forgot what I was going to say',
        'I can\'t remember where I put my keys',
        'I don\'t recall what happened yesterday',
        'I keep forgetting important things'
      ];
      const combinedText = messages.join(' ');

      const result = detectCognitiveDecline(messages, combinedText);

      expect(result.indicators).toContain(expect.stringMatching(/memory/i));
      expect(result.riskScore).toBeGreaterThan(40);
    });

    it('should detect confusion and disorientation patterns', () => {
      const messages = [
        'I don\'t know where I am',
        'I\'m confused about what\'s happening',
        'I can\'t figure out what to do',
        'Everything feels strange and unfamiliar'
      ];
      const combinedText = messages.join(' ');

      const result = detectCognitiveDecline(messages, combinedText);

      expect(result.indicators).toContain(expect.stringMatching(/confusion/i));
      expect(result.riskScore).toBeGreaterThan(50);
    });

    it('should detect word-finding difficulties', () => {
      const messages = [
        'I need the thing... you know, the thing you use to...',
        'I can\'t think of the word for it',
        'What do you call that thing that...',
        'I know what I want to say but I can\'t find the words'
      ];
      const combinedText = messages.join(' ');

      const result = detectCognitiveDecline(messages, combinedText);

      expect(result.indicators).toContain(expect.stringMatching(/word.*find/i));
      expect(result.riskScore).toBeGreaterThan(45);
    });

    it('should detect repetitive speech patterns', () => {
      const messages = [
        'I am so confused. I am so confused about everything.',
        'I don\'t know what to do. I don\'t know what to do.',
        'Help me please. Help me please.',
        'I am lost. I am lost and scared.'
      ];
      const combinedText = messages.join(' ');

      const result = detectCognitiveDecline(messages, combinedText);

      expect(result.repetitionScore).toBeGreaterThan(60);
      expect(result.riskScore).toBeGreaterThan(50);
    });
  });

  describe('Speech Pattern Analysis for Cognitive Decline', () => {
    it('should detect incomplete sentences and fragmented speech', () => {
      const conversations = [
        {
          _id: 'conv1',
          messages: [
            { role: 'patient', content: 'I was going to...' },
            { role: 'patient', content: 'But then I...' },
            { role: 'patient', content: 'So I think...' },
            { role: 'patient', content: 'I don\'t know...' }
          ]
        }
      ];

      const result = analyzeSpeechPatterns(conversations);

      expect(result.incompleteSentences.percentage).toBeGreaterThan(70);
      expect(result.speechHealthScore).toBeLessThan(40);
    });

    it('should detect topic coherence issues', () => {
      const conversations = [
        {
          _id: 'conv1',
          messages: [
            { role: 'patient', content: 'I need to take my medication.' },
            { role: 'patient', content: 'The weather is nice today.' },
            { role: 'patient', content: 'I forgot to feed the cat.' },
            { role: 'patient', content: 'My doctor said something important.' }
          ]
        }
      ];

      const result = analyzeSpeechPatterns(conversations);

      expect(result.topicCoherence.score).toBeLessThan(30);
      expect(result.speechAbnormalities).toContain(expect.stringMatching(/topic.*coherence/i));
    });

    it('should detect word substitutions and paraphasias', () => {
      const conversations = [
        {
          _id: 'conv1',
          messages: [
            { role: 'patient', content: 'I need to take my... um... the thing for my blood pressure.' },
            { role: 'patient', content: 'I put the food in the... the cold box.' },
            { role: 'patient', content: 'I use the... the thing that makes holes in paper.' }
          ]
        }
      ];

      const result = analyzeSpeechPatterns(conversations);

      expect(result.wordSubstitutions.count).toBeGreaterThan(0);
      expect(result.speechAbnormalities).toContain(expect.stringMatching(/word.*substitution/i));
    });
  });

  describe('Repetition Analysis for Cognitive Decline', () => {
    it('should detect concerning repetition patterns across conversations', () => {
      const conversations = [
        {
          _id: 'conv1',
          messages: [
            { role: 'patient', content: 'I am so confused about everything.' },
            { role: 'patient', content: 'I don\'t know what to do anymore.' }
          ]
        },
        {
          _id: 'conv2',
          messages: [
            { role: 'patient', content: 'I am so confused about everything.' },
            { role: 'patient', content: 'I don\'t know what to do anymore.' }
          ]
        },
        {
          _id: 'conv3',
          messages: [
            { role: 'patient', content: 'I am so confused about everything.' },
            { role: 'patient', content: 'I don\'t know what to do anymore.' }
          ]
        }
      ];

      const result = findRepetitions(conversations);

      expect(result.concerningRepetitions.hasConcerningRepetitions).toBe(true);
      expect(result.concerningRepetitions.concerningCount).toBeGreaterThan(0);
      expect(result.repetitionIndex).toBeGreaterThan(60);
    });

    it('should detect within-conversation repetition patterns', () => {
      const conversations = [
        {
          _id: 'conv1',
          messages: [
            { role: 'patient', content: 'I am confused. I am confused about everything.' },
            { role: 'patient', content: 'I don\'t know what to do. I don\'t know what to do.' },
            { role: 'patient', content: 'Help me please. Help me please.' }
          ]
        }
      ];

      const result = findRepetitions(conversations);

      expect(result.withinConversationRepetitions.count).toBeGreaterThan(0);
      expect(result.repetitionIndex).toBeGreaterThan(40);
    });
  });

  describe('Baseline Comparison for Cognitive Decline', () => {
    it('should detect significant cognitive changes from baseline', async () => {
      // Create baseline conversations (month 1)
      const baselineConversations = await createConversationsFromFixture(
        medicalPatients.cognitiveDeclinePatient._id,
        { month1: cognitiveDeclineConversations.month1 }
      );

      // Create current conversations (month 6)
      const currentConversations = await createConversationsFromFixture(
        medicalPatients.cognitiveDeclinePatient._id,
        { month6: cognitiveDeclineConversations.month6 }
      );

      // Analyze baseline
      const baselineAnalysis = await analyzer.analyzeMonth(baselineConversations);

      // Analyze current with baseline comparison
      const currentAnalysis = await analyzer.analyzeMonth(currentConversations, baselineAnalysis);

      // Verify significant changes detected
      expect(currentAnalysis.changeFromBaseline).toBeDefined();
      expect(currentAnalysis.changeFromBaseline.cognitive).toBeDefined();
      expect(currentAnalysis.changeFromBaseline.cognitive.riskScore).toBeGreaterThan(30);
      expect(currentAnalysis.warnings).toContain(expect.stringMatching(/cognitive decline/i));
    });

    it('should not flag stable patients as having cognitive decline', async () => {
      // Create stable patient conversations
      const stableConversations = await createConversationsFromFixture(
        medicalPatients.stablePatient._id,
        stablePatientConversations
      );

      const analysis = await analyzer.analyzeMonth(stableConversations);

      // Stable patient should have low cognitive risk scores
      expect(analysis.cognitiveMetrics.riskScore).toBeLessThan(30);
      expect(analysis.warnings).not.toContain(expect.stringMatching(/cognitive decline/i));
    });
  });

  describe('Edge Cases for Cognitive Decline Detection', () => {
    it('should handle conversations with minimal cognitive content', async () => {
      const minimalConversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'patient', content: 'Hello' },
            { role: 'patient', content: 'Goodbye' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(minimalConversations);

      expect(result.warnings).toContain('Insufficient conversation data for analysis (< 100 characters)');
      expect(result.confidence).toBe('low');
    });

    it('should handle conversations with only assistant messages', async () => {
      const assistantOnlyConversations = [
        {
          _id: 'conv1',
          patientId: 'test-patient',
          messages: [
            { role: 'assistant', content: 'Hello, how are you feeling today?' },
            { role: 'assistant', content: 'I hope you are doing well.' }
          ]
        }
      ];

      const result = await analyzer.analyzeMonth(assistantOnlyConversations);

      expect(result.warnings).toContain('Insufficient conversation data for analysis (< 100 characters)');
    });

    it('should handle mixed cognitive and psychiatric symptoms', async () => {
      const mixedConversations = await createConversationsFromFixture(
        medicalPatients.mixedDeclinePatient._id,
        mixedDeclineConversations
      );

      const analysis = await analyzer.analyzeMonth(mixedConversations);

      // Should detect both cognitive and psychiatric issues
      expect(analysis.cognitiveMetrics.riskScore).toBeGreaterThan(40);
      expect(analysis.psychiatricMetrics.overallRiskScore).toBeGreaterThan(40);
      expect(analysis.warnings).toContain(expect.stringMatching(/cognitive/i));
      expect(analysis.warnings).toContain(expect.stringMatching(/psychiatric/i));
    });

    it('should handle conversations with typos and speech-to-text errors', () => {
      const messages = [
        'I am so confusd about everything',
        'I dont know what to do anymore',
        'I feel like I am loosing my mind',
        'Everythign feels strange and unfamiliar'
      ];
      const combinedText = messages.join(' ');

      const result = detectCognitiveDecline(messages, combinedText);

      // Should still detect cognitive decline despite typos
      expect(result.riskScore).toBeGreaterThan(30);
      expect(result.indicators).toContain(expect.stringMatching(/confusion/i));
    });
  });

  describe('Confidence and Reliability', () => {
    it('should provide appropriate confidence levels based on data quality', async () => {
      const conversations = await createConversationsFromFixture(
        medicalPatients.cognitiveDeclinePatient._id,
        cognitiveDeclineConversations
      );

      const analysis = await analyzer.analyzeMonth(conversations);

      // With substantial conversation data, should have high confidence
      expect(analysis.confidence).toBe('high');
      expect(analysis.conversationCount).toBeGreaterThan(5);
      expect(analysis.totalWords).toBeGreaterThan(500);
    });

    it('should handle analysis errors gracefully', async () => {
      // Mock an error in the analyzer
      const originalAnalyzeMonth = analyzer.analyzeMonth;
      analyzer.analyzeMonth = jest.fn().mockRejectedValue(new Error('Analysis failed'));

      const conversations = await createConversationsFromFixture(
        medicalPatients.cognitiveDeclinePatient._id,
        { month1: cognitiveDeclineConversations.month1 }
      );

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.warnings).toContain(expect.stringMatching(/Analysis failed/i));
      expect(result.confidence).toBe('none');

      // Restore original method
      analyzer.analyzeMonth = originalAnalyzeMonth;
    });
  });
});

