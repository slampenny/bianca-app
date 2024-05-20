const express = require('express');
const auth = require('../../middlewares/auth');
const testController = require('../../controllers/test.controller');

const router = express.Router();

/**
 * @swagger
 * /test/chat:
 *   post:
 *     summary: Test the chatWith function
 *     description: This is for testing purposes only.
 *     tags: [Test]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *               - patientId
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
 *               patientId:
 *                 type: string
 *     responses:
 *       "200":
 *         description: ChatGPT response
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/chat', testController.testChatWith);

/**
 * @swagger
 * /test/summarize:
 *   post:
 *     summary: Test the summarizeConversation function
 *     description: This is for testing purposes only.
 *     tags: [Test]
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
router.post('/summarize', testController.testSummarize);

/**
 * @swagger
 * /test/clean:
 *   post:
 *     summary: Test the summarizeConversation function
 *     description: This is for testing purposes only.
 *     tags: [Test]
 *     responses:
 *       "200":
 *         description: Clean response
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 */
router.post('/clean', testController.testCleanDB);

module.exports = router;