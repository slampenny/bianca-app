const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const caregiverValidation = require('../../validations/caregiver.validation');
const caregiverController = require('../../controllers/caregiver.controller');

const router = express.Router();
/**
 * @swagger
 * tags:
 *   name: Caregivers
 *   description: Caregiver management and retrieval
 */

/**
 * @swagger
 * tags:
 *   name: Conversations
 *   description: Conversation management and retrieval
 */

/**
 * @swagger
 * /caregivers:
 *   post:
 *     summary: Create a caregiver
 *     description: Only admins can create other caregivers.
 *     tags: [Caregivers]
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
 *               role: caregiver
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Caregiver'
 *       "400":
 *         $ref: '#/components/responses/DuplicateEmail'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *
 *   get:
 *     summary: Get all caregivers
 *     description: Only admins can retrieve all caregivers.
 *     tags: [Caregivers]
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
 *         description: Maximum number of caregivers
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
 *                     $ref: '#/components/schemas/Caregiver'
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
 * /caregivers/{id}:
 *   get:
 *     summary: Get a caregiver
 *     description: Logged in caregivers can fetch only their own caregiver information. Only admins can fetch other caregivers.
 *     tags: [Caregivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver id
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Caregiver'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   patch:
 *     summary: Update a caregiver
 *     description: Logged in caregivers can only update their own information. Only admins can update other caregivers.
 *     tags: [Caregivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver id
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
 *                $ref: '#/components/schemas/Caregiver'
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
 *     summary: Delete a caregiver
 *     description: Logged in caregivers can delete only themselves. Only admins can delete other caregivers.
 *     tags: [Caregivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver id
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
router
  .route('/')
  .get(auth('readAny:caregiver'), validate(caregiverValidation.getCaregivers), caregiverController.getCaregivers);

router
  .route('/:caregiverId')
  .get(auth('readOwn:caregiver', 'readAny:caregiver'), validate(caregiverValidation.getCaregiver), caregiverController.getCaregiver)
  .patch(auth('updateOwn:caregiver', 'updateAny:caregiver'), validate(caregiverValidation.updateCaregiver), caregiverController.updateCaregiver)
  .delete(auth('deleteOwn:caregiver', 'deleteAny:caregiver'), validate(caregiverValidation.deleteCaregiver), caregiverController.deleteCaregiver);

/**
 * @swagger
 * /caregivers/:caregiverId/patients/patientId:
 *   post:
 *     summary: Assign a caregiver to a patient
 *     description: Only admins can assign caregivers.
 *     tags: [Patients]
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver ID
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
 *     responses:
 *       "200":
 *         description: Patient added
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route(':caregiverId/patients/patientId')
  .post(auth('createAny:patients'), caregiverController.addPatient);

/**
 * @swagger
 * /caregivers/{caregiverId}/patients/{patientId}:
 *   delete:
 *     summary: Remove a patient from a caregiver
 *     description: Only admins can assign caregivers.
 *     tags: [Caregivers]
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver ID       
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient ID
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
  .route(':caregiverId/patients/:patientId')
  .delete(auth('deleteAny:patients'), caregiverController.removePatient);

/**
 * @swagger
 * /caregivers/{caregiverId}/patients:
 *   get:
 *     summary: Get patients for a caregiver
 *     description: Only admins can retrieve patients for a caregiver.
 *     tags: [Caregivers]
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
  .route(':caregiverId/patients/:patientId')
  .get(auth('readOwn:patients', 'readAny:patients'), caregiverController.getPatient);

/**
 * @swagger
 * /caregivers/{caregiverId}/patients:
 *   get:
 *     summary: Get patients for a caregiver
 *     description: Only admins can retrieve patients for a caregiver.
 *     tags: [Caregivers]
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
  .route(':caregiverId/patients')
  .get(auth('readOwn:patients', 'readAny:patients'), caregiverController.getPatients);

module.exports = router;

