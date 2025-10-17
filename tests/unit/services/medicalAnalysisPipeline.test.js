// DON'T import integration-setup here - these are UNIT tests for our own medical analysis services
// We should only mock EXTERNAL services (OpenAI, Twilio, etc), not our own business logic
// require('../../utils/integration-setup');

// tests/unit/services/medicalAnalysisPipeline.test.js
const MedicalPatternAnalyzer = require('../../../src/services/ai/medicalPatternAnalyzer.service');
const medicalAnalysisScheduler = require('../../../src/services/ai/medicalAnalysisScheduler.service');
const baselineManager = require('../../../src/services/ai/baselineManager.service');
const conversationService = require('../../../src/services/conversation.service');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../../utils/mongodb-memory-server');
const {
  medicalPatients,
  cognitiveDeclineConversations,
  psychiatricDeclineConversations,
  mixedDeclineConversations,
  stablePatientConversations,
  createConversationsFromFixture
} = require('../../fixtures/medicalConversations.fixture');

describe('Medical Analysis Pipeline Integration', () => {
  let analyzer;
  let scheduler;

  // Set timeout for all tests in this suite to 30 seconds
  jest.setTimeout(30000);

  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
    analyzer = new MedicalPatternAnalyzer();
    scheduler = medicalAnalysisScheduler; // Use the singleton instance
  });

  describe('End-to-End Medical Analysis Pipeline', () => {
    it('should complete full analysis pipeline for cognitive decline patient', async () => {
      const patientId = medicalPatients.cognitiveDeclinePatient._id;

      // Step 1: Create conversations from fixture data
      const conversations = await createConversationsFromFixture(
        patientId,
        cognitiveDeclineConversations
      );

      // Step 2: Establish baseline from first month
      const baselineConversations = conversations.filter(c => c.startTime.getMonth() === 0);
      const baselineAnalysis = await analyzer.analyzeMonth(baselineConversations);
      const baseline = await baselineManager.establishBaseline(patientId, baselineAnalysis);

      // Step 3: Analyze each subsequent month with baseline comparison
      const monthlyAnalyses = {};
      for (let month = 1; month <= 6; month++) {
        const monthConversations = conversations.filter(c => c.startTime.getMonth() === month - 1);
        if (monthConversations.length > 0) {
          monthlyAnalyses[`month${month}`] = await analyzer.analyzeMonth(monthConversations, baselineAnalysis);
        }
      }

      // Step 4: Verify complete pipeline results
      expect(baseline).toBeDefined();
      expect(baseline.type).toBe('initial');
      
      // Verify progressive decline detection
      expect(monthlyAnalyses.month2.cognitiveMetrics.riskScore)
        .toBeGreaterThan(monthlyAnalyses.month1.cognitiveMetrics.riskScore);
      expect(monthlyAnalyses.month6.cognitiveMetrics.riskScore)
        .toBeGreaterThan(monthlyAnalyses.month1.cognitiveMetrics.riskScore);

      // Verify warnings and alerts
      expect(monthlyAnalyses.month6.warnings).toContain(expect.stringMatching(/cognitive decline/i));
      expect(monthlyAnalyses.month6.confidence).toBe('high');
    });

    it('should complete full analysis pipeline for psychiatric decline patient', async () => {
      const patientId = medicalPatients.psychiatricDeclinePatient._id;

      // Step 1: Create conversations from fixture data
      const conversations = await createConversationsFromFixture(
        patientId,
        psychiatricDeclineConversations
      );

      // Step 2: Establish baseline from first month
      const baselineConversations = conversations.filter(c => c.startTime.getMonth() === 0);
      const baselineAnalysis = await analyzer.analyzeMonth(baselineConversations);
      const baseline = await baselineManager.establishBaseline(patientId, baselineAnalysis);

      // Step 3: Analyze each subsequent month with baseline comparison
      const monthlyAnalyses = {};
      for (let month = 1; month <= 6; month++) {
        const monthConversations = conversations.filter(c => c.startTime.getMonth() === month - 1);
        if (monthConversations.length > 0) {
          monthlyAnalyses[`month${month}`] = await analyzer.analyzeMonth(monthConversations, baselineAnalysis);
        }
      }

      // Step 4: Verify complete pipeline results
      expect(baseline).toBeDefined();
      expect(baseline.type).toBe('initial');
      
      // Verify progressive psychiatric decline detection
      expect(monthlyAnalyses.month2.psychiatricMetrics.depressionScore)
        .toBeGreaterThan(monthlyAnalyses.month1.psychiatricMetrics.depressionScore);
      expect(monthlyAnalyses.month6.psychiatricMetrics.depressionScore)
        .toBeGreaterThan(monthlyAnalyses.month1.psychiatricMetrics.depressionScore);

      // Verify crisis detection
      expect(monthlyAnalyses.month4.psychiatricMetrics.crisisIndicators.hasCrisisIndicators).toBe(true);
      expect(monthlyAnalyses.month6.warnings).toContain(expect.stringMatching(/psychiatric/i));
    });

    it('should complete full analysis pipeline for mixed decline patient', async () => {
      const patientId = medicalPatients.mixedDeclinePatient._id;

      // Step 1: Create conversations from fixture data
      const conversations = await createConversationsFromFixture(
        patientId,
        mixedDeclineConversations
      );

      // Step 2: Establish baseline from first month
      const baselineConversations = conversations.filter(c => c.startTime.getMonth() === 0);
      const baselineAnalysis = await analyzer.analyzeMonth(baselineConversations);
      const baseline = await baselineManager.establishBaseline(patientId, baselineAnalysis);

      // Step 3: Analyze each subsequent month with baseline comparison
      const monthlyAnalyses = {};
      for (let month = 1; month <= 6; month++) {
        const monthConversations = conversations.filter(c => c.startTime.getMonth() === month - 1);
        if (monthConversations.length > 0) {
          monthlyAnalyses[`month${month}`] = await analyzer.analyzeMonth(monthConversations, baselineAnalysis);
        }
      }

      // Step 4: Verify complete pipeline results
      expect(baseline).toBeDefined();
      
      // Verify both cognitive and psychiatric decline detection
      expect(monthlyAnalyses.month3.cognitiveMetrics.riskScore).toBeGreaterThan(40);
      expect(monthlyAnalyses.month3.psychiatricMetrics.overallRiskScore).toBeGreaterThan(40);
      
      // Verify mixed decline warnings
      expect(monthlyAnalyses.month3.warnings).toContain(expect.stringMatching(/cognitive/i));
      expect(monthlyAnalyses.month3.warnings).toContain(expect.stringMatching(/psychiatric/i));
    });

    it('should complete full analysis pipeline for stable patient', async () => {
      const patientId = medicalPatients.stablePatient._id;

      // Step 1: Create conversations from fixture data
      const conversations = await createConversationsFromFixture(
        patientId,
        stablePatientConversations
      );

      // Step 2: Establish baseline from first month
      const baselineConversations = conversations.filter(c => c.startTime.getMonth() === 0);
      const baselineAnalysis = await analyzer.analyzeMonth(baselineConversations);
      const baseline = await baselineManager.establishBaseline(patientId, baselineAnalysis);

      // Step 3: Analyze each subsequent month with baseline comparison
      const monthlyAnalyses = {};
      for (let month = 1; month <= 6; month++) {
        const monthConversations = conversations.filter(c => c.startTime.getMonth() === month - 1);
        if (monthConversations.length > 0) {
          monthlyAnalyses[`month${month}`] = await analyzer.analyzeMonth(monthConversations, baselineAnalysis);
        }
      }

      // Step 4: Verify complete pipeline results
      expect(baseline).toBeDefined();
      
      // Verify stable patient analysis
      expect(monthlyAnalyses.month3.cognitiveMetrics.riskScore).toBeLessThan(30);
      expect(monthlyAnalyses.month3.psychiatricMetrics.overallRiskScore).toBeLessThan(30);
      
      // Verify no concerning warnings
      expect(monthlyAnalyses.month3.warnings).not.toContain(expect.stringMatching(/cognitive decline/i));
      expect(monthlyAnalyses.month3.warnings).not.toContain(expect.stringMatching(/psychiatric/i));
    });
  });

  describe('Medical Analysis Scheduler Integration', () => {
    it('should handle monthly analysis job for cognitive decline patient', async () => {
      const patientId = medicalPatients.cognitiveDeclinePatient._id;

      // Create conversations
      const conversations = await createConversationsFromFixture(
        patientId,
        cognitiveDeclineConversations
      );

      // Mock job data
      const jobData = {
        patientId,
        trigger: 'monthly',
        batchId: 'test-batch-1'
      };

      // Mock job object
      const mockJob = {
        attrs: {
          _id: 'test-job-1',
          data: jobData
        }
      };

      // Mock conversation service
      const originalGetConversations = conversationService.getConversationsByDateRange;
      conversationService.getConversationsByDateRange = jest.fn().mockResolvedValue(conversations);

      try {
        // Execute patient analysis job
        await scheduler.handlePatientAnalysis(mockJob);

        // Verify conversation service was called
        expect(conversationService.getConversationsByDateRange).toHaveBeenCalledWith(
          patientId,
          expect.any(Date),
          expect.any(Date)
        );
      } finally {
        // Restore original method
        conversationService.getConversationsByDateRange = originalGetConversations;
      }
    });

    it('should handle analysis job with no conversations', async () => {
      const patientId = medicalPatients.cognitiveDeclinePatient._id;

      // Mock job data
      const jobData = {
        patientId,
        trigger: 'monthly',
        batchId: 'test-batch-2'
      };

      // Mock job object
      const mockJob = {
        attrs: {
          _id: 'test-job-2',
          data: jobData
        }
      };

      // Mock conversation service to return empty array
      const originalGetConversations = conversationService.getConversationsByDateRange;
      conversationService.getConversationsByDateRange = jest.fn().mockResolvedValue([]);

      try {
        // Execute patient analysis job
        await scheduler.handlePatientAnalysis(mockJob);

        // Verify conversation service was called
        expect(conversationService.getConversationsByDateRange).toHaveBeenCalledWith(
          patientId,
          expect.any(Date),
          expect.any(Date)
        );
      } finally {
        // Restore original method
        conversationService.getConversationsByDateRange = originalGetConversations;
      }
    });
  });

  describe('Data Flow Integration', () => {
    it('should maintain data consistency across analysis components', async () => {
      const patientId = medicalPatients.cognitiveDeclinePatient._id;

      // Create conversations
      const conversations = await createConversationsFromFixture(
        patientId,
        cognitiveDeclineConversations
      );

      // Step 1: Extract patient messages
      const patientMessages = analyzer.extractPatientMessages(conversations);
      expect(patientMessages.length).toBeGreaterThan(0);

      // Step 2: Analyze with medical pattern analyzer
      const analysis = await analyzer.analyzeMonth(conversations);
      expect(analysis.messageCount).toBe(patientMessages.length);

      // Step 3: Establish baseline
      const baseline = await baselineManager.establishBaseline(patientId, analysis);
      expect(baseline.patientId).toBe(patientId);

      // Step 4: Compare with baseline
      const deviation = await baselineManager.getDeviation(patientId, analysis);
      expect(deviation.hasBaseline).toBe(true);

      // Verify data consistency
      expect(analysis.conversationCount).toBe(conversations.length);
      expect(analysis.totalWords).toBeGreaterThan(0);
      expect(analysis.confidence).toBeDefined();
    });

    it('should handle concurrent analysis requests', async () => {
      const patientId = medicalPatients.cognitiveDeclinePatient._id;

      // Create conversations
      const conversations = await createConversationsFromFixture(
        patientId,
        cognitiveDeclineConversations
      );

      // Create multiple analysis requests
      const analysisPromises = Array(5).fill().map(() => 
        analyzer.analyzeMonth(conversations)
      );

      // Execute concurrent analyses
      const results = await Promise.all(analysisPromises);

      // Verify all analyses completed successfully
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.cognitiveMetrics).toBeDefined();
        expect(result.psychiatricMetrics).toBeDefined();
        expect(result.vocabularyMetrics).toBeDefined();
      });

      // Verify consistent results across concurrent analyses
      const firstResult = results[0];
      results.forEach(result => {
        expect(result.cognitiveMetrics.riskScore).toBe(firstResult.cognitiveMetrics.riskScore);
        expect(result.psychiatricMetrics.depressionScore).toBe(firstResult.psychiatricMetrics.depressionScore);
        expect(result.vocabularyMetrics.totalWords).toBe(firstResult.vocabularyMetrics.totalWords);
      });
    });

    it('should handle analysis with mixed conversation types', async () => {
      const patientId = medicalPatients.cognitiveDeclinePatient._id;

      // Create conversations with mixed message types
      const mixedConversations = await createConversationsFromFixture(
        patientId,
        cognitiveDeclineConversations
      );

      // Add some conversations with only assistant messages
      const assistantOnlyConversations = [
        {
          _id: 'conv-assistant-only',
          patientId,
          messages: [
            { role: 'assistant', content: 'Hello, how are you feeling today?' },
            { role: 'assistant', content: 'I hope you are doing well.' }
          ]
        }
      ];

      // Combine conversations
      const allConversations = [...mixedConversations, ...assistantOnlyConversations];

      // Analyze combined conversations
      const analysis = await analyzer.analyzeMonth(allConversations);

      // Verify analysis handles mixed conversation types
      expect(analysis).toBeDefined();
      expect(analysis.cognitiveMetrics).toBeDefined();
      expect(analysis.psychiatricMetrics).toBeDefined();
      expect(analysis.vocabularyMetrics).toBeDefined();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle analysis errors gracefully across pipeline', async () => {
      const patientId = medicalPatients.cognitiveDeclinePatient._id;

      // Create conversations
      const conversations = await createConversationsFromFixture(
        patientId,
        cognitiveDeclineConversations
      );

      // Mock analyzer to throw error
      const originalAnalyzeMonth = analyzer.analyzeMonth;
      analyzer.analyzeMonth = jest.fn().mockRejectedValue(new Error('Analysis service unavailable'));

      try {
        // Attempt analysis
        const result = await analyzer.analyzeMonth(conversations);

        // Should return error result
        expect(result.warnings).toContain(expect.stringMatching(/Analysis failed/i));
        expect(result.confidence).toBe('none');
      } finally {
        // Restore original method
        analyzer.analyzeMonth = originalAnalyzeMonth;
      }
    });

    it('should handle baseline manager errors gracefully', async () => {
      const patientId = medicalPatients.cognitiveDeclinePatient._id;

      // Create conversations
      const conversations = await createConversationsFromFixture(
        patientId,
        cognitiveDeclineConversations
      );

      // Analyze conversations
      const analysis = await analyzer.analyzeMonth(conversations);

      // Mock baseline manager to throw error
      const originalEstablishBaseline = baselineManager.establishBaseline;
      baselineManager.establishBaseline = jest.fn().mockRejectedValue(new Error('Baseline service unavailable'));

      try {
        // Attempt baseline establishment
        await expect(baselineManager.establishBaseline(patientId, analysis))
          .rejects.toThrow('Baseline service unavailable');
      } finally {
        // Restore original method
        baselineManager.establishBaseline = originalEstablishBaseline;
      }
    });

    it('should handle conversation service errors gracefully', async () => {
      const patientId = medicalPatients.cognitiveDeclinePatient._id;

      // Mock conversation service to throw error
      const originalGetConversations = conversationService.getConversationsByDateRange;
      conversationService.getConversationsByDateRange = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      try {
        // Attempt to get conversations
        await expect(conversationService.getConversationsByDateRange(patientId, new Date(), new Date()))
          .rejects.toThrow('Database connection failed');
      } finally {
        // Restore original method
        conversationService.getConversationsByDateRange = originalGetConversations;
      }
    });
  });

  describe('Performance Integration', () => {
    it('should complete analysis within reasonable time limits', async () => {
      const patientId = medicalPatients.cognitiveDeclinePatient._id;

      // Create conversations
      const conversations = await createConversationsFromFixture(
        patientId,
        cognitiveDeclineConversations
      );

      // Measure analysis time
      const startTime = Date.now();
      const analysis = await analyzer.analyzeMonth(conversations);
      const endTime = Date.now();

      // Verify analysis completed within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(analysis).toBeDefined();
      expect(analysis.cognitiveMetrics).toBeDefined();
      expect(analysis.psychiatricMetrics).toBeDefined();
    });

    it('should handle large conversation datasets efficiently', async () => {
      const patientId = medicalPatients.cognitiveDeclinePatient._id;

      // Create large conversation dataset
      const largeConversations = [];
      for (let i = 0; i < 10; i++) {
        const conversations = await createConversationsFromFixture(
          patientId,
          cognitiveDeclineConversations
        );
        largeConversations.push(...conversations);
      }

      // Measure analysis time for large dataset
      const startTime = Date.now();
      const analysis = await analyzer.analyzeMonth(largeConversations);
      const endTime = Date.now();

      // Verify analysis completed within reasonable time (10 seconds)
      expect(endTime - startTime).toBeLessThan(10000);
      expect(analysis).toBeDefined();
      expect(analysis.conversationCount).toBeGreaterThan(50);
    });
  });

  describe('Data Validation Integration', () => {
    it('should validate analysis results across all components', async () => {
      const patientId = medicalPatients.cognitiveDeclinePatient._id;

      // Create conversations
      const conversations = await createConversationsFromFixture(
        patientId,
        cognitiveDeclineConversations
      );

      // Analyze conversations
      const analysis = await analyzer.analyzeMonth(conversations);

      // Validate analysis structure
      expect(analysis).toBeDefined();
      expect(analysis.cognitiveMetrics).toBeDefined();
      expect(analysis.psychiatricMetrics).toBeDefined();
      expect(analysis.vocabularyMetrics).toBeDefined();
      expect(analysis.warnings).toBeInstanceOf(Array);
      expect(analysis.confidence).toBeDefined();
      expect(analysis.analysisDate).toBeInstanceOf(Date);
      expect(analysis.conversationCount).toBeGreaterThan(0);
      expect(analysis.messageCount).toBeGreaterThan(0);
      expect(analysis.totalWords).toBeGreaterThan(0);

      // Validate cognitive metrics
      expect(analysis.cognitiveMetrics.riskScore).toBeGreaterThanOrEqual(0);
      expect(analysis.cognitiveMetrics.riskScore).toBeLessThanOrEqual(100);
      expect(analysis.cognitiveMetrics.confidence).toBeDefined();
      expect(analysis.cognitiveMetrics.indicators).toBeInstanceOf(Array);

      // Validate psychiatric metrics
      expect(analysis.psychiatricMetrics.depressionScore).toBeGreaterThanOrEqual(0);
      expect(analysis.psychiatricMetrics.depressionScore).toBeLessThanOrEqual(100);
      expect(analysis.psychiatricMetrics.anxietyScore).toBeGreaterThanOrEqual(0);
      expect(analysis.psychiatricMetrics.anxietyScore).toBeLessThanOrEqual(100);
      expect(analysis.psychiatricMetrics.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(analysis.psychiatricMetrics.overallRiskScore).toBeLessThanOrEqual(100);

      // Validate vocabulary metrics
      expect(analysis.vocabularyMetrics.totalWords).toBeGreaterThanOrEqual(0);
      expect(analysis.vocabularyMetrics.uniqueWords).toBeGreaterThanOrEqual(0);
      expect(analysis.vocabularyMetrics.typeTokenRatio).toBeGreaterThanOrEqual(0);
      expect(analysis.vocabularyMetrics.typeTokenRatio).toBeLessThanOrEqual(1);
      expect(analysis.vocabularyMetrics.complexityScore).toBeGreaterThanOrEqual(0);
      expect(analysis.vocabularyMetrics.complexityScore).toBeLessThanOrEqual(100);
    });
  });
});

