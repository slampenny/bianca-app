const express = require('express');
const auth = require('../../middlewares/auth');
const reportController = require('../../controllers/report.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Report generation and retrieval
 */

/**
 * @swagger
 * /reports:
 *   post:
 *     summary: Generate a report
 *     description: Only authorized users can generate reports.
 *     tags: [Reports]
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
 *       "201":
 *         description: Report generated
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
  .route('/')
  .post(auth('manageReports'), reportController.generateReport);

module.exports = router;
