const express = require('express');
const validateTwilioRequest = require('../../middlewares/validateTwilioRequest');
const twilioCallController = require('../../controllers/twilioCall.controller');

const validate = require('../../middlewares/validate');
const twilioCallValidation = require('../../validations/twilioCall.validation');

const router = express.Router();

/**
 * @swagger
 * /twilio/initiate:
 *   post:
 *     summary: Initiate a call to a user
 *     description: Starts a phone call to the specified user using Twilio
 *     tags: [TwilioCalls]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The ID of the user to call
 *     responses:
 *       "200":
 *         description: Call initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Call initiated successfully
 *       "400":
 *         description: Bad request
 *       "404":
 *         description: User not found
 */
router.post('/initiate', validate(twilioCallValidation.initiate),
twilioCallController.initiateCall);

/**
 * @swagger
 * /twilio/prepare-call:
 *   post:
 *     summary: Endpoint for Twilio to invoke for call recording processing
 *     description: Receives call recording data from Twilio
 *     tags: [TwilioCalls]
 *     responses:
 *       "200":
 *         description: Call recording processed successfully
 */
router.post('/prepare-call', 
    validateTwilioRequest,
    twilioCallController.prepareCall);

// Endpoint for handling real-time interactions during a call
/**
 * @swagger
 * /twilio/real-time-interaction:
 *   post:
 *     summary: Endpoint for handling real-time interactions during a call
 *     description: Receives and processes user's real-time input (CallSid and SpeechResult) during a Twilio call
 *     tags: [TwilioCalls]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               CallSid:
 *                 type: string
 *                 description: The unique identifier for the call
 *               SpeechResult:
 *                 type: string
 *                 description: The result of the speech recognition
 *     responses:
 *       "200":
 *         description: Real-time interaction handled successfully
 */
router.post('/real-time-interaction', 
validateTwilioRequest,
twilioCallController.handleRealTimeInteraction);

/**
 * @swagger
 * /twilio/call-end:
 *   post:
 *     summary: Endpoint for handling the end of a call
 *     description: Receives a notification from Twilio when a call ends and processes any necessary cleanup or finalization tasks
 *     tags: [TwilioCalls]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               CallSid:
 *                 type: string
 *                 description: The unique identifier for the call
 *     responses:
 *       "200":
 *         description: Call end handled successfully
 */
router.post('/call-end', 
validateTwilioRequest,
twilioCallController.endCall);

module.exports = router;
