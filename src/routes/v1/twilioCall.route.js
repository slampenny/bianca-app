const express = require('express');
const twilio = require('twilio');
const twilioCallController = require('../../controllers/twilioCall.controller');
const config = require('../../config/config');
const logger = require('../../config/logger');
const validate = require('../../middlewares/validate');
const twilioCallValidation = require('../../validations/twilioCall.validation');

const router = express.Router();

const twilioAuthMiddleware = (req, res, next) => {
  try {
    const signature = req.header('X-Twilio-Signature');
    const url = config.twilio.apiUrl + req.originalUrl;
    const params = req.body;

    logger.debug(`[Twilio Route] Validating Request: URL=${url}, Params=${JSON.stringify(params)}, Sig=${signature}`);

    const isValid = twilio.validateRequest(config.twilio.authToken, signature, url, params);

    if (isValid) {
      logger.info('[Twilio Route] Twilio request signature validated successfully.');
      return next();
    }
    logger.error('[Twilio Route] Twilio request signature validation failed.');
    return res.status(403).type('text/plain').send('Twilio request validation failed.');
  } catch (error) {
    logger.error('[Twilio Route] Error during Twilio request validation:', error);
    return res.status(500).type('text/plain').send('Error during request validation.');
  }
};

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
 * /twilio/start-stream:
 *   post:
 *     summary: Provides TwiML instructions to start a media stream
 *     description: Webhook called by Twilio when the outbound call connects. Responds with TwiML containing <Connect><Stream>.
 *     tags: [TwilioCalls]
 *     requestBody:
 *       description: Form-encoded data sent by Twilio (e.g., CallSid).
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: TwiML instructions with <Connect><Stream> provided successfully.
 *         content:
 *           text/xml:
 *             schema:
 *               type: string
 *       "403":
 *         description: Twilio validation failed.
 */
router.post(
  '/start-stream/:patientId',
  express.urlencoded({ extended: false }),
  twilioAuthMiddleware,
  twilioCallController.handleStartStream
);

/**
 * @swagger
 * /twilio/end-call:
 *   post:
 *     summary: Handles final call status updates from Twilio
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
router.post('/end-call', express.urlencoded({ extended: false }), twilioAuthMiddleware, twilioCallController.handleEndCall);

// Obsolete endpoints (commented out)
/**
 * @swagger
 * /twilio/prepare-call:
 *   post:
 *     summary: (OBSOLETE) Provides TwiML instructions when a call connects or is redirected
 *     description: Webhook called by Twilio when the outbound call connects OR when redirected here via TwiML.
 *     tags: [TwilioCalls]
 *     responses:
 *       "200":
 *         description: TwiML instructions provided successfully.
 *         content:
 *           text/xml:
 *             schema:
 *               type: string
 *       "403":
 *         description: Twilio validation failed.
 */
/*
router.post(
  '/prepare-call',
  express.urlencoded({ extended: false }),
  twilioAuthMiddleware,
  twilioCallController.prepareCall
);
*/

/**
 * @swagger
 * /twilio/real-time-interaction:
 *   post:
 *     summary: (OBSOLETE) Processes input gathered during the call (speech/DTMF)
 *     description: Webhook called by Twilio with the results from a <Gather> verb.
 *     tags: [TwilioCalls]
 *     requestBody:
 *       description: Form-encoded data sent by Twilio (e.g., CallSid, SpeechResult, Digits).
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: TwiML response for next step in conversation.
 *         content:
 *           text/xml:
 *             schema:
 *               type: string
 *       "403":
 *         description: Twilio validation failed.
 */
/*
router.post(
  '/real-time-interaction',
  express.urlencoded({ extended: false }),
  twilioAuthMiddleware,
  twilioCallController.handleRealTimeInteraction
);
*/

module.exports = router;
