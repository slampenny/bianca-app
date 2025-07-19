const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const openaiValidation = require('../../validations/openai.validation');
const openaiController = require('../../controllers/openai.controller');

const router = express.Router();

/**
 * @route   POST /v1/openai/recovery/:callId
 * @desc    Force recovery of OpenAI connection for a specific call
 * @access  Private
 */
router.post(
  '/recovery/:callId',
  auth(),
  validate(openaiValidation.forceRecovery),
  openaiController.forceRecovery
);

/**
 * @route   GET /v1/openai/status/:callId
 * @desc    Get OpenAI connection status for a specific call
 * @access  Private
 */
router.get(
  '/status/:callId',
  auth(),
  validate(openaiValidation.getStatus),
  openaiController.getStatus
);

/**
 * @route   GET /v1/openai/connections
 * @desc    Get all active OpenAI connections
 * @access  Private
 */
router.get(
  '/connections',
  auth(),
  openaiController.getAllConnections
);

/**
 * @route   POST /v1/openai/force-response/:callId
 * @desc    Force response generation even with silence (for testing)
 * @access  Private
 */
router.post(
  '/force-response/:callId',
  auth(),
  validate(openaiValidation.getStatus), // Reuse the same validation
  openaiController.forceResponseWithSilence
);

/**
 * @route   POST /v1/openai/upload-debug-audio/:callId
 * @desc    Manually upload debug audio files to S3
 * @access  Private
 */
router.post(
  '/upload-debug-audio/:callId',
  auth(),
  validate(openaiValidation.getStatus), // Reuse the same validation
  openaiController.uploadDebugAudio
);

module.exports = router; 