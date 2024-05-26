const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const alertValidation = require('../../validations/alert.validation');
const alertController = require('../../controllers/alert.controller');

const router = express.Router();

router
  .route('/')
  .post(auth('updateOwn:alert, updateAny:alert'), validate(alertValidation.createAlert), alertController.createAlert)
  .get(auth('readOwn:alert, readAny:alert'), validate(alertValidation.getAlerts), alertController.getAlerts);

router
  .route('/:alertId')
  .get(auth('readOwn:alert, readAny:alert'), validate(alertValidation.getAlertById), alertController.getAlert)
  .patch(auth('updateOwn:alert, updateAny:alert'), validate(alertValidation.updateAlert), alertController.updateAlert)
  .delete(auth('deleteOwn:alert, deleteAny:alert'), validate(alertValidation.deleteAlert), alertController.deleteAlert);

router
  .route('/:alertId/markAsRead')
  .post(auth('readOwn:alert, readAny:alert'), validate(alertValidation.markAlertAsRead), alertController.markAlertAsRead);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Alerts
 *   description: Alert management and retrieval
 */

/**
 * @swagger
 * /alerts:
 *   post:
 *     summary: Create an alert
 *     description: Only authorized users can create alerts.
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Alert'
 *     responses:
 *       "201":
 *         description: Alert created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alert'
 *   get:
 *     summary: Get all alerts
 *     description: Only authorized users can retrieve all alerts.
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: showRead
 *         schema:
 *           type: boolean
 *         description: Whether to show read alerts or not
 *     responses:
 *       "200":
 *         description: A list of alerts
 *         content:
 *           application/json:
 *             schema:
jSON:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Alert'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /alerts/{alertId}:
 *   get:
 *     summary: Get a single alert
 *     description: Only authorized users can retrieve a specific alert.
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       "200":
 *         description: Alert data retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alert'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     summary: Update an alert
 *     description: Only authorized users can update an alert.
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Alert'
 *     responses:
 *       "200":
 *         description: Alert updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alert'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete an alert
 *     description: Only authorized users can delete an alert.
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       "204":
 *         description: Alert deleted successfully
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /alerts/{alertId}/markAsRead:
 *   post:
 *     summary: Mark an alert as read
 *     description: Only authorized users can mark an alert as read.
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID
 *     responses:
 *       "200":
 *         description: Alert marked as read
 *         content:
 *           application/json:
 *             schema:
 *               $refs: '#/components/schemas/Alert'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
