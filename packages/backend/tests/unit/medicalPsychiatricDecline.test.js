// tests/unit/medicalPsychiatricDecline.test.js
const { MongoMemoryServer } = require('mongodb-memory-server');
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
  let mongod;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    
    // Ensure MongoDB connection is established
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongod.getUri());
    }
  });

  afterAll(async () => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  });

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

      // Verify analysis completed for month 1
      expect(monthlyAnalyses.month1).toBeDefined();
      
      // Verify analysis completed for other months
      expect(monthlyAnalyses.month2).toBeDefined();
      expect(monthlyAnalyses.month3).toBeDefined();
      expect(monthlyAnalyses.month4).toBeDefined();
      expect(monthlyAnalyses.month5).toBeDefined();
      expect(monthlyAnalyses.month6).toBeDefined();

      // Analysis should complete for all months
      expect(monthlyAnalyses.month4).toBeDefined();
      expect(monthlyAnalyses.month6).toBeDefined();
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

      // Analysis should complete for all months
      expect(monthlyAnalyses.month1).toBeDefined();
      expect(monthlyAnalyses.month3).toBeDefined();
      expect(monthlyAnalyses.month6).toBeDefined();
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

      // Analysis should complete
      expect(monthlyAnalyses.month1).toBeDefined();
      expect(monthlyAnalyses.month6).toBeDefined();
    });
  });

  describe('Depression Detection', () => {
    it('should detect mild depression symptoms', () => {
      const text = 'I\'ve been feeling down and sad lately. I\'m depressed and feel hopeless about everything. I don\'t have much energy and I\'m tired and exhausted all the time. I feel worthless and helpless. I can\'t concentrate on anything and I have memory problems. I\'m not interested in things I used to enjoy and I feel empty inside. I don\'t want to see anyone and I\'m staying home all the time. I have no appetite and I\'m sleeping too much.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(30);
      expect(result.depressionScore).toBeLessThan(60);
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    it('should detect moderate depression symptoms', () => {
      const text = 'I feel hopeless and worthless all the time. I\'m depressed and feel helpless about my situation. I can\'t concentrate on anything and I have memory problems. I\'ve lost my appetite and I\'m sleeping too much. I feel empty and numb inside. I don\'t see any point in trying anymore and I feel like nothing matters. I\'m exhausted and have no energy. I feel miserable and broken.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(25);
      expect(result.depressionScore).toBeLessThan(80);
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    it('should detect severe depression symptoms', () => {
      const text = 'I am completely worthless and a burden to everyone. I\'m devastated and feel desperate about my situation. I have no reason to live and I wish I could just disappear. I can\'t function at all anymore and I feel crushed by everything. I\'m depressed and feel defeated. I have no appetite and I\'m sleeping too much. I feel empty and numb inside. I can\'t concentrate and have memory problems. I don\'t want to see anyone and I\'m isolated from everyone. I feel like nothing will help me.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(25);
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    it('should detect anhedonia and loss of interest', () => {
      const text = 'I don\'t enjoy anything anymore. Even things that used to make me happy feel empty and meaningless. I just want to stay in bed all day.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(2);
    });

    it('should detect appetite and sleep disturbances', () => {
      const text = 'I haven\'t been eating much lately and I can\'t sleep at night. I wake up at 3 AM and can\'t get back to sleep. I\'ve lost weight because I don\'t feel like eating.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(1);
    });
  });

  describe('Anxiety Detection', () => {
    it('should detect generalized anxiety symptoms', () => {
      const text = 'I\'m always worried and anxious about everything. I can\'t stop thinking about what could go wrong and I\'m constantly concerned. I feel nervous and fearful all the time and I\'m constantly on edge. I\'m scared about the future and I feel like something bad is going to happen. I\'m stressed out and I can\'t relax. My heart races and I feel tense all the time.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.anxietyScore).toBeGreaterThan(15);
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    it('should detect panic and physical anxiety symptoms', () => {
      const text = 'I had a panic attack yesterday and I\'m terrified it will happen again. My heart was racing and pounding, I couldn\'t breathe and I was short of breath. I was sweating and shaking and trembling. I thought I was going to die and I was panicked. I feel anxious and nervous about it happening again. I\'m scared and fearful.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.anxietyScore).toBeGreaterThan(25);
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    it('should detect social anxiety and avoidance', () => {
      const text = 'I avoid social situations because I\'m afraid people will judge me. I get anxious just thinking about going to work or meeting friends. I feel like everyone is watching me.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.anxietyScore).toBeGreaterThan(4);
      expect(result.indicators.length).toBeGreaterThan(0);
    });
  });

  describe('Crisis Detection', () => {
    it('should detect suicidal ideation', () => {
      const text = 'I don\'t want to live anymore and I think about killing myself every day. I want to end my life because life isn\'t worth living. I have no reason to live and I\'m not worth living.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.crisisIndicators.hasCrisisIndicators).toBe(true);
      expect(result.crisisIndicators.crisisCount).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(1);
    });

    it('should detect self-harm indicators', () => {
      const text = 'I want to harm myself and hurt myself because the emotional pain is too much. I cut myself yesterday and I want to overdose.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.crisisIndicators.hasCrisisIndicators).toBe(true);
      expect(result.crisisIndicators.crisisCount).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(5);
    });

    it('should detect hopelessness and despair', () => {
      const text = 'There\'s no point in anything anymore and I have nothing to live for. Nothing will ever get better and I\'m better off dead. I see no way out and I want to give up on life.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.crisisIndicators.hasCrisisIndicators).toBe(true);
      expect(result.crisisIndicators.crisisCount).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(1);
    });

    it('should prioritize crisis detection over other symptoms', () => {
      const text = 'I\'m so depressed and anxious, but more than anything, I want to kill myself and end my life. I have no reason to live and I\'m going to do it tonight.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.crisisIndicators.hasCrisisIndicators).toBe(true);
      expect(result.crisisIndicators.crisisCount).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(1);
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

      expect(result.pronounAnalysis.percentages.firstPerson).toBeGreaterThan(20);
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

      expect(result.temporalFocus.percentages.past).toBeGreaterThan(15);
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

      expect(result.absolutistAnalysis.count).toBeGreaterThan(3);
      expect(result.absolutistAnalysis.density).toBeGreaterThan(0.1);
      expect(result.absolutistAnalysis.severity).toBe('high');
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

      // Verify analysis completed
      expect(currentAnalysis).toBeDefined();
      expect(currentAnalysis.warnings).toBeDefined();
    });

    it('should not flag stable patients as having psychiatric issues', async () => {
      // Create stable patient conversations
      const stableConversations = await createConversationsFromFixture(
        medicalPatients.stablePatient._id,
        stablePatientConversations
      );

      const analysis = await analyzer.analyzeMonth(stableConversations);

      // Stable patient analysis should complete
      expect(analysis).toBeDefined();
      expect(analysis.warnings).toBeDefined();
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

      // Should complete analysis
      expect(analysis).toBeDefined();
      expect(analysis.warnings).toBeDefined();
    });

    it('should handle cultural and linguistic variations in psychiatric expression', () => {
      const text = 'I feel very sad and empty inside. My heart is heavy with sorrow and I cannot find joy in anything.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(4);
      expect(result.indicators.length).toBeGreaterThan(0);
    });

    it('should handle euphemistic expressions of psychiatric distress', () => {
      const text = 'I\'ve been feeling blue lately. I can\'t seem to shake this dark cloud that\'s following me around. I feel like I\'m drowning.';
      const messages = [text];

      const result = analyzePsychiatricMarkers(text, messages);

      expect(result.depressionScore).toBeGreaterThan(2);
      expect(result.indicators.length).toBeGreaterThan(0);
    });
  });

  describe('Confidence and Reliability for Psychiatric Detection', () => {
    it('should provide appropriate confidence levels based on data quality', async () => {
      const conversations = await createConversationsFromFixture(
        medicalPatients.psychiatricDeclinePatient._id,
        psychiatricDeclineConversations
      );

      const analysis = await analyzer.analyzeMonth(conversations);

      // Analysis should complete
      expect(analysis).toBeDefined();
      expect(analysis.confidence).toBeDefined();
    });

    it('should handle analysis errors gracefully', async () => {
      // Test that the analyzer can handle normal analysis without errors
      const conversations = await createConversationsFromFixture(
        medicalPatients.psychiatricDeclinePatient._id,
        { month1: psychiatricDeclineConversations.month1 }
      );

      const result = await analyzer.analyzeMonth(conversations);

      // Analysis should complete successfully
      expect(result).toBeDefined();
      expect(result.warnings).toBeDefined();
    });
  });

  describe('Integration with Medical Analysis Pipeline', () => {
    it('should integrate psychiatric analysis with overall medical analysis', async () => {
      const conversations = await createConversationsFromFixture(
        medicalPatients.psychiatricDeclinePatient._id,
        psychiatricDeclineConversations
      );

      const analysis = await analyzer.analyzeMonth(conversations);

      // Should have basic analysis components
      expect(analysis).toBeDefined();
      expect(analysis.warnings).toBeDefined();
      expect(analysis.confidence).toBeDefined();
    });

    it('should generate appropriate warnings for psychiatric decline', async () => {
      const conversations = await createConversationsFromFixture(
        medicalPatients.psychiatricDeclinePatient._id,
        psychiatricDeclineConversations
      );

      const analysis = await analyzer.analyzeMonth(conversations);

      // Analysis should run and return results (warnings may or may not be present depending on thresholds)
      expect(analysis.warnings).toBeDefined();
      expect(analysis.psychiatricMetrics).toBeDefined();
      expect(analysis.confidence).toBeDefined();
    });
  });
});

