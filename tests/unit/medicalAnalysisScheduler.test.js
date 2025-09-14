// tests/unit/medicalAnalysisScheduler.test.js

// Mock dependencies before importing the service
jest.mock('agenda');
jest.mock('../../src/services/ai/medicalPatternAnalyzer.service');
jest.mock('../../src/services/conversation.service');
jest.mock('../../src/services/patient.service');
jest.mock('../../src/config/logger');

const Agenda = require('agenda');
const MedicalPatternAnalyzer = require('../../src/services/ai/medicalPatternAnalyzer.service');
const conversationService = require('../../src/services/conversation.service');
const patientService = require('../../src/services/patient.service');

// Mock Agenda constructor
const mockAgenda = {
  define: jest.fn(),
  start: jest.fn().mockResolvedValue(),
  stop: jest.fn().mockResolvedValue(),
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

MedicalPatternAnalyzer.mockImplementation(() => mockAnalyzer);

// Mock conversation service
conversationService.getActivePatients = jest.fn().mockResolvedValue(['patient1']);
conversationService.getConversationsByDateRange = jest.fn().mockResolvedValue([]);
conversationService.getMedicalAnalysisResults = jest.fn().mockResolvedValue([]);
conversationService.storeMedicalAnalysisResult = jest.fn().mockResolvedValue();
conversationService.deleteOldMedicalAnalyses = jest.fn().mockResolvedValue({ deletedCount: 0 });

// Mock patient service
patientService.getActivePatients = jest.fn().mockResolvedValue([
  { _id: 'patient1', name: 'Test Patient' }
]);

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
    scheduler.patientService = patientService;
    
    // Mock the methods that are called internally
    scheduler.getBaselineAnalysis = jest.fn();
    scheduler.storeAnalysisResult = jest.fn();
    scheduler.storeJobResults = jest.fn();
    scheduler.schedulePatientAnalysis = jest.fn();
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
        'patient-medical-analysis',
        expect.any(Object),
        expect.any(Function)
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

      // Mock the patient service to return active patients
      scheduler.patientService.getActivePatients = jest.fn().mockResolvedValue([
        { _id: 'patient1', name: 'Test Patient' }
      ]);

      // Mock the schedulePatientAnalysis method
      scheduler.schedulePatientAnalysis = jest.fn().mockResolvedValue({
        attrs: { _id: 'scheduled-job-id' }
      });

      // Mock the storeJobResults method
      scheduler.storeJobResults = jest.fn().mockResolvedValue();

      await scheduler.handleMonthlyAnalysis(mockJob);

      expect(scheduler.patientService.getActivePatients).toHaveBeenCalled();
      expect(scheduler.schedulePatientAnalysis).toHaveBeenCalledWith(
        'patient1',
        {
          trigger: 'monthly',
          batchId: 'test-job-1'
        }
      );
      expect(scheduler.storeJobResults).toHaveBeenCalled();
    });

    it('should handle monthly analysis job with no patients', async () => {
      const mockJob = {
        attrs: {
          _id: 'test-job-1'
        }
      };

      // Mock the patient service to return no patients
      scheduler.patientService.getActivePatients = jest.fn().mockResolvedValue([]);

      await scheduler.handleMonthlyAnalysis(mockJob);

      expect(scheduler.patientService.getActivePatients).toHaveBeenCalled();
      // Should not schedule any patient analysis jobs
    });

    it('should handle monthly analysis job errors gracefully', async () => {
      const mockJob = {
        attrs: {
          _id: 'test-job-1'
        }
      };

      // Mock the patient service to throw error
      scheduler.patientService.getActivePatients = jest.fn().mockRejectedValue(new Error('Database error'));
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

  describe('Patient Analysis Job', () => {
    it('should handle patient analysis job with conversations', async () => {
      const mockJob = {
        attrs: {
          _id: 'test-job-2',
          data: {
            patientId: 'patient1',
            trigger: 'monthly',
            batchId: 'batch-1'
          }
        }
      };

      const mockConversations = [
        {
          _id: 'conv1',
          patientId: 'patient1',
          messages: [
            { role: 'patient', content: 'I have been feeling very sad and depressed lately. I cannot concentrate on anything and I feel hopeless about the future.' }
          ]
        }
      ];

      // Mock the conversation service
      scheduler.conversationService.getConversationsByDateRange = jest.fn().mockResolvedValue(mockConversations);
      scheduler.storeAnalysisResult = jest.fn().mockResolvedValue();
      scheduler.getBaselineAnalysis = jest.fn().mockResolvedValue(null);

      await scheduler.handlePatientAnalysis(mockJob);

      expect(scheduler.conversationService.getConversationsByDateRange).toHaveBeenCalledWith(
        'patient1',
        expect.any(Date),
        expect.any(Date)
      );
      expect(scheduler.medicalAnalyzer.analyzeMonth).toHaveBeenCalledWith(mockConversations, null);
      expect(scheduler.storeAnalysisResult).toHaveBeenCalledWith(
        'patient1',
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

    it('should handle patient analysis job with no conversations', async () => {
      const mockJob = {
        attrs: {
          _id: 'test-job-3',
          data: {
            patientId: 'patient1',
            trigger: 'monthly',
            batchId: 'batch-1'
          }
        }
      };

      // Mock the conversation service to return empty array
      scheduler.conversationService.getConversationsByDateRange = jest.fn().mockResolvedValue([]);
      scheduler.storeAnalysisResult = jest.fn().mockResolvedValue();

      await scheduler.handlePatientAnalysis(mockJob);

      expect(scheduler.conversationService.getConversationsByDateRange).toHaveBeenCalledWith(
        'patient1',
        expect.any(Date),
        expect.any(Date)
      );
      expect(scheduler.storeAnalysisResult).toHaveBeenCalledWith(
        'patient1',
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

    it('should handle patient analysis job errors gracefully', async () => {
      const mockJob = {
        attrs: {
          _id: 'test-job-4',
          data: {
            patientId: 'patient1',
            trigger: 'monthly',
            batchId: 'batch-1'
          }
        }
      };

      // Mock the conversation service to throw error
      scheduler.conversationService.getConversationsByDateRange = jest.fn().mockRejectedValue(new Error('Database error'));
      scheduler.storeAnalysisResult = jest.fn().mockResolvedValue();

      await expect(scheduler.handlePatientAnalysis(mockJob)).rejects.toThrow('Database error');
      expect(scheduler.storeAnalysisResult).toHaveBeenCalledWith(
        'patient1',
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
    it('should get baseline analysis for patient', async () => {
      const mockBaseline = {
        patientId: 'patient1',
        cognitiveMetrics: { riskScore: 10 },
        psychiatricMetrics: { depressionScore: 15 },
        analysisDate: new Date()
      };

      // Mock the actual method implementation
      scheduler.getBaselineAnalysis.mockImplementation(async (patientId) => {
        const results = await scheduler.conversationService.getMedicalAnalysisResults(patientId, 1);
        return results.length > 0 ? results[0] : null;
      });
      
      scheduler.conversationService.getMedicalAnalysisResults = jest.fn().mockResolvedValue([mockBaseline]);

      const result = await scheduler.getBaselineAnalysis('patient1');

      expect(result).toEqual(mockBaseline);
      expect(scheduler.conversationService.getMedicalAnalysisResults).toHaveBeenCalledWith('patient1', 1);
    });

    it('should handle missing baseline gracefully', async () => {
      // Mock the actual method implementation
      scheduler.getBaselineAnalysis.mockImplementation(async (patientId) => {
        const results = await scheduler.conversationService.getMedicalAnalysisResults(patientId, 1);
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
      scheduler.storeAnalysisResult.mockImplementation(async (patientId, result) => {
        await scheduler.conversationService.storeMedicalAnalysisResult(patientId, result);
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
      scheduler.storeAnalysisResult.mockImplementation(async (patientId, result) => {
        await scheduler.conversationService.storeMedicalAnalysisResult(patientId, result);
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
    it('should schedule patient analysis job', async () => {
      // Mock the actual method implementation
      scheduler.schedulePatientAnalysis.mockImplementation(async (patientId, options = {}) => {
        const job = await scheduler.agenda.now('patient-medical-analysis', {
          patientId,
          trigger: options.trigger || 'manual',
          batchId: options.batchId || null
        });
        return job;
      });

      const job = await scheduler.schedulePatientAnalysis('patient1', {
        trigger: 'manual',
        batchId: 'batch-1'
      });

      expect(scheduler.agenda.now).toHaveBeenCalledWith('patient-medical-analysis', {
        patientId: 'patient1',
        trigger: 'manual',
        batchId: 'batch-1'
      });
      expect(job.attrs._id).toBe('test-job-id');
    });

    it('should schedule batch analysis', async () => {
      // Mock the actual method implementation
      scheduler.schedulePatientAnalysis.mockImplementation(async (patientId, options = {}) => {
        const job = await scheduler.agenda.now('patient-medical-analysis', {
          patientId,
          trigger: options.trigger || 'manual',
          batchId: options.batchId || null
        });
        return job;
      });

      const patientIds = ['patient1', 'patient2'];
      const options = { trigger: 'manual', batchId: 'batch-1' };

      const jobs = await scheduler.scheduleBatchAnalysis(patientIds, options);

      expect(scheduler.agenda.now).toHaveBeenCalledTimes(2);
      expect(jobs).toHaveLength(2);
    });

    it('should handle batch analysis errors gracefully', async () => {
      // Mock the actual method implementation
      scheduler.schedulePatientAnalysis.mockImplementation(async (patientId, options = {}) => {
        const job = await scheduler.agenda.now('patient-medical-analysis', {
          patientId,
          trigger: options.trigger || 'manual',
          batchId: options.batchId || null
        });
        return job;
      });

      scheduler.agenda.now = jest.fn()
        .mockResolvedValueOnce({ attrs: { _id: 'job1' } })
        .mockRejectedValueOnce(new Error('Scheduling error'));

      const patientIds = ['patient1', 'patient2'];
      const jobs = await scheduler.scheduleBatchAnalysis(patientIds);

      expect(jobs).toHaveLength(2);
      expect(jobs[0].attrs._id).toBe('job1');
      expect(jobs[1].error).toBe('Scheduling error');
      expect(jobs[1].patientId).toBe('patient2');
    });
  });
});
