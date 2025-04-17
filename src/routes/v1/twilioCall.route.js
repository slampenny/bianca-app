// ../routes/v1/twilio.routes.js
const express = require('express');
const validateTwilioRequest = require('../../middlewares/validateTwilioRequest'); // Your validation middleware
const twilioCallController = require('../../controllers/twilioCall.controller');
const validate = require('../../middlewares/validate'); // Your validation framework for initiate
const twilioCallValidation = require('../../validations/twilioCall.validation'); // Validation rules for initiate

const router = express.Router();

// IMPORTANT: Ensure body-parsing middleware (e.g., express.urlencoded({ extended: false }))
// is applied *before* this router in your main application setup (app.js) for the POST webhooks.

/**
 * @swagger
 * /twilio/initiate:
 * post:
 * summary: Initiate an outbound call to a patient via Twilio
 * description: Called by your application backend/frontend to start a call. Requires patientId.
 * tags: [TwilioCalls]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/InitiateCallPayload' # Reference schema if defined elsewhere
 * responses:
 * "200":
 * description: Call initiation request accepted by Twilio.
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * message:
 * type: string
 * example: Call initiated successfully
 * "400":
 * $ref: '#/components/responses/BadRequest' # Reference standard responses
 * "404":
 * $ref: '#/components/responses/NotFound' # Reference standard responses
 */
router.post(
    '/initiate',
    validate(twilioCallValidation.initiate), // Use your specific validation for this endpoint
    twilioCallController.initiateCall
);

/**
 * @swagger
 * /twilio/prepare-call:
 * post:
 * summary: Provides TwiML instructions when a call connects or is redirected
 * description: Webhook called by Twilio when the outbound call connects OR when redirected here via TwiML. Expects TwiML response. Requires Twilio validation.
 * tags: [TwilioCalls]
 * responses:
 * "200":
 * description: TwiML instructions provided successfully.
 * content:
 * text/xml: {} # Indicate XML response
 * "403":
 * description: Twilio validation failed.
 */
router.post(
    '/prepare-call',
 //   validateTwilioRequest, // Apply Twilio validation middleware
    twilioCallController.prepareCall
);

/**
 * @swagger
 * /twilio/real-time-interaction:
 * post:
 * summary: Processes input gathered during the call (speech/DTMF)
 * description: Webhook called by Twilio with the results from a <Gather> verb. Expects TwiML response. Requires Twilio validation.
 * tags: [TwilioCalls]
 * requestBody:
 * description: Form-encoded data sent by Twilio (e.g., CallSid, SpeechResult, Digits).
 * content:
 * application/x-www-form-urlencoded: {} # Twilio sends form data
 * responses:
 * "200":
 * description: TwiML response for next step in conversation.
 * content:
 * text/xml: {} # Indicate XML response
 * "403":
 * description: Twilio validation failed.
 */
router.post(
    '/real-time-interaction',
 //   validateTwilioRequest, // Apply Twilio validation middleware
    twilioCallController.handleRealTimeInteraction
);

/**
 * @swagger
 * /twilio/end-call:
 * post:
 * summary: Handles final call status updates from Twilio
 * description: Webhook called by Twilio when the call reaches a terminal status (completed, failed, busy, no-answer). Performs cleanup/logging. Expects empty TwiML response. Requires Twilio validation.
 * tags: [TwilioCalls]
 * requestBody:
 * description: Form-encoded data sent by Twilio (e.g., CallSid, CallStatus, CallDuration).
 * content:
 * application/x-www-form-urlencoded: {} # Twilio sends form data
 * responses:
 * "200":
 * description: Call status received and acknowledged.
 * content:
 * text/xml:
 * example: <Response/>
 * "403":
 * description: Twilio validation failed.
 */
router.post(
    '/end-call',
 //   validateTwilioRequest, // Apply Twilio validation middleware
    twilioCallController.endCall
);

module.exports = router;