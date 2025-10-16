/**
 * MFA Routes
 * 
 * Endpoints for Multi-Factor Authentication management
 */

const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const mfaController = require('../../controllers/mfa.controller');
const Joi = require('joi');

const router = express.Router();

// Validation schemas
const verifyMFAToken = {
  body: Joi.object().keys({
    token: Joi.string().required().description('6-digit TOTP token or 8-character backup code')
  })
};

// All MFA routes require authentication
router.use(auth());

/**
 * @route   GET /v1/mfa/status
 * @desc    Get MFA status for current user
 * @access  Private
 */
router.get('/status', mfaController.getMFAStatus);

/**
 * @route   POST /v1/mfa/enable
 * @desc    Enable MFA (Step 1: Generate QR code and backup codes)
 * @access  Private
 */
router.post('/enable', mfaController.enableMFA);

/**
 * @route   POST /v1/mfa/verify
 * @desc    Verify and enable MFA (Step 2: Verify TOTP token)
 * @access  Private
 */
router.post('/verify', validate(verifyMFAToken), mfaController.verifyAndEnableMFA);

/**
 * @route   POST /v1/mfa/disable
 * @desc    Disable MFA (requires current MFA token)
 * @access  Private
 */
router.post('/disable', validate(verifyMFAToken), mfaController.disableMFA);

/**
 * @route   POST /v1/mfa/backup-codes
 * @desc    Regenerate backup codes (requires current MFA token)
 * @access  Private
 */
router.post('/backup-codes', validate(verifyMFAToken), mfaController.regenerateBackupCodes);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: MFA
 *   description: Multi-Factor Authentication management
 */

/**
 * @swagger
 * /mfa/status:
 *   get:
 *     summary: Get MFA status
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: MFA status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mfaEnabled:
 *                   type: boolean
 *                 mfaEnrolledAt:
 *                   type: string
 *                   format: date-time
 *                 backupCodesRemaining:
 *                   type: number
 */

/**
 * @swagger
 * /mfa/enable:
 *   post:
 *     summary: Enable MFA (Step 1)
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: QR code and backup codes generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qrCode:
 *                   type: string
 *                   description: Base64 QR code image
 *                 secret:
 *                   type: string
 *                   description: Secret key for manual entry
 *                 backupCodes:
 *                   type: array
 *                   items:
 *                     type: string
 */

/**
 * @swagger
 * /mfa/verify:
 *   post:
 *     summary: Verify and enable MFA (Step 2)
 *     tags: [MFA]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: 6-digit TOTP token
 *     responses:
 *       200:
 *         description: MFA successfully enabled
 */

