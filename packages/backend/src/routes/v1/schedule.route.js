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
 * /schedules/patients/{patientId}:
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
  .route('/patients/:patientId')
  .post(
    auth('updateOwn:patient', 'updateAny:patient'),
    validate(scheduleValidation.createSchedule),
    scheduleController.createSchedule
  );

/**
 * @swagger
 * /schedules/{scheduleId}:
 *   get:
 *     summary: Get a schedule by ID
 *     description: Get a specific schedule by ID. Only authorized users can access schedules.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Schedule'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     summary: Update a schedule
 *     description: Update an existing schedule. Only authorized users can update schedules.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Schedule ID
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
 *                 description: Frequency of the schedule
 *                 enum: [daily, weekly, monthly]
 *               intervals:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: If frequency is 'weekly', values are 0-6 for days of the week. If 'monthly', values are 1-12 for months.
 *     responses:
 *       "200":
 *         description: Schedule updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Schedule'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     summary: Patch a schedule
 *     description: Partially update a schedule. Only authorized users can patch schedules.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Schedule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               frequency:
 *                 type: string
 *                 enum: [daily, weekly, monthly]
 *               intervals:
 *                 type: array
 *                 items:
 *                   type: number
 *     responses:
 *       "200":
 *         description: Schedule patched
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Schedule'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete a schedule
 *     description: Delete a schedule. Only authorized users can delete schedules.
 *     tags: [Schedules]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Schedule ID
 *     responses:
 *       "204":
 *         description: Schedule deleted
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/:scheduleId')
  .get(auth('readOwn:patient', 'readAny:patient'), validate(scheduleValidation.getSchedule), scheduleController.getSchedule)
  .put(
    auth('updateOwn:patient', 'updateAny:patient'),
    validate(scheduleValidation.updateSchedule),
    scheduleController.updateSchedule
  )
  .patch(
    auth('updateOwn:patient', 'updateAny:patient'),
    validate(scheduleValidation.patchSchedule),
    scheduleController.patchSchedule
  )
  .delete(
    auth('deleteOwn:patient', 'deleteAny:patient'),
    validate(scheduleValidation.deleteSchedule),
    scheduleController.deleteSchedule
  );

module.exports = router;
