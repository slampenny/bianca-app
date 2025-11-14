// src/routes/v1/telemetry.route.js
// HIPAA-compliant telemetry routes

const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../../middlewares/auth');
const telemetryService = require('../../services/telemetry.service');
const { Caregiver } = require('../../models');
const { auditMiddleware: auditLog } = require('../../middlewares/auditLog');
const logger = require('../../config/logger');

const router = express.Router();

/**
 * Rate limiting for telemetry endpoints
 * Prevents abuse and ensures HIPAA compliance
 */
const telemetryLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Max 100 events per minute per IP
  message: 'Too many telemetry requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all telemetry routes
router.use(telemetryLimiter);

/**
 * @swagger
 * tags:
 *   name: Telemetry
 *   description: HIPAA-compliant telemetry tracking endpoints
 */

/**
 * @swagger
 * /telemetry/track:
 *   post:
 *     summary: Track a telemetry event
 *     description: Records a telemetry event with automatic PII scrubbing. This endpoint is HIPAA compliant as it automatically removes all PII and sensitive data before tracking. Access is restricted to authenticated users.
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event
 *             properties:
 *               event:
 *                 type: string
 *                 description: Event name (e.g., "screen.viewed", "feature.used")
 *                 example: "report.viewed"
 *               properties:
 *                 type: object
 *                 description: Event properties (PII will be automatically removed)
 *                 example:
 *                   screenName: "ReportsScreen"
 *                   featureName: "fraudAbuseAnalysis"
 *     responses:
 *       200:
 *         description: Event tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid request
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         description: Too many requests
 */
router.post(
  '/track',
  auth(),
  auditLog,
  async (req, res) => {
    try {
      const { event, properties = {} } = req.body;
      const userId = req.caregiver?.id || req.caregiver?._id?.toString();

      // Validate event name
      if (!event || typeof event !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Event name is required and must be a string',
        });
      }

      // Check if user has opted in to telemetry
      if (userId) {
        try {
          const caregiver = await Caregiver.findById(userId);
          if (caregiver && caregiver.telemetryOptIn === false) {
            // User has opted out, silently skip tracking
            return res.json({ success: true, skipped: true });
          }
        } catch (error) {
          logger.error('Error checking telemetry opt-in:', error);
          // Continue with tracking if check fails
        }
      }

      // Track event (PII will be automatically scrubbed by telemetry service)
      await telemetryService.track(userId, event, {
        ...properties,
        userAgent: req.headers['user-agent'],
        platform: 'web', // Could be enhanced to detect mobile
      });

      res.json({ success: true });
    } catch (error) {
      logger.error('Telemetry track error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track event',
      });
    }
  }
);

/**
 * @swagger
 * /telemetry/identify:
 *   post:
 *     summary: Identify a user for telemetry
 *     description: Associates user traits with a user ID. All PII is automatically removed. This endpoint is HIPAA compliant. Access is restricted to authenticated users.
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - traits
 *             properties:
 *               traits:
 *                 type: object
 *                 description: User traits (PII will be automatically removed)
 *                 example:
 *                   role: "caregiver"
 *                   accountType: "premium"
 *     responses:
 *       200:
 *         description: User identified successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post(
  '/identify',
  auth(),
  auditLog,
  async (req, res) => {
    try {
      const { traits = {} } = req.body;
      const userId = req.caregiver?.id || req.caregiver?._id?.toString();

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
      }

      // Check opt-in status
      try {
        const caregiver = await Caregiver.findById(userId);
        if (caregiver && caregiver.telemetryOptIn === false) {
          return res.json({ success: true, skipped: true });
        }
      } catch (error) {
        logger.error('Error checking telemetry opt-in:', error);
      }

      // Identify user (traits will be sanitized)
      await telemetryService.identify(userId, traits);

      res.json({ success: true });
    } catch (error) {
      logger.error('Telemetry identify error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to identify user',
      });
    }
  }
);

/**
 * @swagger
 * /telemetry/opt-in:
 *   post:
 *     summary: Update telemetry opt-in status
 *     description: Allows users to opt in or out of telemetry tracking. This endpoint is HIPAA compliant and respects user privacy preferences.
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - optIn
 *             properties:
 *               optIn:
 *                 type: boolean
 *                 description: Whether to opt in to telemetry
 *                 example: true
 *     responses:
 *       200:
 *         description: Opt-in status updated successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post(
  '/opt-in',
  auth(),
  auditLog,
  async (req, res) => {
    try {
      const { optIn } = req.body;
      const userId = req.caregiver?.id || req.caregiver?._id?.toString();

      if (typeof optIn !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'optIn must be a boolean',
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
      }

      // Update user's opt-in status
      await Caregiver.findByIdAndUpdate(userId, {
        telemetryOptIn: optIn,
      });

      // Track the opt-in/opt-out event (if they're opting in)
      if (optIn) {
        await telemetryService.track(userId, 'telemetry.opted_in');
      } else {
        // Don't track opt-out to respect privacy
        logger.info(`User ${userId} opted out of telemetry`);
      }

      res.json({ success: true, optIn });
    } catch (error) {
      logger.error('Telemetry opt-in error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update opt-in status',
      });
    }
  }
);

module.exports = router;

