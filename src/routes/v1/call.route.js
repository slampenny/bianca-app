const express = require('express');
const auth = require('../../middlewares/auth');
const conversationController = require('../../controllers/conversation.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Conversations
 *   description: Conversation handling and storage
 */

/**
 * @swagger
 * /conversations:
 *   post:
 *     summary: Store a conversation
 *     description: Only authorized users can store conversations.
 *     tags: [Conversations]
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
 *               text:
 *                 type: string
 *     responses:
 *       "201":
 *         description: Conversation stored
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
  .route('/')
  .post(auth('manageConversations'), conversationController.storeConversation);

module.exports = router;
