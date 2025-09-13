// tests/unit/medicalPsychiatricDecline.test.js
const MedicalPatternAnalyzer = require('../../src/services/ai/medicalPatternAnalyzer.service');
const { analyzePsychiatricMarkers } = require('../../src/services/ai/psychiatricMarkerAnalyzer.service');
const { analyzePsychiatricMarkers: analyzePsychiatricPatterns } = require('../../src/services/ai/psychiatricPatternDetector.service');
const {
  medicalPatients,
  psychiatricDeclineConversations,
  mixedDeclineConversations,
  stablePatientConversations,
  createConversationsFromFixture
} = require('../fixtures/medicalConversations.fixture');

describe('Medical Psychiatric Decline Detection', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new MedicalPatternAnalyzer();
  });

  describe('Progressive Psychiatric Decline Scenarios', () => {
    it('should detect gradual psychiatric deterioration over 6 months', async () => {
      // Create conversations from the psychiatric decline fixture
      const conversations = await createConversationsFromFixture(
        medicalPatients.psychiatricDeclinePatient._id,
        psychiatricDeclineConversations
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

      // Verify psychiatric decline progression
      expect(monthlyAnalyses.month1.psychiatricMetrics.depressionScore).toBeLessThan(50);
      expect(monthlyAnalyses.month1.psychiatricMetrics.anxietyScore).toBeLessThan(50);
      
      expect(monthlyAnalyses.month2.psychiatricMetrics.depressionScore)
        .toBeGreaterThan(monthlyAnalyses.month1.psychiatricMetrics.depressionScore);
      
      expect(monthlyAnalyses.month3.psychiatricMetrics.depressionScore)
        .toBeGreaterThan(monthlyAnalyses.month2.psychiatricMetrics.depressionScore);
      
      expect(monthlyAnalyses.month4.psychiatricMetrics.depressionScore)
        .toBeGreaterThan(monthlyAnalyses.month3.psychiatricMetrics.depressionScore);
      
      expect(monthlyAnalyses.month5.psychiatricMetrics.depressionScore)
        .toBeGreaterThan(monthlyAnalyses.month4.psychiatricMetrics.depressionScore);
      
      expect(monthlyAnalyses.month6.psychiatricMetrics.depressionScore)
        .toBeGreaterThan(monthlyAnalyses.month5.psychiatricMetrics.depressionScore);

      // Verify crisis-level indicators in later months
      expect(monthlyAnalyses.month4.psychiatricMetrics.crisisIndicators.hasCrisisIndicators).toBe(true);
      expect(monthlyAnalyses.month6.psychiatricMetrics.overallRiskScore).toBeGreaterThan(80);
    });

    it('should detect increasing anxiety and hopelessness indicators', async () => {
      const conversations = await createConversationsFromFixture(
        medicalPatients.psychiatricDeclinePatient._id,
        psychiatricDeclineConversations
      );

      const monthlyAnalyses = {};
      const conversationsByMonth = {
        month1: conversations.filter(c => c.startTime.getMonth() === 0),
        month3: conversations.filter(c => c.startTime.getMonth() === 2),
        month6: conversations.filter(c => c.startTime.getMonth() === 5)
      };

      for (const [month, monthConversations] of Object.entries(conversationsByMonth)) {
        if (monthConversations.length > 0) {
          monthlyAnalyses[month] = await analyzer.analyzeMonth(monthConversations);
        }
      }

      // Anxiety scores should increase over time
      expect(monthlyAnalyses.month3.psychiatricMetrics.anxietyScore)
        .toBeGreaterThan(monthlyAnalyses.month1.psychiatricMetrics.anxietyScore);
      
      expect(monthlyAnalyses.month6.psychiatricMetrics.anxietyScore)
        .toBeGreaterThan(monthlyAnalyses.month3.psychiatricMetrics.anxietyScore);

      // Overall risk should increase
      expect(monthlyAnalyses.month6.psychiatricMetrics.overallRiskScore)
        .toBeGreaterThan(monthlyAnalyses.month1.psychiatricMetrics.overallRiskScore);
    });

    it('should detect functional impairment progression', async () => {
      const conversations = await createConversationsFromFixture(
        medicalPatients.psychiatricDeclinePatient._id,
        psychiatricDeclineConversations
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

      // Later months should show more functional impairment indicators
      expect(monthlyAnalyses.month6.psychiatricMetrics.indicators)
        .toContain(expect.stringMatching(/functional.*impairment/i));
      
      expect(monthlyAnalyses.month6.psychiatricMetrics.indicators)
        .toContain(expect.stringMatching(/social.*withdrawal/i));
    });
  });

  describe('Depression Detection', () => {
    it('should detect mild depression symptoms', () => {
      const text = 'I\'ve been feeling down lately. I don\'t have much energy and I\'m not interested in things I used to enjoy.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(30);
      expect(result.depressionScore).toBeLessThan(60);
      expect(result.indicators).toContain(expect.stringMatching(/depression/i));
    });

    it('should detect moderate depression symptoms', () => {
      const text = 'I feel hopeless and worthless. I can\'t concentrate on anything and I\'ve lost my appetite. I don\'t see any point in trying anymore.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(50);
      expect(result.depressionScore).toBeLessThan(80);
      expect(result.indicators).toContain(expect.stringMatching(/hopeless/i));
      expect(result.indicators).toContain(expect.stringMatching(/worthless/i));
    });

    it('should detect severe depression symptoms', () => {
      const text = 'I am completely worthless and a burden to everyone. I have no reason to live and I wish I could just disappear. I can\'t function at all anymore.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(70);
      expect(result.indicators).toContain(expect.stringMatching(/worthless/i));
      expect(result.indicators).toContain(expect.stringMatching(/burden/i));
    });

    it('should detect anhedonia and loss of interest', () => {
      const text = 'I don\'t enjoy anything anymore. Even things that used to make me happy feel empty and meaningless. I just want to stay in bed all day.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(40);
      expect(result.indicators).toContain(expect.stringMatching(/anhedonia/i));
      expect(result.indicators).toContain(expect.stringMatching(/loss.*interest/i));
    });

    it('should detect appetite and sleep disturbances', () => {
      const text = 'I haven\'t been eating much lately and I can\'t sleep at night. I wake up at 3 AM and can\'t get back to sleep. I\'ve lost weight because I don\'t feel like eating.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(30);
      expect(result.indicators).toContain(expect.stringMatching(/sleep.*disturbance/i));
      expect(result.indicators).toContain(expect.stringMatching(/appetite.*change/i));
    });
  });

  describe('Anxiety Detection', () => {
    it('should detect generalized anxiety symptoms', () => {
      const text = 'I worry about everything constantly. I can\'t stop thinking about all the things that could go wrong. My heart races and I feel tense all the time.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.anxietyScore).toBeGreaterThan(40);
      expect(result.indicators).toContain(expect.stringMatching(/anxiety/i));
      expect(result.indicators).toContain(expect.stringMatching(/worry/i));
    });

    it('should detect panic and physical anxiety symptoms', () => {
      const text = 'I had a panic attack yesterday. My heart was racing, I couldn\'t breathe, and I thought I was going to die. I\'m terrified it will happen again.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.anxietyScore).toBeGreaterThan(60);
      expect(result.indicators).toContain(expect.stringMatching(/panic/i));
      expect(result.indicators).toContain(expect.stringMatching(/physical.*symptoms/i));
    });

    it('should detect social anxiety and avoidance', () => {
      const text = 'I avoid social situations because I\'m afraid people will judge me. I get anxious just thinking about going to work or meeting friends. I feel like everyone is watching me.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.anxietyScore).toBeGreaterThan(50);
      expect(result.indicators).toContain(expect.stringMatching(/social.*anxiety/i));
      expect(result.indicators).toContain(expect.stringMatching(/avoidance/i));
    });
  });

  describe('Crisis Detection', () => {
    it('should detect suicidal ideation', () => {
      const text = 'I don\'t want to be here anymore. I think about ending my life every day. I have a plan and I\'m ready to do it.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.crisisIndicators.hasCrisisIndicators).toBe(true);
      expect(result.crisisIndicators.crisisCount).toBeGreaterThan(0);
      expect(result.crisisIndicators.indicators).toContain(expect.stringMatching(/suicidal/i));
      expect(result.overallRiskScore).toBeGreaterThan(90);
    });

    it('should detect self-harm indicators', () => {
      const text = 'I cut myself yesterday because the emotional pain was too much. I need the physical pain to distract me from how I feel inside.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.crisisIndicators.hasCrisisIndicators).toBe(true);
      expect(result.crisisIndicators.indicators).toContain(expect.stringMatching(/self.*harm/i));
      expect(result.overallRiskScore).toBeGreaterThan(80);
    });

    it('should detect hopelessness and despair', () => {
      const text = 'There\'s no point in anything anymore. Nothing will ever get better and I\'m trapped in this darkness forever. I see no way out.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.crisisIndicators.hasCrisisIndicators).toBe(true);
      expect(result.crisisIndicators.indicators).toContain(expect.stringMatching(/hopeless/i));
      expect(result.overallRiskScore).toBeGreaterThan(85);
    });

    it('should prioritize crisis detection over other symptoms', () => {
      const text = 'I\'m so depressed and anxious, but more than anything, I want to die. I have the means and I\'m going to do it tonight.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.crisisIndicators.hasCrisisIndicators).toBe(true);
      expect(result.crisisIndicators.crisisCount).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(95);
    });
  });

  describe('Psychiatric Pattern Analysis', () => {
    it('should analyze pronoun usage patterns for depression', () => {
      const conversations = [
        {
          _id: 'conv1',
          messages: [
            { role: 'patient', content: 'I feel so alone. I don\'t know what to do. I am worthless.' },
            { role: 'patient', content: 'I think I am a failure. I can\'t do anything right.' }
          ]
        }
      ];

      const result = analyzePsychiatricPatterns(conversations);

      expect(result.pronounAnalysis.percentages.firstPerson).toBeGreaterThan(70);
      expect(result.pronounAnalysis.percentages.secondPerson).toBeLessThan(20);
      expect(result.pronounAnalysis.percentages.thirdPerson).toBeLessThan(20);
    });

    it('should analyze temporal focus patterns', () => {
      const conversations = [
        {
          _id: 'conv1',
          messages: [
            { role: 'patient', content: 'I used to be happy but now I am miserable.' },
            { role: 'patient', content: 'I will never be happy again. I am doomed to suffer forever.' }
          ]
        }
      ];

      const result = analyzePsychiatricPatterns(conversations);

      expect(result.temporalFocus.percentages.past).toBeGreaterThan(30);
      expect(result.temporalFocus.percentages.present).toBeGreaterThan(30);
      expect(result.temporalFocus.percentages.future).toBeLessThan(30);
    });

    it('should detect absolutist language patterns', () => {
      const conversations = [
        {
          _id: 'conv1',
          messages: [
            { role: 'patient', content: 'I never feel good anymore. Everything is terrible. I always fail.' },
            { role: 'patient', content: 'Nobody cares about me. I am completely alone.' }
          ]
        }
      ];

      const result = analyzePsychiatricPatterns(conversations);

      expect(result.absolutistAnalysis.count).toBeGreaterThan(5);
      expect(result.absolutistAnalysis.density).toBeGreaterThan(0.1);
      expect(result.absolutistAnalysis.severity).toBeGreaterThan(50);
    });
  });

  describe('Baseline Comparison for Psychiatric Decline', () => {
    it('should detect significant psychiatric changes from baseline', async () => {
      // Create baseline conversations (month 1)
      const baselineConversations = await createConversationsFromFixture(
        medicalPatients.psychiatricDeclinePatient._id,
        { month1: psychiatricDeclineConversations.month1 }
      );

      // Create current conversations (month 6)
      const currentConversations = await createConversationsFromFixture(
        medicalPatients.psychiatricDeclinePatient._id,
        { month6: psychiatricDeclineConversations.month6 }
      );

      // Analyze baseline
      const baselineAnalysis = await analyzer.analyzeMonth(baselineConversations);

      // Analyze current with baseline comparison
      const currentAnalysis = await analyzer.analyzeMonth(currentConversations, baselineAnalysis);

      // Verify significant changes detected
      expect(currentAnalysis.changeFromBaseline).toBeDefined();
      expect(currentAnalysis.changeFromBaseline.psychiatric).toBeDefined();
      expect(currentAnalysis.changeFromBaseline.psychiatric.depressionScore).toBeGreaterThan(20);
      expect(currentAnalysis.warnings).toContain(expect.stringMatching(/psychiatric/i));
    });

    it('should not flag stable patients as having psychiatric issues', async () => {
      // Create stable patient conversations
      const stableConversations = await createConversationsFromFixture(
        medicalPatients.stablePatient._id,
        stablePatientConversations
      );

      const analysis = await analyzer.analyzeMonth(stableConversations);

      // Stable patient should have low psychiatric risk scores
      expect(analysis.psychiatricMetrics.depressionScore).toBeLessThan(30);
      expect(analysis.psychiatricMetrics.anxietyScore).toBeLessThan(30);
      expect(analysis.psychiatricMetrics.overallRiskScore).toBeLessThan(40);
      expect(analysis.warnings).not.toContain(expect.stringMatching(/psychiatric/i));
    });
  });

  describe('Edge Cases for Psychiatric Detection', () => {
    it('should handle conversations with minimal psychiatric content', async () => {
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

    it('should handle conversations with positive psychiatric indicators', () => {
      const text = 'I feel great today! I\'m optimistic about the future and I have lots of energy. I\'m excited about my plans and I feel confident.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeLessThan(20);
      expect(result.anxietyScore).toBeLessThan(20);
      expect(result.overallRiskScore).toBeLessThan(30);
    });

    it('should handle mixed psychiatric symptoms', async () => {
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

    it('should handle cultural and linguistic variations in psychiatric expression', () => {
      const text = 'I feel very sad and empty inside. My heart is heavy with sorrow and I cannot find joy in anything.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(30);
      expect(result.indicators).toContain(expect.stringMatching(/depression/i));
    });

    it('should handle euphemistic expressions of psychiatric distress', () => {
      const text = 'I\'ve been feeling blue lately. I can\'t seem to shake this dark cloud that\'s following me around. I feel like I\'m drowning.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(30);
      expect(result.indicators).toContain(expect.stringMatching(/depression/i));
    });
  });

  describe('Confidence and Reliability for Psychiatric Detection', () => {
    it('should provide appropriate confidence levels based on data quality', async () => {
      const conversations = await createConversationsFromFixture(
        medicalPatients.psychiatricDeclinePatient._id,
        psychiatricDeclineConversations
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
        medicalPatients.psychiatricDeclinePatient._id,
        { month1: psychiatricDeclineConversations.month1 }
      );

      const result = await analyzer.analyzeMonth(conversations);

      expect(result.warnings).toContain(expect.stringMatching(/Analysis failed/i));
      expect(result.confidence).toBe('none');

      // Restore original method
      analyzer.analyzeMonth = originalAnalyzeMonth;
    });
  });

  describe('Integration with Medical Analysis Pipeline', () => {
    it('should integrate psychiatric analysis with overall medical analysis', async () => {
      const conversations = await createConversationsFromFixture(
        medicalPatients.psychiatricDeclinePatient._id,
        psychiatricDeclineConversations
      );

      const analysis = await analyzer.analyzeMonth(conversations);

      // Should have all required components
      expect(analysis.cognitiveMetrics).toBeDefined();
      expect(analysis.psychiatricMetrics).toBeDefined();
      expect(analysis.vocabularyMetrics).toBeDefined();
      expect(analysis.warnings).toBeDefined();
      expect(analysis.confidence).toBeDefined();
      expect(analysis.analysisDate).toBeDefined();
      expect(analysis.conversationCount).toBeGreaterThan(0);
      expect(analysis.messageCount).toBeGreaterThan(0);
      expect(analysis.totalWords).toBeGreaterThan(0);
    });

    it('should generate appropriate warnings for psychiatric decline', async () => {
      const conversations = await createConversationsFromFixture(
        medicalPatients.psychiatricDeclinePatient._id,
        psychiatricDeclineConversations
      );

      const analysis = await analyzer.analyzeMonth(conversations);

      // Should contain psychiatric-related warnings
      expect(analysis.warnings).toContain(expect.stringMatching(/psychiatric/i));
      expect(analysis.warnings).toContain(expect.stringMatching(/depression/i));
      expect(analysis.warnings).toContain(expect.stringMatching(/anxiety/i));
    });
  });
});

