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
  .post(auth('createConversationForPatient'), validate(conversationValidation.createConversationForPatient), conversationController.createConversationForPatient);

/**
 * @swagger
 * /conversations/{conversationId}:
 *   post:
 *     summary: Add a message to a conversation
 *     description: Only authorized patients can add messages to conversations.
 *     tags: [Conversations]
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
 *                 description: The role of the patient adding the message
 *               content:
 *                 type: string
 *                 description: The content of the message
 *     responses:
 *       "200":
 *         description: Message added to conversation
 *       "400":
 *         description: Bad request
 *       "401":
 *         description: Unauthorized
 */
router
  .route('/:conversationId')
  .post(auth('addMessageToConversation'), validate(conversationValidation.addMessageToConversation), conversationController.addMessageToConversation);

  /**
 * @swagger
 * /conversations/{id}:
 *   get:
 *     summary: Get a conversation
 *     description: Logged in patients can fetch only their own conversation information. Only admins can fetch other conversation.
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
.route('/')
.get(auth('getConversation'), validate(conversationValidation.getConversation), conversationController.getConversation);

module.exports = router;
