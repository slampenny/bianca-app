// src/controllers/fraudAbuseAnalysis.controller.js

const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {
  conversationService,
  patientService,
  fraudAbuseAnalyzer: FraudAbuseAnalyzer,
} = require('../services');
const { FraudAbuseAnalysis } = require('../models');
const logger = require('../config/logger');

/**
 * Get fraud/abuse analysis for a patient for a specific time period
 */
const getFraudAbuseAnalysis = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const { 
    timeRange = 'month',
    startDate,
    endDate,
    includeBaseline = false
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
            financialRisk: {},
            abuseRisk: {},
            relationshipRisk: {},
            overallRiskScore: 0,
            warnings: ['No conversations found for the specified time period'],
            confidence: 'none',
            analysisDate: new Date()
          },
          recommendations: []
        }
      });
    }

    // Check if analysis already exists for this time period
    const existingAnalysis = await FraudAbuseAnalysis.findOne({
      patientId,
      startDate: start,
      endDate: end,
      timeRange
    }).sort({ createdAt: -1 });

    let analysis, baseline = null;

    if (existingAnalysis && existingAnalysis.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      // Use existing analysis if it's less than 24 hours old
      analysis = existingAnalysis;
      logger.info('Using existing fraud/abuse analysis for patient:', patientId);
    } else {
      // Perform fresh analysis
      const startTime = Date.now();
      const analyzer = new FraudAbuseAnalyzer();
      
      // Get baseline if requested
      if (includeBaseline === 'true') {
        try {
          const baselineAnalysis = await FraudAbuseAnalysis.findOne({ patientId })
            .sort({ analysisDate: -1 });
          if (baselineAnalysis && baselineAnalysis.analysisDate < start) {
            baseline = baselineAnalysis;
          }
        } catch (error) {
          logger.warn('Could not retrieve baseline for patient:', patientId, error.message);
        }
      }
      
      analysis = await analyzer.analyzeConversations(conversations, baseline);
      const processingTime = Date.now() - startTime;

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
        financialRisk: analysis.financialRisk,
        abuseRisk: analysis.abuseRisk,
        relationshipRisk: analysis.relationshipRisk,
        overallRiskScore: analysis.overallRiskScore,
        changeFromBaseline: analysis.changeFromBaseline,
        confidence: analysis.confidence,
        warnings: analysis.warnings,
        recommendations: analysis.recommendations,
        processingTime,
        version: '1.0'
      };

      try {
        await FraudAbuseAnalysis.create(analysisData);
        logger.info('Fraud/abuse analysis stored for patient:', patientId);
      } catch (error) {
        logger.error('Failed to store fraud/abuse analysis:', error);
        // Continue with response even if storage fails
      }
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: {
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        timeRange,
        startDate: start,
        endDate: end,
        conversationCount: conversations.length,
        messageCount: analysis.messageCount || 0,
        totalWords: analysis.totalWords || 0,
        analysis: {
          financialRisk: analysis.financialRisk || {},
          abuseRisk: analysis.abuseRisk || {},
          relationshipRisk: analysis.relationshipRisk || {},
          overallRiskScore: analysis.overallRiskScore || 0,
          warnings: analysis.warnings || [],
          confidence: analysis.confidence || 'none',
          analysisDate: analysis.analysisDate || new Date()
        },
        recommendations: analysis.recommendations || [],
        generatedAt: new Date()
      }
    });

  } catch (error) {
    logger.error('Error in getFraudAbuseAnalysis:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to generate fraud/abuse analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get fraud/abuse analysis results for a patient
 */
const getFraudAbuseAnalysisResults = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const { limit = 5 } = req.query;

  try {
    const analyses = await FraudAbuseAnalysis.find({ patientId })
      .sort({ analysisDate: -1 })
      .limit(parseInt(limit, 10));

    res.status(httpStatus.OK).json({
      success: true,
      results: analyses.map(analysis => ({
        id: analysis._id,
        analysisDate: analysis.analysisDate,
        timeRange: analysis.timeRange,
        overallRiskScore: analysis.overallRiskScore,
        financialRisk: analysis.financialRisk,
        abuseRisk: analysis.abuseRisk,
        relationshipRisk: analysis.relationshipRisk,
        confidence: analysis.confidence,
        warnings: analysis.warnings,
        recommendations: analysis.recommendations,
        conversationCount: analysis.conversationCount,
        messageCount: analysis.messageCount,
        totalWords: analysis.totalWords
      }))
    });
  } catch (error) {
    logger.error('Error in getFraudAbuseAnalysisResults:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to retrieve fraud/abuse analysis results',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Trigger fraud/abuse analysis for a patient
 */
const triggerPatientAnalysis = catchAsync(async (req, res) => {
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

    // Get all conversations for the patient
    const conversations = await conversationService.getConversationsByPatient(patientId);

    if (conversations.length === 0) {
      const analyzer = new FraudAbuseAnalyzer();
      return res.status(httpStatus.OK).json({
        success: true,
        message: 'No conversations found for analysis period',
        result: {
          financialRisk: analyzer.financialDetector.getDefaultMetrics(),
          abuseRisk: analyzer.abuseDetector.getDefaultMetrics(),
          relationshipRisk: analyzer.relationshipAnalyzer.getDefaultMetrics(),
          overallRiskScore: 0,
          warnings: ['No conversations found for analysis period'],
          confidence: 'none',
          analysisDate: new Date(),
          conversationCount: 0,
          messageCount: 0,
          totalWords: 0,
          trigger: 'manual'
        }
      });
    }

    // Get baseline analysis (previous result)
    const baselineResults = await FraudAbuseAnalysis.find({ patientId })
      .sort({ analysisDate: -1 })
      .limit(1);
    const baseline = baselineResults.length > 0 ? baselineResults[0] : null;

    // Perform analysis synchronously
    const analyzer = new FraudAbuseAnalyzer();
    const startTime = Date.now();
    const analysisResult = await analyzer.analyzeConversations(conversations, baseline);
    const processingTime = Date.now() - startTime;

    // Store analysis result
    const resultToStore = {
      patientId,
      analysisDate: new Date(),
      timeRange: 'custom',
      startDate: conversations.length > 0 ? conversations[conversations.length - 1].createdAt : new Date(),
      endDate: conversations.length > 0 ? conversations[0].createdAt : new Date(),
      conversationCount: conversations.length,
      messageCount: analysisResult.messageCount,
      totalWords: analysisResult.totalWords,
      financialRisk: analysisResult.financialRisk,
      abuseRisk: analysisResult.abuseRisk,
      relationshipRisk: analysisResult.relationshipRisk,
      overallRiskScore: analysisResult.overallRiskScore,
      changeFromBaseline: analysisResult.changeFromBaseline,
      confidence: analysisResult.confidence,
      warnings: analysisResult.warnings,
      recommendations: analysisResult.recommendations,
      processingTime,
      version: '1.0'
    };

    await FraudAbuseAnalysis.create(resultToStore);

    logger.info('Synchronous fraud/abuse analysis completed', {
      patientId,
      conversationCount: conversations.length,
      processingTime: `${processingTime}ms`,
      confidence: analysisResult.confidence,
      overallRiskScore: analysisResult.overallRiskScore
    });

    res.status(httpStatus.OK).json({
      success: true,
      message: 'Fraud/abuse analysis completed successfully',
      result: {
        ...analysisResult,
        processingTime
      }
    });
  } catch (error) {
    logger.error('Error in triggerPatientAnalysis:', error);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Failed to trigger fraud/abuse analysis',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = {
  getFraudAbuseAnalysis,
  getFraudAbuseAnalysisResults,
  triggerPatientAnalysis
};

