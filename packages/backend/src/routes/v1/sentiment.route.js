const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const sentimentController = require('../../controllers/sentiment.controller');
const { sentimentValidation } = require('../../validations');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Sentiment Analysis
 *   description: Sentiment analysis for patient conversations
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SentimentAnalysis:
 *       type: object
 *       properties:
 *         overallSentiment:
 *           type: string
 *           enum: [positive, negative, neutral, mixed]
 *           description: Overall sentiment classification
 *         sentimentScore:
 *           type: number
 *           minimum: -1
 *           maximum: 1
 *           description: Sentiment score from -1 (very negative) to 1 (very positive)
 *         confidence:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           description: Confidence level of the analysis
 *         patientMood:
 *           type: string
 *           description: Description of patient's emotional state
 *         keyEmotions:
 *           type: array
 *           items:
 *             type: string
 *           description: Key emotions detected in the conversation
 *         concernLevel:
 *           type: string
 *           enum: [low, medium, high]
 *           description: Level of concern detected
 *         satisfactionIndicators:
 *           type: object
 *           properties:
 *             positive:
 *               type: array
 *               items:
 *                 type: string
 *             negative:
 *               type: array
 *               items:
 *                 type: string
 *         summary:
 *           type: string
 *           description: Brief summary of the emotional analysis
 *         recommendations:
 *           type: string
 *           description: Recommendations for follow-up care
 *         fallback:
 *           type: boolean
 *           description: Whether this analysis used fallback parsing
 *     
 *     SentimentTrendPoint:
 *       type: object
 *       properties:
 *         conversationId:
 *           type: string
 *           description: ID of the conversation
 *         date:
 *           type: string
 *           format: date-time
 *           description: Date of the conversation
 *         duration:
 *           type: number
 *           description: Duration of the conversation in seconds
 *         sentiment:
 *           $ref: '#/components/schemas/SentimentAnalysis'
 *         sentimentAnalyzedAt:
 *           type: string
 *           format: date-time
 *           description: When the sentiment was analyzed
 *     
 *     SentimentTrend:
 *       type: object
 *       properties:
 *         patientId:
 *           type: string
 *           description: ID of the patient
 *         timeRange:
 *           type: string
 *           enum: [lastCall, month, lifetime]
 *           description: Time range of the analysis
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: Start date of the analysis period
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: End date of the analysis period
 *         totalConversations:
 *           type: number
 *           description: Total number of conversations in the period
 *         analyzedConversations:
 *           type: number
 *           description: Number of conversations with sentiment analysis
 *         dataPoints:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SentimentTrendPoint'
 *         summary:
 *           type: object
 *           properties:
 *             averageSentiment:
 *               type: number
 *               description: Average sentiment score across all conversations
 *             sentimentDistribution:
 *               type: object
 *               additionalProperties:
 *                 type: number
 *               description: Distribution of sentiment classifications
 *             trendDirection:
 *               type: string
 *               enum: [improving, declining, stable]
 *               description: Overall trend direction
 *             confidence:
 *               type: number
 *               description: Confidence in the trend analysis
 *             keyInsights:
 *               type: array
 *               items:
 *                 type: string
 *               description: Key insights from the analysis
 *     
 *     SentimentSummary:
 *       type: object
 *       properties:
 *         totalConversations:
 *           type: number
 *           description: Total recent conversations
 *         analyzedConversations:
 *           type: number
 *           description: Number of conversations with sentiment analysis
 *         averageSentiment:
 *           type: number
 *           description: Average sentiment score
 *         sentimentDistribution:
 *           type: object
 *           additionalProperties:
 *             type: number
 *           description: Distribution of sentiment classifications
 *         trendDirection:
 *           type: string
 *           enum: [improving, declining, stable]
 *           description: Recent trend direction
 *         confidence:
 *           type: number
 *           description: Confidence in the analysis
 *         keyInsights:
 *           type: array
 *           items:
 *             type: string
 *           description: Key insights
 *         recentTrend:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SentimentTrendPoint'
 *           description: Recent conversation sentiment data
 */

/**
 * @swagger
 * /sentiment/patient/{patientId}/trend:
 *   get:
 *     summary: Get sentiment trend for a patient over time
 *     description: Returns sentiment analysis data points for a patient over a specified time range, suitable for displaying in graphs and charts.
 *     tags: [Sentiment Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: The patient ID
 *       - in: query
 *         name: timeRange
 *         required: false
 *         schema:
 *           type: string
 *           enum: [lastCall, month, lifetime]
 *           default: lastCall
 *         description: Time range for the sentiment trend analysis
 *     responses:
 *       "200":
 *         description: Sentiment trend data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SentimentTrend'
 *       "400":
 *         description: Bad request - invalid timeRange parameter
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         description: Patient not found
 */
router
  .route('/patient/:patientId/trend')
  .get(
    auth('readAny:conversation'),
    validate(sentimentValidation.getSentimentTrend),
    sentimentController.getSentimentTrend
  );

/**
 * @swagger
 * /sentiment/patient/{patientId}/summary:
 *   get:
 *     summary: Get sentiment summary for a patient
 *     description: Returns a summary of recent sentiment analysis for a patient, including key insights and trends.
 *     tags: [Sentiment Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: The patient ID
 *     responses:
 *       "200":
 *         description: Sentiment summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SentimentSummary'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         description: Patient not found
 */
router
  .route('/patient/:patientId/summary')
  .get(
    auth('readAny:conversation'),
    validate(sentimentValidation.getSentimentSummary),
    sentimentController.getSentimentSummary
  );

/**
 * @swagger
 * /sentiment/conversation/{conversationId}:
 *   get:
 *     summary: Get sentiment analysis for a specific conversation
 *     description: Returns the sentiment analysis data for a specific conversation if available.
 *     tags: [Sentiment Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The conversation ID
 *     responses:
 *       "200":
 *         description: Sentiment analysis retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversationId:
 *                   type: string
 *                 sentiment:
 *                   $ref: '#/components/schemas/SentimentAnalysis'
 *                 sentimentAnalyzedAt:
 *                   type: string
 *                   format: date-time
 *                 hasSentimentAnalysis:
 *                   type: boolean
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         description: Conversation not found
 */
router
  .route('/conversation/:conversationId')
  .get(
    auth('readAny:conversation'),
    validate(sentimentValidation.getConversationSentiment),
    sentimentController.getConversationSentiment
  );

/**
 * @swagger
 * /sentiment/conversation/{conversationId}/analyze:
 *   post:
 *     summary: Trigger sentiment analysis for a conversation
 *     description: Manually triggers sentiment analysis for a completed conversation using ChatGPT.
 *     tags: [Sentiment Analysis]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The conversation ID
 *     responses:
 *       "200":
 *         description: Sentiment analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 conversationId:
 *                   type: string
 *                 sentiment:
 *                   $ref: '#/components/schemas/SentimentAnalysis'
 *                 analyzedAt:
 *                   type: string
 *                   format: date-time
 *       "400":
 *         description: Bad request - conversation not completed or already analyzed
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         description: Conversation not found
 *       "500":
 *         description: Sentiment analysis failed
 */
router
  .route('/conversation/:conversationId/analyze')
  .post(
    auth('updateAny:conversation'),
    validate(sentimentValidation.analyzeConversationSentiment),
    sentimentController.analyzeConversationSentiment
  );

module.exports = router;

