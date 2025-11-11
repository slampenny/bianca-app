// src/controllers/medicalAnalysis.controller.js

const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {
  conversationService,
  patientService,
  medicalPatternAnalyzer: MedicalPatternAnalyzer,
  baselineManager,
  medicalAnalysisScheduler,
} = require('../services');
const { MedicalAnalysis } = require('../models');
const logger = require('../config/logger');

/**
 * Get medical analysis for a patient for a specific time period
 */
const getMedicalAnalysis = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const { 
    timeRange = 'month', // month, quarter, year, custom
    startDate,
    endDate,
    includeBaseline = true
  } = req.query;

  try {
    // Validate patient exists
    const patient = await patientService.getPatientById(patientId);
    if (!patient) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Calculate date range
    let start, end;
    const now = new Date();
    
    switch (timeRange) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'quarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterStart, 1);
        end = new Date(now.getFullYear(), quarterStart + 3, 0, 23, 59, 59);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      case 'custom':
        if (!startDate || !endDate) {
          return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: 'Custom time range requires startDate and endDate'
          });
        }
        start = new Date(startDate);
        end = new Date(endDate);
        break;
      default:
        return res.status(httpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid timeRange. Must be: month, quarter, year, or custom'
        });
    }

    // Get conversations for the time period
    const conversations = await conversationService.getConversationsByPatientAndDateRange(
      patientId,
      start,
      end
    );

    if (!conversations || conversations.length === 0) {
      return res.status(httpStatus.OK).json({
        success: true,
        data: {
          patientId,
          timeRange,
          startDate: start,
          endDate: end,
          conversationCount: 0,
          messageCount: 0,
          analysis: {
            cognitiveMetrics: null,
            psychiatricMetrics: null,
            vocabularyMetrics: null,
            warnings: ['No conversations found for the specified time period'],
            confidence: 'none',
            analysisDate: new Date()
          },
          baseline: null,
          recommendations: []
        }
      });
    }

    // Check if analysis already exists for this time period
    const existingAnalysis = await MedicalAnalysis.findOne({
      patientId,
      startDate: start,
      endDate: end,
      timeRange
    }).sort({ createdAt: -1 });

    let analysis, baseline = null;

    if (existingAnalysis && existingAnalysis.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      // Use existing analysis if it's less than 24 hours old
      analysis = existingAnalysis;
      logger.info('Using existing medical analysis for patient:', patientId);
    } else {
      // Perform fresh medical analysis
      const startTime = Date.now();
      const analyzer = new MedicalPatternAnalyzer();
      analysis = await analyzer.analyzeMonth(conversations);
      const processingTime = Date.now() - startTime;

      // Get baseline comparison if requested
      if (includeBaseline === 'true') {
        try {
          baseline = await baselineManager.getBaseline(patientId);
        } catch (error) {
          logger.warn('Could not retrieve baseline for patient:', patientId, error.message);
        }
      }

      // Generate recommendations based on analysis
      const recommendations = generateRecommendations(analysis, baseline);

      // Store analysis in database
      const analysisData = {
        patientId,
        analysisDate: new Date(),
        timeRange,
        startDate: start,
        endDate: end,
        conversationCount: conversations.length,
        messageCount: analysis.messageCount,
        totalWords: analysis.totalWords,
        cognitiveMetrics: analysis.cognitiveMetrics,
        psychiatricMetrics: analysis.psychiatricMetrics,
        vocabularyMetrics: analysis.vocabularyMetrics,
        speechPatterns: analysis.speechPatterns,
        repetitionAnalysis: analysis.repetitionAnalysis,
        confidence: analysis.confidence,
        warnings: analysis.warnings,
        baselineComparison: baseline ? {
          hasBaseline: true,
          deviations: baseline.deviations || null,
          significantChanges: baseline.significantChanges || []
        } : { hasBaseline: false },
        recommendations,
        processingTime,
        version: '1.0'
      };

      try {
        await MedicalAnalysis.create(analysisData);
        logger.info('Medical analysis stored for patient:', patientId);
      } catch (error) {
        logger.error('Failed to store medical analysis:', error);
        // Continue with response even if storage fails
      }
    }

    // Generate recommendations based on analysis
    const recommendations = generateRecommendations(analysis, baseline);

    res.status(httpStatus.OK).json({
      success: true,
      data: {
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        timeRange,
        startDate: start,
        endDate: end,
        conversationCount: conversations.length,
        messageCount: analysis.messageCount,
        totalWords: analysis.totalWords,
        analysis,
        baseline,
        recommendations,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error in getMedicalAnalysis:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to generate medical analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get medical analysis summary for dashboard
 */
const getMedicalAnalysisSummary = catchAsync(async (req, res) => {
  const { patientId } = req.params;

  try {
    // Validate patient exists
    const patient = await patientService.getPatientById(patientId);
    if (!patient) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Get latest medical analysis from database
    const latestAnalysis = await MedicalAnalysis.getLatestAnalysis(patientId);

    if (!latestAnalysis) {
      return res.status(httpStatus.OK).json({
        success: true,
        data: {
          patientId,
          patientName: `${patient.firstName} ${patient.lastName}`,
          hasData: false,
          summary: {
            totalConversations: 0,
            lastAnalysisDate: null,
            overallHealthScore: null,
            riskIndicators: [],
            positiveTrends: [],
            concerns: []
          }
        }
      });
    }

    // Generate summary from stored analysis
    const summary = generateAnalysisSummary(latestAnalysis);

    res.status(httpStatus.OK).json({
      success: true,
      data: {
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        hasData: true,
        summary,
        lastAnalysisDate: latestAnalysis.analysisDate,
        conversationCount: latestAnalysis.conversationCount,
        messageCount: latestAnalysis.messageCount
      }
    });

  } catch (error) {
    logger.error('Error in getMedicalAnalysisSummary:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to generate medical analysis summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get baseline information for a patient
 */
const getBaseline = catchAsync(async (req, res) => {
  const { patientId } = req.params;

  try {
    const baseline = await baselineManager.getBaseline(patientId);

    if (!baseline) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'No baseline found for patient'
      });
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: baseline
    });

  } catch (error) {
    logger.error('Error in getBaseline:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to retrieve baseline',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Establish or update baseline for a patient
 */
const establishBaseline = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const { metrics } = req.body;

  try {
    // Validate patient exists
    const patient = await patientService.getPatientById(patientId);
    if (!patient) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Validate metrics
    if (!metrics || typeof metrics !== 'object') {
      return res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Metrics are required'
      });
    }

    // Add analysis date if not provided
    if (!metrics.analysisDate) {
      metrics.analysisDate = new Date();
    }

    // Establish or update baseline
    const baseline = await baselineManager.establishBaseline(patientId, metrics);

    res.status(httpStatus.OK).json({
      success: true,
      data: baseline,
      message: 'Baseline established successfully'
    });

  } catch (error) {
    logger.error('Error in establishBaseline:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to establish baseline',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Generate recommendations based on analysis results
 */
function generateRecommendations(analysis, baseline) {
  const recommendations = [];

  // Cognitive recommendations
  if (analysis.cognitiveMetrics && analysis.cognitiveMetrics.riskScore > 70) {
    recommendations.push({
      category: 'cognitive',
      severity: 'high',
      title: 'Cognitive Assessment Recommended',
      description: 'Consider scheduling a cognitive assessment with a healthcare provider',
      priority: 1
    });
  }

  if (analysis.cognitiveMetrics && analysis.cognitiveMetrics.fillerWordDensity > 0.05) {
    recommendations.push({
      category: 'cognitive',
      severity: 'medium',
      title: 'Monitor Communication Patterns',
      description: 'Increased use of filler words may indicate cognitive changes',
      priority: 2
    });
  }

  // Psychiatric recommendations
  if (analysis.psychiatricMetrics && analysis.psychiatricMetrics.depressionScore > 70) {
    recommendations.push({
      category: 'psychiatric',
      severity: 'high',
      title: 'Depression Screening Recommended',
      description: 'Consider mental health evaluation and support',
      priority: 1
    });
  }

  if (analysis.psychiatricMetrics && analysis.psychiatricMetrics.crisisIndicators?.hasCrisisIndicators) {
    recommendations.push({
      category: 'psychiatric',
      severity: 'critical',
      title: 'Immediate Mental Health Support Needed',
      description: 'Crisis indicators detected - immediate professional support recommended',
      priority: 0
    });
  }

  // Vocabulary recommendations
  if (analysis.vocabularyMetrics && analysis.vocabularyMetrics.typeTokenRatio < 0.3) {
    recommendations.push({
      category: 'cognitive',
      severity: 'medium',
      title: 'Language Complexity Monitoring',
      description: 'Reduced vocabulary diversity may indicate cognitive changes',
      priority: 2
    });
  }

  // Baseline comparison recommendations
  if (baseline && baseline.deviations) {
    Object.entries(baseline.deviations).forEach(([metric, deviation]) => {
      if (deviation.zScore > 2) {
        recommendations.push({
          category: 'baseline',
          severity: 'medium',
          title: `Significant Change in ${metric}`,
          description: `${metric} has changed significantly from baseline`,
          priority: 2
        });
      }
    });
  }

  // Sort by priority (0 = critical, 1 = high, 2 = medium)
  return recommendations.sort((a, b) => a.priority - b.priority);
}

/**
 * Generate analysis summary for dashboard
 */
function generateAnalysisSummary(analysis) {
  const summary = {
    totalConversations: analysis.conversationCount,
    lastAnalysisDate: analysis.analysisDate,
    overallHealthScore: calculateOverallHealthScore(analysis),
    riskIndicators: [],
    positiveTrends: [],
    concerns: []
  };

  // Extract risk indicators
  if (analysis.cognitiveMetrics?.riskScore > 60) {
    summary.riskIndicators.push({
      category: 'cognitive',
      severity: analysis.cognitiveMetrics.riskScore > 80 ? 'high' : 'medium',
      description: 'Cognitive decline indicators detected'
    });
  }

  if (analysis.psychiatricMetrics?.depressionScore > 60) {
    summary.riskIndicators.push({
      category: 'psychiatric',
      severity: analysis.psychiatricMetrics.depressionScore > 80 ? 'high' : 'medium',
      description: 'Depression indicators detected'
    });
  }

  if (analysis.psychiatricMetrics?.crisisIndicators?.hasCrisisIndicators) {
    summary.riskIndicators.push({
      category: 'psychiatric',
      severity: 'critical',
      description: 'Crisis indicators detected'
    });
  }

  // Extract positive trends
  if (analysis.vocabularyMetrics?.complexityScore > 70) {
    summary.positiveTrends.push({
      category: 'cognitive',
      description: 'Good vocabulary complexity maintained'
    });
  }

  // Extract concerns
  analysis.warnings?.forEach(warning => {
    summary.concerns.push({
      category: 'general',
      description: warning
    });
  });

  return summary;
}

/**
 * Calculate overall health score (0-100)
 */
function calculateOverallHealthScore(analysis) {
  let score = 100;

  // Deduct points for cognitive issues
  if (analysis.cognitiveMetrics?.riskScore > 0) {
    score -= Math.min(analysis.cognitiveMetrics.riskScore * 0.3, 30);
  }

  // Deduct points for psychiatric issues
  if (analysis.psychiatricMetrics?.depressionScore > 0) {
    score -= Math.min(analysis.psychiatricMetrics.depressionScore * 0.2, 25);
  }

  if (analysis.psychiatricMetrics?.anxietyScore > 0) {
    score -= Math.min(analysis.psychiatricMetrics.anxietyScore * 0.15, 20);
  }

  // Deduct points for crisis indicators
  if (analysis.psychiatricMetrics?.crisisIndicators?.hasCrisisIndicators) {
    score -= 25;
  }

  // Ensure score doesn't go below 0
  return Math.max(Math.round(score), 0);
}

/**
 * Get medical analysis results for a patient
 */
const getMedicalAnalysisResults = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const { limit = 10 } = req.query;

  try {
    logger.info('[MedicalAnalysis] Fetching medical analysis results for patient', { patientId, limit });
    
    const results = await conversationService.getMedicalAnalysisResults(patientId, parseInt(limit));
    
    res.status(httpStatus.OK).json({
      success: true,
      results,
      count: results.length
    });
  } catch (error) {
    logger.error('Error fetching medical analysis results:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch medical analysis results',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Trigger medical analysis for a specific patient
 */
const triggerPatientAnalysis = catchAsync(async (req, res) => {
  const { patientId } = req.params;

  try {
    logger.info('[MedicalAnalysis] Triggering medical analysis for patient', { patientId });
    
    // Validate patient exists
    const patient = await patientService.getPatientById(patientId);
    if (!patient) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Schedule the analysis
    const job = await medicalAnalysisScheduler.schedulePatientAnalysis(patientId, {
      trigger: 'manual',
      batchId: `manual-${Date.now()}`
    });

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Medical analysis triggered successfully',
      jobId: job.attrs._id
    });
  } catch (error) {
    logger.error('Error triggering patient medical analysis:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to trigger patient medical analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Trigger medical analysis for all active patients
 */
const triggerAllAnalysis = catchAsync(async (req, res) => {
  try {
    logger.info('[MedicalAnalysis] Triggering medical analysis for all patients');
    
    // Get all active patients
    const patients = await conversationService.getActivePatients();
    
    if (!patients || patients.length === 0) {
      return res.status(httpStatus.OK).json({
        success: true,
        message: 'No active patients found',
        jobCount: 0
      });
    }

    // Schedule analysis for all patients
    const patientIds = patients.map(p => p._id.toString());
    const jobs = await medicalAnalysisScheduler.scheduleBatchAnalysis(patientIds, {
      trigger: 'manual',
      batchId: `batch-manual-${Date.now()}`
    });

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Medical analysis triggered for all patients',
      jobCount: jobs.length
    });
  } catch (error) {
    logger.error('Error triggering all medical analysis:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to trigger medical analysis for all patients',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get medical analysis scheduler status
 */
const getSchedulerStatus = catchAsync(async (req, res) => {
  try {
    const status = await medicalAnalysisScheduler.getStatus();
    
    res.status(httpStatus.OK).json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting scheduler status:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to get scheduler status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get medical analysis trend data for time series visualization
 */
const getMedicalAnalysisTrend = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const { timeRange = 'year' } = req.query;

  try {
    logger.info('[MedicalAnalysis] Fetching trend data for patient', { patientId, timeRange });
    
    // Validate patient exists
    const patient = await patientService.getPatientById(patientId);
    if (!patient) {
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Calculate date range
    let start, end;
    const now = new Date();
    
    switch (timeRange) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'quarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterStart, 1);
        end = new Date(now.getFullYear(), quarterStart + 3, 0, 23, 59, 59);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    // Get all medical analysis results for the patient
    const timeSeriesResults = await MedicalAnalysis.find({ 
      patientId,
      analysisDate: { $gte: start, $lte: end }
    }).sort({ analysisDate: 1 });

    if (timeSeriesResults.length === 0) {
      return res.status(httpStatus.OK).json({
        success: true,
        trend: {
          patientId,
          timeRange,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          totalAnalyses: 0,
          dataPoints: [],
          summary: {
            averageCognitiveRisk: 0,
            averagePsychiatricRisk: 0,
            cognitiveTrend: 'stable',
            psychiatricTrend: 'stable',
            vocabularyTrend: 'stable',
            confidence: 0,
            keyInsights: ['No analysis data available for the specified time range'],
            criticalWarnings: []
          }
        }
      });
    }

    // Transform stored time series data for frontend
    const dataPoints = timeSeriesResults.map(result => ({
      date: result.analysisDate.toISOString().split('T')[0], // YYYY-MM-DD format
      cognitiveScore: result.timeSeriesData?.cognitiveScore || 0,
      mentalHealthScore: result.timeSeriesData?.mentalHealthScore || 0,
      languageScore: result.timeSeriesData?.languageScore || 0,
      overallHealthScore: result.timeSeriesData?.overallHealthScore || 0,
      conversationCount: result.conversationCount || 0,
      messageCount: result.messageCount || 0
    }));

    // Get trends from the latest analysis (already calculated and stored)
    const latestAnalysis = timeSeriesResults[timeSeriesResults.length - 1];
    const trends = latestAnalysis.trends || {
      cognitive: 'stable',
      mentalHealth: 'stable',
      language: 'stable',
      overall: 'stable'
    };

    res.status(httpStatus.OK).json({
      success: true,
      trend: {
        patientId,
        timeRange,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalAnalyses: dataPoints.length,
        dataPoints: dataPoints.map(point => ({
          analysisId: point.analysisId,
          date: point.date,
          analysis: point.analysis
        })),
        summary: {
          averageCognitiveRisk: dataPoints.reduce((sum, p) => sum + (p.analysis?.cognitiveScore || 0), 0) / dataPoints.length,
          averagePsychiatricRisk: dataPoints.reduce((sum, p) => sum + (p.analysis?.mentalHealthScore || 0), 0) / dataPoints.length,
          cognitiveTrend: trends.cognitive,
          psychiatricTrend: trends.mentalHealth,
          vocabularyTrend: trends.language,
          confidence: 0.8, // Default confidence
          keyInsights: dataPoints.length > 1 ? [`Based on ${dataPoints.length} analyses over ${timeRange}`] : ['Single analysis - trends require multiple data points'],
          criticalWarnings: []
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching medical analysis trend:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to fetch medical analysis trend',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


module.exports = {
  getMedicalAnalysis,
  getMedicalAnalysisSummary,
  getBaseline,
  establishBaseline,
  getMedicalAnalysisResults,
  triggerPatientAnalysis,
  triggerAllAnalysis,
  getSchedulerStatus,
  getMedicalAnalysisTrend
};
