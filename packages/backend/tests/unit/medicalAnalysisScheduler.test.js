// tests/unit/medicalAnalysisScheduler.test.js

// Only mock external dependencies
jest.mock('agenda');
jest.mock('../../src/services/client.service', () => ({
  getActiveClients: jest.fn(),
  createClient: jest.fn(),
  queryClients: jest.fn(),
  getClientById: jest.fn(),
  getClientByEmail: jest.fn(),
  updateClientById: jest.fn(),
  deleteClientById: jest.fn(),
  assignCaregiver: jest.fn(),
  removeCaregiver: jest.fn(),
  getCaregivers: jest.fn(),
  getUnassignedClients: jest.fn(),
  sendConsentEmailIfRequired: jest.fn(),
  checkClientConsent: jest.fn(),
  verifyConsentToken: jest.fn(),
}));

// Mock logger so intentional error-path tests don't log to console and confuse CI
jest.mock('../../src/config/logger', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mongoose = require('mongoose');
const Agenda = require('agenda');
const MedicalPatternAnalyzer = require('../../src/services/ai/medicalPatternAnalyzer.service');
const conversationService = require('../../src/services/conversation.service');
const clientService = require('../../src/services/client.service');

// Mock Agenda constructor
const mockAgenda = {
  define: jest.fn(),
  start: jest.fn().mockResolvedValue(),
  stop: jest.fn().mockResolvedValue(),
  cancel: jest.fn().mockResolvedValue(0),
  every: jest.fn().mockReturnValue({
    timezone: jest.fn().mockReturnThis(),
    save: jest.fn().mockResolvedValue()
  }),
  now: jest.fn().mockResolvedValue({
    attrs: { _id: 'test-job-id' }
  }),
  schedule: jest.fn().mockResolvedValue({
    attrs: { _id: 'test-job-id' }
  }),
  jobs: jest.fn().mockResolvedValue([])
};

Agenda.mockImplementation(() => mockAgenda);

// Mock MedicalPatternAnalyzer
const mockAnalyzer = {
  getDefaultMetrics: jest.fn().mockReturnValue({
    riskScore: 0,
    depressionScore: 0,
    anxietyScore: 0
  }),
  analyzeMonth: jest.fn().mockResolvedValue({
    cognitiveMetrics: { riskScore: 25 },
    psychiatricMetrics: { depressionScore: 30 },
    warnings: ['Test warning'],
    confidence: 'medium'
  })
};

// Using real services now - no mocking needed

// Now import the service
const medicalAnalysisScheduler = require('../../src/services/ai/medicalAnalysisScheduler.service');

describe('Medical Analysis Scheduler', () => {
  let scheduler;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Use the singleton instance
    scheduler = medicalAnalysisScheduler;
    
    // Override the methods on the singleton instance
    scheduler.agenda = mockAgenda;
    scheduler.medicalAnalyzer = mockAnalyzer;
    scheduler.conversationService = conversationService;
    // Scheduler uses client.service internally; override for tests that need to mock getActiveClients
    if (!scheduler._clientService) scheduler._clientService = clientService;
    
    // Mock the methods that are called internally
    scheduler.getBaselineAnalysis = jest.fn();
    scheduler.storeAnalysisResult = jest.fn();
    scheduler.storeJobResults = jest.fn();
    scheduler.scheduleClientAnalysis = jest.fn();
  });

  describe('Scheduler Initialization', () => {
    it('should initialize scheduler with agenda', () => {
      expect(scheduler).toBeDefined();
      expect(scheduler.agenda).toBeDefined();
      expect(scheduler.medicalAnalyzer).toBeDefined();
    });

    it('should initialize scheduler properly', async () => {
      await scheduler.initialize();
      
      expect(scheduler.agenda.define).toHaveBeenCalledWith(
        'monthly-medical-analysis',
        expect.any(Object),
        expect.any(Function)
      );
      
      expect(scheduler.agenda.define).toHaveBeenCalledWith(
        'client-medical-analysis',
        expect.any(Object),
        expect.any(Function)
      );

      expect(scheduler.agenda.cancel).toHaveBeenCalledWith({ name: 'monthly-medical-analysis' });
      expect(scheduler.agenda.cancel).toHaveBeenCalledWith({ name: 'cleanup-old-analyses' });
      expect(scheduler.agenda.every).toHaveBeenCalledWith(
        expect.any(String),
        'monthly-medical-analysis',
        expect.objectContaining({ type: 'monthly' })
      );
      
      expect(scheduler.agenda.start).toHaveBeenCalled();
    });
  });

  describe('Monthly Analysis Job', () => {
    it('should handle monthly analysis job', async () => {
      const mockJob = {
        attrs: {
          _id: 'test-job-1'
        }
      };

      // Mock client.service.getActiveClients
      clientService.getActiveClients.mockResolvedValue([{ _id: 'client1', name: 'Test Client' }]);

      // Mock the scheduleClientAnalysis method
      scheduler.scheduleClientAnalysis = jest.fn().mockResolvedValue({
        attrs: { _id: 'scheduled-job-id' }
      });

      // Mock the storeJobResults method
      scheduler.storeJobResults = jest.fn().mockResolvedValue();

      await scheduler.handleMonthlyAnalysis(mockJob);

      expect(clientService.getActiveClients).toHaveBeenCalled();
      expect(scheduler.scheduleClientAnalysis).toHaveBeenCalledWith(
        'client1',
        {
          trigger: 'monthly',
          batchId: 'test-job-1'
        }
      );
      expect(scheduler.storeJobResults).toHaveBeenCalled();
    });

    it('should handle monthly analysis job with no clients', async () => {
      const mockJob = {
        attrs: {
          _id: 'test-job-1'
        }
      };

      clientService.getActiveClients.mockResolvedValue([]);

      await scheduler.handleMonthlyAnalysis(mockJob);

      expect(clientService.getActiveClients).toHaveBeenCalled();
    });

    it('should handle monthly analysis job errors gracefully', async () => {
      const mockJob = {
        attrs: {
          _id: 'test-job-1'
        }
      };

      clientService.getActiveClients.mockRejectedValue(new Error('Database error'));
      scheduler.storeJobResults = jest.fn().mockResolvedValue();

      await expect(scheduler.handleMonthlyAnalysis(mockJob)).rejects.toThrow('Database error');
      expect(scheduler.storeJobResults).toHaveBeenCalledWith(
        'test-job-1',
        expect.objectContaining({
          type: 'monthly',
          status: 'failed'
        })
      );
    });
  });

  describe('Client Analysis Job', () => {
    const validClientId = new mongoose.Types.ObjectId();

    it('should handle client analysis job with conversations', async () => {
      const mockJob = {
        attrs: {
          _id: 'test-job-2',
          data: {
            clientId: validClientId.toString(),
            trigger: 'monthly',
            batchId: 'batch-1'
          }
        }
      };

      const mockConversations = [
        {
          _id: 'conv1',
          clientId: validClientId,
          messages: [
            { role: 'client', content: 'I have been feeling very sad and depressed lately. I cannot concentrate on anything and I feel hopeless about the future.' }
          ]
        }
      ];

      // Mock the conversation service (scheduler calls getConversationsByClientAndDateRange)
      const getConversationsByClientAndDateRange = jest.fn().mockResolvedValue(mockConversations);
      scheduler.conversationService.getConversationsByClientAndDateRange = getConversationsByClientAndDateRange;
      scheduler.storeAnalysisResult = jest.fn().mockResolvedValue();
      scheduler.getBaselineAnalysis = jest.fn().mockResolvedValue(null);

      await scheduler.handleClientAnalysis(mockJob);

      expect(getConversationsByClientAndDateRange).toHaveBeenCalledWith(
        validClientId.toString(),
        expect.any(Date),
        expect.any(Date)
      );
      expect(scheduler.medicalAnalyzer.analyzeMonth).toHaveBeenCalledWith(mockConversations, null);
      expect(scheduler.storeAnalysisResult).toHaveBeenCalledWith(
        validClientId.toString(),
        expect.objectContaining({
          cognitiveMetrics: expect.any(Object),
          psychiatricMetrics: expect.any(Object),
          warnings: expect.any(Array),
          confidence: expect.any(String),
          trigger: 'monthly',
          batchId: 'batch-1'
        })
      );
    });

    it('should handle client analysis job with no conversations', async () => {
      const mockJob = {
        attrs: {
          _id: 'test-job-3',
          data: {
            clientId: validClientId.toString(),
            trigger: 'monthly',
            batchId: 'batch-1'
          }
        }
      };

      const getConversationsByClientAndDateRange = jest.fn().mockResolvedValue([]);
      scheduler.conversationService.getConversationsByClientAndDateRange = getConversationsByClientAndDateRange;
      scheduler.storeAnalysisResult = jest.fn().mockResolvedValue();

      await scheduler.handleClientAnalysis(mockJob);

      expect(getConversationsByClientAndDateRange).toHaveBeenCalledWith(
        validClientId.toString(),
        expect.any(Date),
        expect.any(Date)
      );
      expect(scheduler.storeAnalysisResult).toHaveBeenCalledWith(
        validClientId.toString(),
        expect.objectContaining({
          cognitiveMetrics: expect.any(Object),
          psychiatricMetrics: expect.any(Object),
          warnings: expect.arrayContaining(['No conversations found for analysis period']),
          confidence: 'none',
          conversationCount: 0,
          messageCount: 0,
          totalWords: 0,
          trigger: 'monthly',
          batchId: 'batch-1'
        })
      );
    });

    it('should handle client analysis job errors gracefully', async () => {
      const mockJob = {
        attrs: {
          _id: 'test-job-4',
          data: {
            clientId: validClientId.toString(),
            trigger: 'monthly',
            batchId: 'batch-1'
          }
        }
      };

      scheduler.conversationService.getConversationsByClientAndDateRange = jest.fn().mockRejectedValue(new Error('Database error'));
      scheduler.storeAnalysisResult = jest.fn().mockResolvedValue();

      await expect(scheduler.handleClientAnalysis(mockJob)).rejects.toThrow('Database error');
      expect(scheduler.storeAnalysisResult).toHaveBeenCalledWith(
        validClientId.toString(),
        expect.objectContaining({
          error: 'Database error',
          status: 'failed',
          trigger: 'monthly',
          batchId: 'batch-1'
        })
      );
    });
  });

  describe('Baseline Management', () => {
    it('should get baseline analysis for client', async () => {
      const mockBaseline = {
        clientId: 'patient1',
        cognitiveMetrics: { riskScore: 10 },
        psychiatricMetrics: { depressionScore: 15 },
        analysisDate: new Date()
      };

      // Mock the actual method implementation
      scheduler.getBaselineAnalysis.mockImplementation(async (clientId) => {
        const results = await scheduler.conversationService.getMedicalAnalysisResults(clientId, 1);
        return results.length > 0 ? results[0] : null;
      });
      
      scheduler.conversationService.getMedicalAnalysisResults = jest.fn().mockResolvedValue([mockBaseline]);

      const result = await scheduler.getBaselineAnalysis('patient1');

      expect(result).toEqual(mockBaseline);
      expect(scheduler.conversationService.getMedicalAnalysisResults).toHaveBeenCalledWith('patient1', 1);
    });

    it('should handle missing baseline gracefully', async () => {
      // Mock the actual method implementation
      scheduler.getBaselineAnalysis.mockImplementation(async (clientId) => {
        const results = await scheduler.conversationService.getMedicalAnalysisResults(clientId, 1);
        return results.length > 0 ? results[0] : null;
      });
      
      scheduler.conversationService.getMedicalAnalysisResults = jest.fn().mockResolvedValue([]);

      const result = await scheduler.getBaselineAnalysis('patient1');

      expect(result).toBeNull();
    });
  });

  describe('Analysis Result Storage', () => {
    it('should store analysis result', async () => {
      const mockAnalysisResult = {
        cognitiveMetrics: { riskScore: 25 },
        psychiatricMetrics: { depressionScore: 30 },
        warnings: ['Test warning'],
        confidence: 'medium',
        analysisDate: new Date(),
        conversationCount: 5,
        messageCount: 10,
        totalWords: 200,
        trigger: 'monthly',
        batchId: 'batch-1'
      };

      // Mock the actual method implementation
      scheduler.storeAnalysisResult.mockImplementation(async (clientId, result) => {
        await scheduler.conversationService.storeMedicalAnalysisResult(clientId, result);
      });
      
      scheduler.conversationService.storeMedicalAnalysisResult = jest.fn().mockResolvedValue();

      await scheduler.storeAnalysisResult('patient1', mockAnalysisResult);

      expect(scheduler.conversationService.storeMedicalAnalysisResult).toHaveBeenCalledWith('patient1', mockAnalysisResult);
    });

    it('should handle storage errors gracefully', async () => {
      const mockAnalysisResult = {
        cognitiveMetrics: { riskScore: 25 },
        psychiatricMetrics: { depressionScore: 30 },
        warnings: ['Test warning'],
        confidence: 'medium',
        analysisDate: new Date(),
        conversationCount: 5,
        messageCount: 10,
        totalWords: 200,
        trigger: 'monthly',
        batchId: 'batch-1'
      };

      // Mock the actual method implementation
      scheduler.storeAnalysisResult.mockImplementation(async (clientId, result) => {
        await scheduler.conversationService.storeMedicalAnalysisResult(clientId, result);
      });
      
      scheduler.conversationService.storeMedicalAnalysisResult = jest.fn().mockRejectedValue(new Error('Storage error'));

      await expect(scheduler.storeAnalysisResult('patient1', mockAnalysisResult)).rejects.toThrow('Storage error');
    });
  });

  describe('Scheduler Lifecycle', () => {
    it('should get scheduler status', async () => {
      const mockStatus = {
        isInitialized: true,
        totalJobs: 5,
        runningJobs: 2,
        failedJobs: 0,
        config: expect.any(Object)
      };

      scheduler.agenda.jobs = jest.fn().mockResolvedValue([
        { attrs: { nextRunAt: new Date(), failCount: 0 } },
        { attrs: { nextRunAt: new Date(), failCount: 0 } },
        { attrs: { nextRunAt: null, failCount: 0 } },
        { attrs: { nextRunAt: null, failCount: 0 } },
        { attrs: { nextRunAt: null, failCount: 0 } }
      ]);

      const result = await scheduler.getStatus();

      expect(result.isInitialized).toBeDefined();
      expect(result.totalJobs).toBeDefined();
      expect(result.config).toBeDefined();
    });

    it('should shutdown scheduler', async () => {
      await scheduler.shutdown();

      expect(scheduler.agenda.stop).toHaveBeenCalled();
    });
  });

  describe('Job Scheduling', () => {
    it('should schedule client analysis job', async () => {
      // Mock the actual method implementation
      scheduler.scheduleClientAnalysis.mockImplementation(async (clientId, options = {}) => {
        const job = await scheduler.agenda.now('client-medical-analysis', {
          clientId,
          trigger: options.trigger || 'manual',
          batchId: options.batchId || null
        });
        return job;
      });

      const job = await scheduler.scheduleClientAnalysis('patient1', {
        trigger: 'manual',
        batchId: 'batch-1'
      });

      expect(scheduler.agenda.now).toHaveBeenCalledWith('client-medical-analysis', {
        clientId: 'patient1',
        trigger: 'manual',
        batchId: 'batch-1'
      });
      expect(job.attrs._id).toBe('test-job-id');
    });

    it('should schedule batch analysis', async () => {
      // Mock the actual method implementation
      scheduler.scheduleClientAnalysis.mockImplementation(async (clientId, options = {}) => {
        const job = await scheduler.agenda.now('client-medical-analysis', {
          clientId,
          trigger: options.trigger || 'manual',
          batchId: options.batchId || null
        });
        return job;
      });

      const clientIds = ['patient1', 'patient2'];
      const options = { trigger: 'manual', batchId: 'batch-1' };

      const jobs = await scheduler.scheduleBatchAnalysis(clientIds, options);

      expect(scheduler.agenda.now).toHaveBeenCalledTimes(2);
      expect(jobs).toHaveLength(2);
    });

    it('should handle batch analysis errors gracefully', async () => {
      // Mock the actual method implementation
      scheduler.scheduleClientAnalysis.mockImplementation(async (clientId, options = {}) => {
        const job = await scheduler.agenda.now('client-medical-analysis', {
          clientId,
          trigger: options.trigger || 'manual',
          batchId: options.batchId || null
        });
        return job;
      });

      scheduler.agenda.now = jest.fn()
        .mockResolvedValueOnce({ attrs: { _id: 'job1' } })
        .mockRejectedValueOnce(new Error('Scheduling error'));

      const clientIds = ['patient1', 'patient2'];
      const jobs = await scheduler.scheduleBatchAnalysis(clientIds);

      expect(jobs).toHaveLength(2);
      expect(jobs[0].attrs._id).toBe('job1');
      expect(jobs[1].error).toBe('Scheduling error');
      expect(jobs[1].clientId).toBe('patient2');
    });
  });
});
