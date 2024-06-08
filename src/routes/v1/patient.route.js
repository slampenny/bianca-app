const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const config = require('../../config/config');
const multer = require('multer');
const upload = multer({ dest: config.multer.dest });
const patientValidation = require('../../validations/patient.validation');
const patientController = require('../../controllers/patient.controller');

const router = express.Router();

router
  .route('/')
  .post(auth('updateOwn:patient', 'updateAny:patient'), validate(patientValidation.createPatient), upload.single('avatar'), patientController.createPatient)
  .get(auth('readOwn:patient', 'readAny:patient'), validate(patientValidation.getPatients), patientController.getPatients);

router
  .route('/:patientId')
  .get(auth('readOwn:patient', 'readAny:patient'), validate(patientValidation.getPatient), patientController.getPatient)
  .patch(auth('updateOwn:patient', 'updateAny:patient'), validate(patientValidation.updatePatient), upload.single('avatar'), patientController.updatePatient)
  .delete(auth('deleteOwn:patient', 'deleteAny:patient'), validate(patientValidation.deletePatient), patientController.deletePatient);

router
  .route('/:patientId/caregivers/:caregiverId')
  .post(auth('updateOwn:patient', 'updateAny:patient'), patientController.assignCaregiver)
  .delete(auth('deleteOwn:patient', 'deleteAny:patient'), patientController.removeCaregiver);

router
  .route('/:patientId/conversations')
  .get(auth('readOwn:patient', 'readAny:patient'), validate(patientValidation.getConversationsByPatient), patientController.getConversationsByPatient);

router
  .route('/:patientId/caregivers')
  .get(auth('readAny:caregiver'), validate(patientValidation.getCaregivers), patientController.getCaregivers);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Patients
 *   description: Patient management and retrieval
 */

/**
 * @swagger
 * /patients:
 *   post:
 *     summary: Create a patient
 *     description: Only admins can create other Patients.
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *                 description: must be unique
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: At least one number and one letter
 *               schedules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     time:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     frequency:
 *                       type: string
 *                     intervals:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           day:
 *                             type: number
 *                           weeks:
 *                             type: number
 *             example:
 *               name: fake name
 *               email: fake@example.com
 *               password: password1
 *               role: patient
 *               schedules: [
 *                 {
 *                   time: "10:00",
 *                   isActive: true,
 *                   frequency: "weekly",
 *                   intervals: [{ day: 2, weeks: 1 }]
 *                 }
 *               ]
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Patient'
 *       "400":
 *         $ref: '#/components/responses/DuplicateEmail'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *
 *   get:
 *     summary: Get all Patients
 *     description: Only admins can retrieve all Patients.
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Patient name
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Patient role
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *         description: sort by query in the form of field:desc/asc (ex. name:asc)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *         default: 10
 *         description: Maximum number of Patients
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Patient'
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 totalPages:
 *                   type: integer
 *                   example: 1
 *                 totalResults:
 *                   type: integer
 *                   example: 1
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /patients/{patientId}:
 *   get:
 *     summary: Get a patient
 *     description: Logged in Patients can fetch only their own patient information. Only admins can fetch other Patients.
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient id
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Patient'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   patch:
 *     summary: Update a patient
 *     description: Logged in Patients can only update their own information. Only admins can update other Patients.
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *                 description: must be unique
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: At least one number and one letter
 *               schedules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     time:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     frequency:
 *                       type: string
 *                     intervals:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           day:
 *                             type: number
 *                           weeks:
 *                             type: number
 *             example:
 *               name: fake name
 *               email: fake@example.com
 *               password: password1
 *               schedules: [
 *                 {
 *                   id: "scheduleId",
 *                   time: "10:00",
 *                   isActive: true,
 *                   frequency: "weekly",
 *                   intervals: [{ day: 2, weeks: 1 }]
 *                 }
 *               ]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Patient'
 *       "400":
 *         $ref: '#/components/responses/DuplicateEmail'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Delete a patient
 *     description: Logged in Patients can delete only themselves. Only admins can delete other Patients.
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient id
 *     responses:
 *       "200":
 *         description: No content
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /patients/{patientId}/caregivers/{caregiverId}:
 *   post:
 *     summary: Assign a caregiver to a patient
 *     description: Only admins can assign caregivers.
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver ID
 *     responses:
 *       "200":
 *         description: Caregiver assigned
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Remove a patient from a caregiver
 *     description: Only admins can remove caregivers.
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver ID
 *     responses:
 *       "200":
 *         description: Caregiver removed
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /patients/{patientId}/conversations:
 *   get:
 *     summary: Get conversations by patient
 *     description: Logged in Patients can fetch only their own conversation information. Only admins can fetch other Patients' conversations.
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient id
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Conversation'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /patients/{patientId}/caregivers:
 *   get:
 *     summary: Retrieve caregivers of a patient
 *     description: Retrieve caregivers of a patient by the patient's ID
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         description: Patient ID
 *         schema:
 *           type: string
 *     responses:
 *       "200":
 *         description: An array of caregiver objects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Caregiver'
 *       "404":
 *         description: Caregivers not found
 */
