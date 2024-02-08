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

  /**
 * @swagger
 * /conversations/{id}:
 *   get:
 *     summary: Get a conversation
 *     description: Logged in users can fetch only their own conversation information. Only admins can fetch other conversation.
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
