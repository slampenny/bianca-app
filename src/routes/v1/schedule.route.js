const express = require('express');
const auth = require('../../middlewares/auth');
const scheduleController = require('../../controllers/schedule.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Schedules
 *   description: Schedule management
 */

/**
 * @swagger
 * /schedules:
 *   post:
 *     summary: Create or update a schedule
 *     description: Only authorized users can create or update schedules.
 *     tags: [Schedules]
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
 *               dateTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       "201":
 *         description: Schedule created or updated
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
  .route('/')
  .post(auth('manageSchedules'), scheduleController.createOrUpdateSchedule);

/**
 * @swagger
 * /schedules/{scheduleId}:
 *   get:
 *     summary: Get a schedule by ID
 *     description: Only authorized users can get a schedule.
 *     tags: [Schedules]
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Schedule ID
 *     responses:
 *       "200":
 *         description: Schedule data retrieved
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/:scheduleId')
  .get(auth('getSchedules'), scheduleController.getSchedule);

module.exports = router;
