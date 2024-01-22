const express = require('express');
const auth = require('../../middlewares/auth');
const reportController = require('../../controllers/report.controller');

const router = express.Router();

router
  .route('/:userId')
  .get(auth('getReports'), reportController.getReportForUser);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Report generation and retrieval
 */

/**
 * @swagger
 * /reports/{userId}:
 *   get:
 *     summary: Get reports for a user
 *     description: Authorized users can retrieve reports for a specific user.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique user identifier
 *     responses:
 *       "200":
 *         description: Report data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 report:
 *                   type: object
 *                   description: Detailed report data
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
