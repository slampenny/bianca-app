// src/services/ai/medicalAnalysisScheduler.service.js

const Agenda = require('agenda');
const MedicalPatternAnalyzer = require('./medicalPatternAnalyzer.service');
const conversationService = require('../conversation.service');
const patientService = require('../patient.service');
const logger = require('../../config/logger');
const config = require('../../config/config');

/**
 * Medical Analysis Scheduler Service
 * Manages scheduled medical pattern analysis using Agenda
 */
class MedicalAnalysisScheduler {
  constructor() {
    this.agenda = new Agenda({
      db: { address: config.mongoose.url },
      collection: 'medicalAnalysisJobs'
    });
    
    this.medicalAnalyzer = new MedicalPatternAnalyzer();
    this.isInitialized = false;
    
    // Job configuration
    this.config = {
      analysisSchedule: '0 9 1 * *', // 1st day of every month at 9 AM
      retryAttempts: 3,
      retryDelay: 30000, // 30 seconds
      batchSize: 50, // Process patients in batches
      maxConcurrency: 5 // Maximum concurrent analysis jobs
    };
  }

  /**
   * Initialize the scheduler and define jobs
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        logger.log('MedicalAnalysisScheduler already initialized');
        return;
      }

      // Define the monthly medical analysis job
      this.agenda.define('monthly-medical-analysis', {
        concurrency: this.config.maxConcurrency,
        attempts: this.config.retryAttempts,
        backoff: {
          type: 'exponential',
          delay: this.config.retryDelay
        }
      }, this.handleMonthlyAnalysis.bind(this));

      // Define individual patient analysis job
      this.agenda.define('patient-medical-analysis', {
        concurrency: this.config.maxConcurrency,
        attempts: this.config.retryAttempts,
        backoff: {
          type: 'exponential',
          delay: this.config.retryDelay
        }
      }, this.handlePatientAnalysis.bind(this));

      // Define cleanup job for old analysis results
      this.agenda.define('cleanup-old-analyses', {
        attempts: 1
      }, this.handleCleanup.bind(this));

      // Start Agenda
      await this.agenda.start();
      
      // Schedule recurring jobs
      await this.scheduleRecurringJobs();
      
      this.isInitialized = true;
      logger.info('MedicalAnalysisScheduler initialized successfully');

    } catch (error) {
      logger.error('Error initializing MedicalAnalysisScheduler:', error);
      throw error;
    }
  }

  /**
   * Schedule recurring jobs
   */
  async scheduleRecurringJobs() {
    try {
      // Schedule monthly analysis (1st of every month at 9 AM)
      await this.agenda.every(this.config.analysisSchedule, 'monthly-medical-analysis', {
        type: 'monthly',
        description: 'Monthly medical pattern analysis for all patients'
      });

      // Schedule cleanup job (1st of every month at 10 PM)
      await this.agenda.every('0 22 1 * *', 'cleanup-old-analyses', {
        type: 'cleanup',
        description: 'Cleanup old medical analysis results'
      });

      logger.info('Recurring medical analysis jobs scheduled');
    } catch (error) {
      logger.error('Error scheduling recurring jobs:', error);
      throw error;
    }
  }

  /**
   * Handle monthly medical analysis job
   * @param {Object} job - Agenda job object
   */
  async handleMonthlyAnalysis(job) {
    const startTime = Date.now();
    logger.info('Starting monthly medical analysis job', { jobId: job.attrs._id });

    try {
      // Get all active patients
      const patients = await patientService.getActivePatients();
      logger.info(`Found ${patients.length} active patients for analysis`);

      if (patients.length === 0) {
        logger.info('No active patients found, skipping monthly analysis');
        return;
      }

      // Process patients in batches
      const batches = this.createBatches(patients, this.config.batchSize);
      let totalProcessed = 0;
      let totalErrors = 0;

      for (const batch of batches) {
        const batchPromises = batch.map(patient => 
          this.schedulePatientAnalysis(patient._id.toString(), {
            trigger: 'monthly',
            batchId: job.attrs._id.toString()
          })
        );

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            totalProcessed++;
          } else {
            totalErrors++;
            logger.error('Error in batch processing:', result.reason);
          }
        });

        // Small delay between batches to avoid overwhelming the system
        await this.delay(1000);
      }

      const duration = Date.now() - startTime;
      logger.info('Monthly medical analysis job completed', {
        jobId: job.attrs._id,
        totalPatients: patients.length,
        processed: totalProcessed,
        errors: totalErrors,
        duration: `${duration}ms`
      });

      // Store job results
      await this.storeJobResults(job.attrs._id.toString(), {
        type: 'monthly',
        totalPatients: patients.length,
        processed: totalProcessed,
        errors: totalErrors,
        duration,
        status: totalErrors === 0 ? 'completed' : 'completed_with_errors'
      });

    } catch (error) {
      logger.error('Error in monthly medical analysis job:', error);
      
      await this.storeJobResults(job.attrs._id.toString(), {
        type: 'monthly',
        error: error.message,
        status: 'failed'
      });
      
      throw error;
    }
  }

  /**
   * Handle individual patient analysis job
   * @param {Object} job - Agenda job object
   */
  async handlePatientAnalysis(job) {
    const { patientId, trigger, batchId } = job.attrs.data;
    logger.info('Starting patient medical analysis', { 
      jobId: job.attrs._id, 
      patientId, 
      trigger, 
      batchId 
    });

    try {
      // Get patient conversations from the last month
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);

      const conversations = await conversationService.getConversationsByPatientAndDateRange(
        patientId,
        startDate,
        endDate
      );

      if (conversations.length === 0) {
        logger.info(`No conversations found for patient ${patientId} in the last month`);
        
        // Store empty analysis result
        await this.storeAnalysisResult(patientId, {
          cognitiveMetrics: this.medicalAnalyzer.getDefaultMetrics(),
          psychiatricMetrics: this.medicalAnalyzer.getDefaultMetrics(),
          warnings: ['No conversations found for analysis period'],
          confidence: 'none',
          analysisDate: new Date(),
          conversationCount: 0,
          messageCount: 0,
          totalWords: 0,
          trigger,
          batchId
        });

        return;
      }

      // Get baseline analysis (previous month's result)
      const baseline = await this.getBaselineAnalysis(patientId);

      // Perform medical pattern analysis
      const analysisResult = await this.medicalAnalyzer.analyzeMonth(conversations, baseline);

      // Store analysis result
      await this.storeAnalysisResult(patientId, {
        ...analysisResult,
        trigger,
        batchId
      });

      logger.info('Patient medical analysis completed', {
        jobId: job.attrs._id,
        patientId,
        conversationCount: conversations.length,
        confidence: analysisResult.confidence,
        warnings: analysisResult.warnings.length
      });

    } catch (error) {
      logger.error('Error in patient medical analysis:', error, {
        jobId: job.attrs._id,
        patientId
      });
      
      // Store error result
      await this.storeAnalysisResult(patientId, {
        error: error.message,
        status: 'failed',
        analysisDate: new Date(),
        trigger,
        batchId
      });
      
      throw error;
    }
  }

  /**
   * Handle cleanup of old analysis results
   * @param {Object} job - Agenda job object
   */
  async handleCleanup(job) {
    logger.info('Starting cleanup of old medical analysis results', { jobId: job.attrs._id });

    try {
      // Remove analysis results older than 12 months
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 12);

      const result = await conversationService.deleteOldMedicalAnalyses(cutoffDate);
      
      logger.info('Cleanup completed', {
        jobId: job.attrs._id,
        deletedCount: result.deletedCount
      });

    } catch (error) {
      logger.error('Error in cleanup job:', error);
      throw error;
    }
  }

  /**
   * Schedule analysis for a specific patient
   * @param {string} patientId - Patient ID
   * @param {Object} options - Scheduling options
   * @returns {Promise} Job promise
   */
  async schedulePatientAnalysis(patientId, options = {}) {
    try {
      const job = await this.agenda.now('patient-medical-analysis', {
        patientId,
        trigger: options.trigger || 'manual',
        batchId: options.batchId || null
      });

      logger.info('Scheduled patient medical analysis', { 
        jobId: job.attrs._id, 
        patientId,
        trigger: options.trigger 
      });

      return job;
    } catch (error) {
      logger.error('Error scheduling patient analysis:', error);
      throw error;
    }
  }

  /**
   * Schedule analysis for multiple patients
   * @param {Array} patientIds - Array of patient IDs
   * @param {Object} options - Scheduling options
   * @returns {Promise} Array of job promises
   */
  async scheduleBatchAnalysis(patientIds, options = {}) {
    const jobs = [];
    
    for (const patientId of patientIds) {
      try {
        const job = await this.schedulePatientAnalysis(patientId, options);
        jobs.push(job);
      } catch (error) {
        logger.error(`Error scheduling analysis for patient ${patientId}:`, error);
        jobs.push({ error: error.message, patientId });
      }
    }

    return jobs;
  }

  /**
   * Get analysis results for a patient
   * @param {string} patientId - Patient ID
   * @param {number} limit - Maximum number of results to return
   * @returns {Promise} Analysis results
   */
  async getPatientAnalysisResults(patientId, limit = 10) {
    try {
      return await conversationService.getMedicalAnalysisResults(patientId, limit);
    } catch (error) {
      logger.error('Error getting patient analysis results:', error);
      throw error;
    }
  }

  /**
   * Get baseline analysis for comparison
   * @param {string} patientId - Patient ID
   * @returns {Promise} Baseline analysis or null
   */
  async getBaselineAnalysis(patientId) {
    try {
      const results = await conversationService.getMedicalAnalysisResults(patientId, 1);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      logger.error('Error getting baseline analysis:', error);
      return null;
    }
  }

  /**
   * Store analysis result
   * @param {string} patientId - Patient ID
   * @param {Object} result - Analysis result
   */
  async storeAnalysisResult(patientId, result) {
    try {
      await conversationService.storeMedicalAnalysisResult(patientId, result);
    } catch (error) {
      logger.error('Error storing analysis result:', error);
      throw error;
    }
  }

  /**
   * Store job results
   * @param {string} jobId - Job ID
   * @param {Object} results - Job results
   */
  async storeJobResults(jobId, results) {
    try {
      // Store job results in a separate collection or add to existing job
      // This is a placeholder - implement based on your storage needs
      logger.info('Job results stored', { jobId, results });
    } catch (error) {
      logger.error('Error storing job results:', error);
    }
  }

  /**
   * Create batches from array
   * @param {Array} items - Items to batch
   * @param {number} batchSize - Size of each batch
   * @returns {Array} Array of batches
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Delay promise
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get scheduler status
   * @returns {Object} Scheduler status
   */
  async getStatus() {
    try {
      const jobs = await this.agenda.jobs({
        type: 'monthly-medical-analysis'
      }, {
        startDate: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      });

      return {
        isInitialized: this.isInitialized,
        totalJobs: jobs.length,
        runningJobs: jobs.filter(job => job.attrs.nextRunAt).length,
        failedJobs: jobs.filter(job => job.attrs.failCount > 0).length,
        config: this.config
      };
    } catch (error) {
      logger.error('Error getting scheduler status:', error);
      return {
        isInitialized: this.isInitialized,
        error: error.message
      };
    }
  }

  /**
   * Gracefully shutdown the scheduler
   */
  async shutdown() {
    try {
      if (this.agenda) {
        await this.agenda.stop();
        logger.info('MedicalAnalysisScheduler shutdown completed');
      }
    } catch (error) {
      logger.error('Error shutting down MedicalAnalysisScheduler:', error);
    }
  }
}

// Create singleton instance
const medicalAnalysisScheduler = new MedicalAnalysisScheduler();

module.exports = medicalAnalysisScheduler;
