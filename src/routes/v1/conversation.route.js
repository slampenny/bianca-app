const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const conversationValidation = require('../../validations/conversation.validation');
const conversationController = require('../../controllers/conversation.controller');

const router = express.Router();

router
  .route('/analyze')
  .post(auth('analyzeConversations'), validate(conversationValidation.analyzeConversation), conversationController.analyzeConversation);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Conversations
 *   description: Conversation handling and analysis
 */

/**
 * @swagger
 * /conversations/analyze:
 *   post:
 *     summary: Analyze a conversation
 *     description: Authorized users can analyze conversation data.
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - text
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Unique user identifier
 *               text:
 *                 type: string
 *                 description: Text content of the conversation
 *             example:
 *               userId: "12345"
 *               text: "Conversation content goes here..."
 *     responses:
 *       "200":
 *         description: Analysis complete
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */
