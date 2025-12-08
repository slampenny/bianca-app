const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const callWorkflowValidation = require('../../validations/callWorkflow.validation');
const callWorkflowController = require('../../controllers/callWorkflow.controller');

const router = express.Router();

/**
 * @swagger
 * /calls/initiate:
 *   post:
 *     summary: Initiate a call to a patient
 *     description: Start an outbound call to a patient and create a conversation
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *             properties:
 *               patientId:
 *                 type: string
 *                 description: Patient ID to call
 *               callNotes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional notes about the call
 *     responses:
 *       "201":
 *         description: Call initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversationId:
 *                       type: string
 *                     callSid:
 *                       type: string
 *                     patientId:
 *                       type: string
 *                     patientName:
 *                       type: string
 *                     patientPhone:
 *                       type: string
 *                     agentId:
 *                       type: string
 *                     agentName:
 *                       type: string
 *                     callStatus:
 *                       type: string
 *                 message:
 *                   type: string
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/initiate', auth(), validate(callWorkflowValidation.initiate), callWorkflowController.initiateCall);

/**
 * @swagger
 * /calls/{conversationId}/status:
 *   get:
 *     summary: Get call status for a conversation
 *     description: Retrieve the current call status and details
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     responses:
 *       "200":
 *         description: Call status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     conversationId:
 *                       type: string
 *                     callStatus:
 *                       type: string
 *                     callStartTime:
 *                       type: string
 *                       format: date-time
 *                     callEndTime:
 *                       type: string
 *                       format: date-time
 *                     callDuration:
 *                       type: number
 *                     callOutcome:
 *                       type: string
 *                     callNotes:
 *                       type: string
 *                     patient:
 *                       type: object
 *                     agent:
 *                       type: object
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:conversationId/status', auth(), validate(callWorkflowValidation.getCallStatus), callWorkflowController.getCallStatus);

/**
 * @swagger
 * /calls/{conversationId}/status:
 *   post:
 *     summary: Update call status
 *     description: Update the status of an ongoing call (for webhooks)
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [initiating, ringing, answered, connected, ended, failed, busy, no_answer]
 *               outcome:
 *                 type: string
 *                 enum: [answered, no_answer, busy, failed, voicemail]
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       "200":
 *         description: Call status updated successfully
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:conversationId/status', auth(), validate(callWorkflowValidation.updateCallStatus), callWorkflowController.updateCallStatus);

/**
 * @swagger
 * /calls/{conversationId}/end:
 *   post:
 *     summary: End a call
 *     description: Manually end a call and record the outcome
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - outcome
 *             properties:
 *               outcome:
 *                 type: string
 *                 enum: [answered, no_answer, busy, failed, voicemail]
 *                 description: How the call ended
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional notes about the call
 *     responses:
 *       "200":
 *         description: Call ended successfully
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:conversationId/end', auth(), validate(callWorkflowValidation.endCall), callWorkflowController.endCall);

/**
 * @swagger
 * /calls/active:
 *   get:
 *     summary: Get active calls for current agent
 *     description: Retrieve all active calls for the authenticated agent
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Active calls retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Conversation'
 *                 count:
 *                   type: number
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/active', auth(), callWorkflowController.getActiveCalls);

/**
 * @swagger
 * /calls/{conversationId}/conversation:
 *   get:
 *     summary: Get conversation with call details
 *     description: Retrieve conversation details including call status and patient info
 *     tags: [Calls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation ID
 *     responses:
 *       "200":
 *         description: Conversation details retrieved successfully
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:conversationId/conversation', auth(), validate(callWorkflowValidation.getConversationWithCallDetails), callWorkflowController.getConversationWithCallDetails);

module.exports = router;
