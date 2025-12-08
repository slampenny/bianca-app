// src/routes/v1/medicalAnalysis.route.js

const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const medicalAnalysisValidation = require('../../validations/medicalAnalysis.validation');
const medicalAnalysisController = require('../../controllers/medicalAnalysis.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: MedicalAnalysis
 *   description: Medical NLP analysis endpoints
 */

/**
 * @swagger
 * /medical-analysis/{patientId}:
 *   get:
 *     summary: Get medical analysis for a patient
 *     description: Retrieves comprehensive medical NLP analysis for a patient over a specified time period
 *     tags: [MedicalAnalysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [month, quarter, year, custom]
 *           default: month
 *         description: Time range for analysis
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for custom range (ISO 8601 format)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for custom range (ISO 8601 format)
 *       - in: query
 *         name: includeBaseline
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Whether to include baseline comparison
 *     responses:
 *       200:
 *         description: Medical analysis retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     patientId:
 *                       type: string
 *                     patientName:
 *                       type: string
 *                     timeRange:
 *                       type: string
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                     conversationCount:
 *                       type: number
 *                     messageCount:
 *                       type: number
 *                     totalWords:
 *                       type: number
 *                     analysis:
 *                       type: object
 *                       properties:
 *                         cognitiveMetrics:
 *                           type: object
 *                         psychiatricMetrics:
 *                           type: object
 *                         vocabularyMetrics:
 *                           type: object
 *                         warnings:
 *                           type: array
 *                           items:
 *                             type: string
 *                         confidence:
 *                           type: string
 *                           enum: [low, medium, high, none]
 *                         analysisDate:
 *                           type: string
 *                           format: date-time
 *                     baseline:
 *                       type: object
 *                       nullable: true
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                           severity:
 *                             type: string
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           priority:
 *                             type: number
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Patient not found
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:patientId',
  auth(),
  validate(medicalAnalysisValidation.getMedicalAnalysis),
  medicalAnalysisController.getMedicalAnalysis
);

/**
 * @swagger
 * /medical-analysis/{patientId}/summary:
 *   get:
 *     summary: Get medical analysis summary for dashboard
 *     description: Retrieves a summary of medical analysis suitable for dashboard display
 *     tags: [MedicalAnalysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     responses:
 *       200:
 *         description: Medical analysis summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     patientId:
 *                       type: string
 *                     patientName:
 *                       type: string
 *                     hasData:
 *                       type: boolean
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalConversations:
 *                           type: number
 *                         lastAnalysisDate:
 *                           type: string
 *                           format: date-time
 *                         overallHealthScore:
 *                           type: number
 *                           minimum: 0
 *                           maximum: 100
 *                         riskIndicators:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               category:
 *                                 type: string
 *                               severity:
 *                                 type: string
 *                               description:
 *                                 type: string
 *                         positiveTrends:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               category:
 *                                 type: string
 *                               description:
 *                                 type: string
 *                         concerns:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               category:
 *                                 type: string
 *                               description:
 *                                 type: string
 *                     lastAnalysisDate:
 *                       type: string
 *                       format: date-time
 *                     conversationCount:
 *                       type: number
 *                     messageCount:
 *                       type: number
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:patientId/summary',
  auth(),
  validate(medicalAnalysisValidation.getMedicalAnalysisSummary),
  medicalAnalysisController.getMedicalAnalysisSummary
);

/**
 * @swagger
 * /medical-analysis/{patientId}/baseline:
 *   get:
 *     summary: Get baseline for a patient
 *     description: Retrieves the established baseline metrics for a patient
 *     tags: [MedicalAnalysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     responses:
 *       200:
 *         description: Baseline retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     patientId:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [initial, rolling]
 *                     establishedDate:
 *                       type: string
 *                       format: date-time
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                     dataPoints:
 *                       type: array
 *                     metrics:
 *                       type: object
 *                     seasonalAdjustments:
 *                       type: object
 *                     version:
 *                       type: number
 *       404:
 *         description: No baseline found for patient
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:patientId/baseline',
  auth(),
  validate(medicalAnalysisValidation.getBaseline),
  medicalAnalysisController.getBaseline
);

/**
 * @swagger
 * /medical-analysis/{patientId}/baseline:
 *   post:
 *     summary: Establish or update baseline for a patient
 *     description: Establishes or updates the baseline metrics for a patient
 *     tags: [MedicalAnalysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metrics
 *             properties:
 *               metrics:
 *                 type: object
 *                 properties:
 *                   vocabularyScore:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                   depressionScore:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                   anxietyScore:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                   cognitiveScore:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 100
 *                   analysisDate:
 *                     type: string
 *                     format: date-time
 *     responses:
 *       200:
 *         description: Baseline established successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *                   example: "Baseline established successfully"
 *       404:
 *         description: Patient not found
 *       400:
 *         description: Invalid metrics data
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:patientId/baseline',
  auth(),
  validate(medicalAnalysisValidation.establishBaseline),
  medicalAnalysisController.establishBaseline
);

/**
 * @swagger
 * /medical-analysis/results/{patientId}:
 *   get:
 *     summary: Get medical analysis results for a patient
 *     description: Retrieves stored medical analysis results for a patient
 *     tags: [MedicalAnalysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: Medical analysis results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/results/:patientId',
  auth('readOwn:medicalAnalysis', 'readAny:medicalAnalysis'),
  medicalAnalysisController.getMedicalAnalysisResults
);

/**
 * @swagger
 * /medical-analysis/trigger-patient/{patientId}:
 *   post:
 *     summary: Trigger medical analysis for a specific patient
 *     description: Manually triggers medical analysis for a specific patient
 *     tags: [MedicalAnalysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     responses:
 *       200:
 *         description: Medical analysis triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Medical analysis triggered successfully"
 *                 jobId:
 *                   type: string
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/trigger-patient/:patientId',
  auth('createOwn:medicalAnalysis', 'createAny:medicalAnalysis'),
  medicalAnalysisController.triggerPatientAnalysis
);

/**
 * @swagger
 * /medical-analysis/trigger-all:
 *   post:
 *     summary: Trigger medical analysis for all active patients
 *     description: Manually triggers medical analysis for all active patients
 *     tags: [MedicalAnalysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Medical analysis triggered successfully for all patients
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Medical analysis triggered for all patients"
 *                 jobCount:
 *                   type: integer
 *       500:
 *         description: Internal server error
 */
router.post(
  '/trigger-all',
  auth('createAny:medicalAnalysis'),
  medicalAnalysisController.triggerAllAnalysis
);

/**
 * @swagger
 * /medical-analysis/status:
 *   get:
 *     summary: Get medical analysis scheduler status
 *     description: Retrieves the current status of the medical analysis scheduler
 *     tags: [MedicalAnalysis]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduler status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     isInitialized:
 *                       type: boolean
 *                     isRunning:
 *                       type: boolean
 *                     jobCount:
 *                       type: integer
 *       500:
 *         description: Internal server error
 */
router.get(
  '/status',
  auth('readAny:medicalAnalysis'),
  medicalAnalysisController.getSchedulerStatus
);

/**
 * @swagger
 * /medical-analysis/trend/{patientId}:
 *   get:
 *     summary: Get medical analysis trend data for time series visualization
 *     description: Retrieves time series data for medical analysis metrics over time
 *     tags: [MedicalAnalysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [month, quarter, year]
 *           default: year
 *         description: Time range for trend analysis
 *     responses:
 *       200:
 *         description: Medical analysis trend data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     patientId:
 *                       type: string
 *                     timeRange:
 *                       type: string
 *                     dataPoints:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           cognitiveScore:
 *                             type: number
 *                           mentalHealthScore:
 *                             type: number
 *                           languageScore:
 *                             type: number
 *                           conversationCount:
 *                             type: number
 *                           messageCount:
 *                             type: number
 *                     trends:
 *                       type: object
 *                       properties:
 *                         cognitive:
 *                           type: string
 *                           enum: [improving, stable, declining]
 *                         mentalHealth:
 *                           type: string
 *                           enum: [improving, stable, declining]
 *                         language:
 *                           type: string
 *                           enum: [improving, stable, declining]
 *       404:
 *         description: Patient not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/trend/:patientId',
  auth('readOwn:medicalAnalysis', 'readAny:medicalAnalysis'),
  medicalAnalysisController.getMedicalAnalysisTrend
);

module.exports = router;
