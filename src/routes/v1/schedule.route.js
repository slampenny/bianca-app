const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const scheduleController = require('../../controllers/schedule.controller');
const { scheduleValidation } = require('../../validations');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Schedules
 *   description: Schedule management
 */

/**
 * @swagger
 * /patients/{patientId}/schedules:
 *   post:
 *     summary: Create a schedule for a patient
 *     description: Only authorized patients can create schedules.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - frequency
 *               - intervals
 *             properties:
 *               frequency:
 *                 type: string
 *                 description: Frequency of the schedule, can be 'daily', 'weekly', or 'monthly'
 *                 enum: ['daily', 'weekly', 'monthly']
 *               intervals:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: If frequency is 'weekly', values are 0-6 for days of the week. If 'monthly', values are 1-12 for months.
 *     responses:
 *       "201":
 *         description: Schedule created
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 */
router
  .route('/:patientId')
  .post(auth('manageSchedules'), validate(scheduleValidation.createSchedule), scheduleController.createSchedule);

/**
 * @swagger
 * /patients/{patientId}/schedules/{scheduleId}:
 *   get:
 *     summary: Get a schedule by ID for a patient
 *     description: Only authorized patients can get a schedule.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
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
 *   put:
 *     summary: Update a schedule for a patient
 *     description: Only authorized patients can update schedules.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - frequency
 *               - intervals
 *             properties:
 *               frequency:
 *                 type: string
 *                 description: Frequency of the schedule, can be 'daily', 'weekly', or 'monthly'
 *                 enum: ['daily', 'weekly', 'monthly']
 *               intervals:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: If frequency is 'weekly', values are 0-6 for days of the week. If 'monthly', values are 1-12 for months.
 *     responses:
 *       "200":
 *         description: Schedule updated
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     summary: Patch a schedule for a patient
 *     description: Only authorized patients can patch schedules.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frequency:
 *                 type: string
 *                 description: Frequency of the schedule, can be 'daily', 'weekly', or 'monthly'
 *                 enum: ['daily', 'weekly', 'monthly']
 *               intervals:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: If frequency is 'weekly', values are 0-6 for days of the week. If 'monthly', values are 1-12 for months.
 *     responses:
 *       "200":
 *         description: Schedule patched
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete a schedule for a patient
 *     description: Only authorized patients can delete schedules.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     responses:
 *       "204":
 *         description: Schedule deleted
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/:patientId/:scheduleId')
  .get(auth('getSchedules'), validate(scheduleValidation.getSchedule), scheduleController.getSchedule)
  .put(auth('manageSchedules'), validate(scheduleValidation.updateSchedule), scheduleController.updateSchedule)
  .patch(auth('manageSchedules'), validate(scheduleValidation.patchSchedule), scheduleController.patchSchedule)
  .delete(auth('manageSchedules'), validate(scheduleValidation.deleteSchedule), scheduleController.deleteSchedule);

module.exports = router;