const express = require('express');
const validateTwilioRequest = require('../../middlewares/validateTwilioRequest');
const twilioCallController = require('../../controllers/twilioCall.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: TwilioCalls
 *   description: Handling Twilio calls
 */

/**
 * @swagger
 * /twilio/call-handler:
 *   post:
 *     summary: Endpoint for Twilio to invoke on incoming calls
 *     description: Receives call data from Twilio and processes the call
 *     tags: [TwilioCalls]
 *     responses:
 *       "200":
 *         description: TwiML instructions sent to Twilio
 *         content:
 *           application/xml:
 *             schema:
 *               type: string
 */
router.post('/call-handler', 
    validateTwilioRequest,
    twilioCallController.handleIncomingCall);

/**
 * @swagger
 * /twilio/prepare-call-for-transcription:
 *   post:
 *     summary: Endpoint for Twilio to invoke for call recording processing
 *     description: Receives call recording data from Twilio
 *     tags: [TwilioCalls]
 *     responses:
 *       "200":
 *         description: Call recording processed successfully
 */
router.post('/prepare-call-for-transcription', 
    validateTwilioRequest,
    twilioCallController.prepareCallForTranscription);

// Endpoint for handling real-time interactions during a call
/**
 * @swagger
 * /twilio/real-time-interaction:
 *   post:
 *     summary: Endpoint for handling real-time interactions during a call
 *     description: Receives and processes user's real-time input during a Twilio call
 *     tags: [TwilioCalls]
 *     responses:
 *       "200":
 *         description: Real-time interaction handled successfully
 */
router.post('/real-time-interaction', 
validateTwilioRequest,
twilioCallController.handleRealTimeInteraction);

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
router.post('/initiate', validateTwilioRequest,
twilioCallController.initiateCall);


module.exports = router;
