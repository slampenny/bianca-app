const express = require('express');
const auth = require('../../middlewares/auth');
const chatController = require('../../controllers/chat.controller');

const router = express.Router();

// Existing routes...

/**
 * @swagger
 * /chat/test:
 *   post:
 *     summary: Test the chatWith function
 *     description: This is for testing purposes only.
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *               - userId
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                     content:
 *                       type: string
 *               userId:
 *                 type: string
 *     responses:
 *       "200":
 *         description: ChatGPT response
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/test', chatController.testChatWith);

/**
 * @swagger
 * /chat/test-summarize:
 *   post:
 *     summary: Test the summarizeConversation function
 *     description: This is for testing purposes only.
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - conversationId
 *             properties:
 *               conversationId:
 *                 type: string
 *     responses:
 *       "200":
 *         description: Summarization response
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/test-summarize', chatController.testSummarize);

module.exports = router;