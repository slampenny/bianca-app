const express = require('express');
const twilioCallController = require('../../controllers/twilioCall.controller');
const bypassTwilioAuthMiddleware = require('../../middlewares/bypassTwilioValidation');
const validate = require('../../middlewares/validate');
const twilioCallValidation = require('../../validations/twilioCall.validation');

const router = express.Router();

/**
 * @swagger
 * /twilio/initiate:
 *   post:
 *     summary: Initiate an outbound call to a patient via Twilio
 *     description: Called by your application backend/frontend to start a call. Requires patientId.
 *     tags: [TwilioCalls]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InitiateCallPayload'
 *     responses:
 *       "200":
 *         description: Call initiation request accepted by Twilio.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Call initiated successfully
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/initiate', validate(twilioCallValidation.initiate), twilioCallController.initiateCall);

/**
 * @swagger
 * /twilio/start-call/{patientId}:
 *   post:
 *     summary: Provides TwiML instructions to connect to Asterisk SIP
 *     description: Webhook called by Twilio when the outbound call connects. Responds with TwiML to connect to Asterisk.
 *     tags: [TwilioCalls]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         schema:
 *           type: string
 *         required: true
 *         description: Patient ID
 *     requestBody:
 *       description: Form-encoded data sent by Twilio (e.g., CallSid).
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: TwiML instructions with SIP dial provided successfully.
 *         content:
 *           text/xml:
 *             schema:
 *               type: string
 *       "403":
 *         description: Twilio validation failed.
 */
router.post(
  '/start-call/:patientId',
  express.urlencoded({ extended: false }),
  bypassTwilioAuthMiddleware,
  twilioCallController.handleStartCall
);

/**
 * @swagger
 * /twilio/call-status:
 *   post:
 *     summary: Handles call status updates from Twilio
 *     description: Webhook called by Twilio when the call reaches a terminal status (completed, failed, busy, no-answer).
 *     tags: [TwilioCalls]
 *     requestBody:
 *       description: Form-encoded data sent by Twilio (e.g., CallSid, CallStatus, CallDuration).
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Call status received and acknowledged.
 *         content:
 *           text/xml:
 *             example: <Response/>
 *       "403":
 *         description: Twilio validation failed.
 */
router.post(
  '/call-status', 
  express.urlencoded({ extended: false }), 
  bypassTwilioAuthMiddleware, 
  twilioCallController.handleCallStatus
);

/**
 * @swagger
 * /twilio/test-sip:
 *   get:
 *     summary: Test the SIP dialing capability
 *     description: Returns TwiML that calls the Asterisk SIP endpoint directly.
 *     tags: [TwilioCalls]
 *     responses:
 *       "200":
 *         description: TwiML for SIP test
 */
router.get('/test-sip', (req, res) => {
  const VoiceResponse = require('twilio').twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const sipHost = new URL(config.asterisk.url).hostname || 'sip.myphonefriend.com'; // resolves from Asterisk config
  const sipPort = new URL(config.asterisk.url).port || '5060'; // fallback if port not parsed
  const testPatientId = 'direct-sip-test';
  const testTwilioSid = `TEST_SIP_${Date.now()}`;

  twiml.say('Testing SIP connection to Asterisk from Twilio.');
  twiml.dial({
    callerId: config.twilio.phone || '+19786256514',
    timeout: 15
  }).sip(`sip:bianca@${sipHost}:${sipPort}?patientId=${testPatientId}&callSid=${testTwilioSid}`);

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type('text/xml');
  res.send(twiml.toString());
});

module.exports = router;