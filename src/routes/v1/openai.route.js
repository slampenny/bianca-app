const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const openaiValidation = require('../../validations/openai.validation');
const openaiController = require('../../controllers/openai.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: OpenAI
 *   description: OpenAI Realtime API management and debugging
 */

/**
 * @swagger
 * /openai/recovery/{callId}:
 *   post:
 *     summary: Force recovery of OpenAI connection
 *     description: Force recovery of OpenAI Realtime API connection for a specific call
 *     tags: [OpenAI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *         description: Call/conversation ID
 *     responses:
 *       "200":
 *         description: Recovery initiated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  '/recovery/:callId',
  auth(),
  validate(openaiValidation.forceRecovery),
  openaiController.forceRecovery
);

/**
 * @swagger
 * /openai/status/{callId}:
 *   get:
 *     summary: Get OpenAI connection status
 *     description: Get the current status of OpenAI Realtime API connection for a specific call
 *     tags: [OpenAI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *         description: Call/conversation ID
 *     responses:
 *       "200":
 *         description: Status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 callId:
 *                   type: string
 *                 connected:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 lastActivity:
 *                   type: string
 *                   format: date-time
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/status/:callId',
  auth(),
  validate(openaiValidation.getStatus),
  openaiController.getStatus
);

/**
 * @swagger
 * /openai/connections:
 *   get:
 *     summary: Get all active OpenAI connections
 *     description: Retrieve all active OpenAI Realtime API connections
 *     tags: [OpenAI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Connections retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalConnections:
 *                   type: integer
 *                 connections:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       callId:
 *                         type: string
 *                       connected:
 *                         type: boolean
 *                       status:
 *                         type: string
 *                       lastActivity:
 *                         type: string
 *                         format: date-time
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get(
  '/connections',
  auth(),
  openaiController.getAllConnections
);

/**
 * @swagger
 * /openai/force-response/{callId}:
 *   post:
 *     summary: Force response generation
 *     description: Force OpenAI to generate a response even with silence (for testing/debugging)
 *     tags: [OpenAI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *         description: Call/conversation ID
 *     responses:
 *       "200":
 *         description: Response forced
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  '/force-response/:callId',
  auth(),
  validate(openaiValidation.getStatus), // Reuse the same validation
  openaiController.forceResponseWithSilence
);

/**
 * @swagger
 * /openai/upload-debug-audio/{callId}:
 *   post:
 *     summary: Upload debug audio files
 *     description: Manually upload debug audio files to S3 for a specific call
 *     tags: [OpenAI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *         description: Call/conversation ID
 *     responses:
 *       "200":
 *         description: Audio uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 urls:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: S3 URLs of uploaded audio files
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  '/upload-debug-audio/:callId',
  auth(),
  validate(openaiValidation.getStatus), // Reuse the same validation
  openaiController.uploadDebugAudio
);

module.exports = router; 