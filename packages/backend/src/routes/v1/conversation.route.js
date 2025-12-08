const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const conversationController = require('../../controllers/conversation.controller');
const { conversationValidation } = require('../../validations');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Conversations
 *   description: Conversation handling and storage
 */

/**
 * @swagger
 * /conversations/patient/{patientId}:
 *   post:
 *     summary: Create a conversation for a patient
 *     description: Only authorized patients can create conversations.
 *     tags: [Conversations]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: The patient ID
 *     responses:
 *       "201":
 *         description: Conversation created
 *       "400":
 *         description: Bad request
 *       "401":
 *         description: Unauthorized
 */
router
  .route('/patient/:patientId')
  .post(
    auth('updateAny:conversation'),
    validate(conversationValidation.createConversationForPatient),
    conversationController.createConversationForPatient
  );

/**
 * @swagger
 * /conversations/{conversationId}:
 *   post:
 *     summary: Add a message to a conversation
 *     description: Add a message to an existing conversation. Only authorized users can add messages.
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The conversation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *               - content
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [patient, assistant, system, debug-user]
 *                 description: The role of the message sender
 *               content:
 *                 type: string
 *                 description: The content of the message
 *               messageType:
 *                 type: string
 *                 enum: [text, assistant_response, user_message, function_call, audio_transcript_delta, debug_user_message]
 *                 default: text
 *               metadata:
 *                 type: object
 *                 description: Optional metadata for the message
 *     responses:
 *       "200":
 *         description: Message added successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Conversation'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/:conversationId')
  .post(
    auth('updateAny:conversation'),
    validate(conversationValidation.addMessageToConversation),
    conversationController.addMessageToConversation
  );

/**
 * @swagger
 * /conversations:
 *   get:
 *     summary: Get conversations (query)
 *     description: Get conversations with optional query parameters (patientId, status, etc.)
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: patientId
 *         schema:
 *           type: string
 *         description: Filter by patient ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [initiated, in-progress, completed, failed, machine]
 *         description: Filter by conversation status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: Sort by field (e.g., startTime:desc)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Maximum number of results
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Conversation'
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 totalResults:
 *                   type: integer
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */
router
  .route('/')
  .get(
    auth('readAny:conversation'),
    validate(conversationValidation.getConversation),
    conversationController.getConversation
  );

/**
 * @swagger
 * /conversations/{conversationId}:
 *   get:
 *     summary: Get a conversation by ID
 *     description: Get a specific conversation with its messages
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Conversation id
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Conversation'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/:conversationId')
  .get(
    auth('readOwn:conversation', 'readAny:conversation'),
    validate(conversationValidation.getConversation),
    conversationController.getConversation
  );

module.exports = router;
