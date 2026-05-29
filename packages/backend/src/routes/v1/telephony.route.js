const express = require('express');
const voiceTelephonyController = require('../../controllers/voiceTelephony.controller');
const bypassTelephonyWebhookValidation = require('../../middlewares/bypassTelephonyWebhookValidation');
const validate = require('../../middlewares/validate');
const telephonyValidation = require('../../validations/telephony.validation');

const router = express.Router();

const webhookBodyParser = express.urlencoded({ extended: false });

/**
 * @swagger
 * /telephony/initiate:
 *   post:
 *     summary: Initiate an outbound call to a patient
 *     description: Called by the application to start a call. Requires clientId.
 *     tags: [Telephony]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InitiateCallPayload'
 *     responses:
 *       "200":
 *         description: Call initiation request accepted by the telephony provider.
 */
router.post('/initiate', validate(telephonyValidation.initiate), voiceTelephonyController.initiateCall);

/**
 * @swagger
 * /telephony/start-call/{clientId}:
 *   post:
 *     summary: Provider answer webhook — connect call to Asterisk SIP
 *     tags: [Telephony]
 */
router.get(
  '/start-call/:clientId',
  webhookBodyParser,
  bypassTelephonyWebhookValidation,
  voiceTelephonyController.handleStartCall
);
router.post(
  '/start-call/:clientId',
  webhookBodyParser,
  bypassTelephonyWebhookValidation,
  voiceTelephonyController.handleStartCall
);

/**
 * @swagger
 * /telephony/call-status:
 *   post:
 *     summary: Provider call status webhook
 *     tags: [Telephony]
 */
router.get(
  '/call-status',
  webhookBodyParser,
  bypassTelephonyWebhookValidation,
  voiceTelephonyController.handleCallStatus
);
router.post(
  '/call-status',
  webhookBodyParser,
  bypassTelephonyWebhookValidation,
  voiceTelephonyController.handleCallStatus
);

/**
 * @swagger
 * /telephony/test-sip:
 *   get:
 *     summary: Test SIP dialing to Asterisk
 *     tags: [Telephony]
 */
router.get('/test-sip', voiceTelephonyController.handleTestSip);

module.exports = router;
