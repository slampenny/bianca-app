// src/routes/v1/fraudAbuseAnalysis.route.js

const express = require('express');
const auth = require('../../middlewares/auth');
const fraudAbuseAnalysisController = require('../../controllers/fraudAbuseAnalysis.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: FraudAbuseAnalysis
 *   description: Fraud and abuse detection analysis endpoints (HIPAA compliant - all endpoints require authentication and audit logging)
 */

/**
 * @swagger
 * /fraud-abuse-analysis/{clientId}:
 *   get:
 *     summary: Get fraud/abuse analysis for a client
 *     description: |
 *       Retrieves fraud and abuse analysis for a client over a specified time period.
 *       **HIPAA Compliance**: This endpoint requires authentication, logs all access attempts, and only returns data for clients associated with the authenticated caregiver's organization.
 *     tags: [FraudAbuseAnalysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ID
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
 *     responses:
 *       200:
 *         description: Analysis retrieved successfully
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
 *                     clientId:
 *                       type: string
 *                     clientName:
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
 *                         financialRisk:
 *                           type: object
 *                           properties:
 *                             riskScore:
 *                               type: number
 *                               minimum: 0
 *                               maximum: 100
 *                             confidence:
 *                               type: string
 *                               enum: [low, medium, high, none]
 *                             indicators:
 *                               type: array
 *                               items:
 *                                 type: object
 *                         abuseRisk:
 *                           type: object
 *                           properties:
 *                             riskScore:
 *                               type: number
 *                               minimum: 0
 *                               maximum: 100
 *                             confidence:
 *                               type: string
 *                               enum: [low, medium, high, none]
 *                             physicalAbuseScore:
 *                               type: number
 *                             emotionalAbuseScore:
 *                               type: number
 *                             neglectScore:
 *                               type: number
 *                         relationshipRisk:
 *                           type: object
 *                           properties:
 *                             riskScore:
 *                               type: number
 *                               minimum: 0
 *                               maximum: 100
 *                             confidence:
 *                               type: string
 *                               enum: [low, medium, high, none]
 *                         overallRiskScore:
 *                           type: number
 *                           minimum: 0
 *                           maximum: 100
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
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                             enum: [financial, abuse, neglect, relationship, overall, general]
 *                           priority:
 *                             type: string
 *                             enum: [low, medium, high]
 *                           action:
 *                             type: string
 *                           description:
 *                             type: string
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Insufficient permissions
 *       404:
 *         description: Client not found
 *       500:
 *         description: Internal server error
 */

// Note: More specific routes must come before the generic /:clientId route
// to avoid route matching conflicts

/**
 * @swagger
 * /fraud-abuse-analysis/results/{clientId}:
 *   get:
 *     summary: Get stored fraud/abuse analysis results for a client
 *     description: |
 *       Retrieves previously stored fraud and abuse analysis results for a client.
 *       **HIPAA Compliance**: This endpoint requires authentication, logs all access attempts, and only returns data for clients associated with the authenticated caregiver's organization.
 *     tags: [FraudAbuseAnalysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *           minimum: 1
 *           maximum: 50
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: Results retrieved successfully
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
 *                     properties:
 *                       id:
 *                         type: string
 *                       analysisDate:
 *                         type: string
 *                         format: date-time
 *                       timeRange:
 *                         type: string
 *                       overallRiskScore:
 *                         type: number
 *                       financialRisk:
 *                         type: object
 *                       abuseRisk:
 *                         type: object
 *                       relationshipRisk:
 *                         type: object
 *                       confidence:
 *                         type: string
 *                       warnings:
 *                         type: array
 *                       recommendations:
 *                         type: array
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Client not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/results/:clientId',
  auth(),
  fraudAbuseAnalysisController.getFraudAbuseAnalysisResults
);

/**
 * @swagger
 * /fraud-abuse-analysis/trigger-client/{clientId}:
 *   post:
 *     summary: Trigger fraud/abuse analysis for a client
 *     description: |
 *       Manually triggers a new fraud and abuse analysis for all client conversations.
 *       **HIPAA Compliance**: This endpoint requires authentication, logs all access attempts and analysis triggers, and only processes data for clients associated with the authenticated caregiver's organization. All analysis results are stored with audit trails.
 *     tags: [FraudAbuseAnalysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ID
 *     responses:
 *       200:
 *         description: Analysis completed successfully
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
 *                   example: "Fraud/abuse analysis completed successfully"
 *                 result:
 *                   type: object
 *                   properties:
 *                     overallRiskScore:
 *                       type: number
 *                     financialRisk:
 *                       type: object
 *                     abuseRisk:
 *                       type: object
 *                     relationshipRisk:
 *                       type: object
 *                     warnings:
 *                       type: array
 *                     recommendations:
 *                       type: array
 *                     processingTime:
 *                       type: number
 *                       description: Processing time in milliseconds
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Client not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/trigger-client/:clientId',
  auth(),
  fraudAbuseAnalysisController.triggerClientAnalysis
);

router.get(
  '/:clientId',
  auth(),
  fraudAbuseAnalysisController.getFraudAbuseAnalysis
);

module.exports = router;
