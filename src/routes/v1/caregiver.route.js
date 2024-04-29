const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const patientValidation = require('../../validations/patient.validation');
const patientController = require('../../controllers/patient.controller');

const router = express.Router();

router
  .route('/')
  .post(auth('managePatients'), validate(patientValidation.createPatient), patientController.createPatient)
  .get(auth('getPatients'), validate(patientValidation.getPatients), patientController.getPatients);

router
  .route('/:patientId')
  .get(auth('getPatients'), validate(patientValidation.getPatient), patientController.getPatient)
  .patch(auth('managePatients'), validate(patientValidation.updatePatient), patientController.updatePatient)
  .delete(auth('managePatients'), validate(patientValidation.deletePatient), patientController.deletePatient);

// New route for assigning caregiver to a patient
/**
 * @swagger
 * /patients/{patientId}/caregiver/{caregiverId}:
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
 */
router
  .route('/:patientId/caregiver/:caregiverId')
  .post(auth('managePatients'), patientController.assignCaregiver);

// New route for removing a patient from caregiver
/**
 * @swagger
 * /patients/{patientId}/caregiver/{caregiverId}:
 *   delete:
 *     summary: Remove a patient from a caregiver
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
 *         description: Patient removed
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/:patientId/caregiver/:caregiverId')
  .delete(auth('managePatients'), patientController.removeCaregiver);

// New route for getting patients of a caregiver
/**
 * @swagger
 * /patients/caregiver/{caregiverId}/patients:
 *   get:
 *     summary: Get patients for a caregiver
 *     description: Only admins can retrieve patients for a caregiver.
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver ID
 *     responses:
 *       "200":
 *         description: List of patients retrieved
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/caregiver/:caregiverId/patients')
  .get(auth('managePatients'), patientController.getPatientsByCaregiver);


module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Patients
 *   description: Patient management and retrieval
 */

/**
 * @swagger
 * tags:
 *   name: Conversations
 *   description: Conversation management and retrieval
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
 *               role:
 *                  type: string
 *                  enum: [staff, orgAdmin]
 *             example:
 *               name: fake name
 *               email: fake@example.com
 *               password: password1
 *               role: patient
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
 *         description: Caregiver name
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Caregiver role
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
 * /patients/{id}:
 *   get:
 *     summary: Get a patient
 *     description: Logged in Patients can fetch only their own patient information. Only admins can fetch other Patients.
 *     tags: [Patients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *         name: id
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
 *             example:
 *               name: fake name
 *               email: fake@example.com
 *               password: password1
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
 *         name: id
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

// New route for assigning caregiver to a patient
/**
 * @swagger
 * /patients/{patientId}/caregiver/{caregiverId}:
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
 */
router
  .route('/:patientId/caregiver/:caregiverId')
  .post(auth('managePatients'), patientController.assignCaregiver);

// New route for getting patients of a caregiver
/**
 * @swagger
 * /patients/caregiver/{caregiverId}/patients:
 *   get:
 *     summary: Get patients for a caregiver
 *     description: Only admins can retrieve patients for a caregiver.
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver ID
 *     responses:
 *       "200":
 *         description: List of patients retrieved
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/caregiver/:caregiverId/patients')
  .get(auth('managePatients'), patientController.getPatientsByCaregiver);

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
router
.route('/:patientId/conversations')
.get(auth('getConversationsByPatient'), validate(patientValidation.getConversationsByPatient), patientController.getConversationsByPatient);