const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const callValidation = require('../../validations/call.validation');
const callController = require('../../controllers/call.controller');

const router = express.Router();

router
  .route('/schedule')
  .post(auth('manageCalls'), validate(callValidation.scheduleCall), callController.scheduleCall);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Calls
 *   description: Call scheduling and management
 */

/**
 * @swagger
 * /calls/schedule:
 *   post:
 *     summary: Schedule a new call
 *     description: Authorized users can schedule calls.
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
 *               - userId
 *               - dateTime
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Unique user identifier
 *               dateTime:
 *                 type: string
 *                 format: date-time
 *                 description: Scheduled time for the call
 *             example:
 *               userId: "12345"
 *               dateTime: "2024-01-01T10:00:00Z"
 *     responses:
 *       "201":
 *         description: Call scheduled
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */
