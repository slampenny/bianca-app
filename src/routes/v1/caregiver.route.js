const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const config = require('../../config/config');
const multer = require('multer');
const upload = multer({ dest: config.multer.dest });
const caregiverValidation = require('../../validations/caregiver.validation');
const caregiverController = require('../../controllers/caregiver.controller');

const router = express.Router();

router
  .route('/')
  .get(auth(), validate(caregiverValidation.getCaregivers), caregiverController.getCaregivers);

router
  .route('/:caregiverId')
  .get(auth('readOwn:caregiver', 'readAny:caregiver'), validate(caregiverValidation.getCaregiver), caregiverController.getCaregiver)
  .patch(auth('updateOwn:caregiver', 'updateAny:caregiver'), validate(caregiverValidation.updateCaregiver), caregiverController.updateCaregiver)
  .delete(auth('deleteOwn:caregiver', 'deleteAny:caregiver'), validate(caregiverValidation.deleteCaregiver), caregiverController.deleteCaregiver);

router
  .route('/:caregiverId/avatar')
  .post(auth('updateOwn:caregiver', 'updateAny:caregiver'), validate(caregiverValidation.uploadCaregiverAvatar), upload.single('avatar'), caregiverController.uploadCaregiverAvatar)
  .patch(auth('updateOwn:caregiver', 'updateAny:caregiver'), validate(caregiverValidation.uploadCaregiverAvatar), upload.single('avatar'), caregiverController.uploadCaregiverAvatar);

router
  .route('/:caregiverId/patients/:patientId')
  .post(auth('createAny:patient'), caregiverController.addPatient)
  .delete(auth('deleteAny:patient'), caregiverController.removePatient);

router
  .route('/:caregiverId/patients')
  .get(auth('readOwn:patient', 'readAny:patient'), caregiverController.getPatients);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Caregivers
 *   description: Caregiver management and retrieval
 */

/**
 * @swagger
 * /caregivers:
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
 * /caregivers/{caregiverId}:
 *   get:
 *     summary: Get a caregiver
 *     description: Logged in caregivers can fetch only their own caregiver information. Only admins can fetch other caregivers.
 *     tags: [Caregivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caregiverId
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
 *   patch:
 *     summary: Update a caregiver
 *     description: Logged in caregivers can only update their own information. Only admins can update other caregivers.
 *     tags: [Caregivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caregiverId
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
 *   delete:
 *     summary: Delete a caregiver
 *     description: Logged in caregivers can delete only themselves. Only admins can delete other caregivers.
 *     tags: [Caregivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver id
 *     responses:
 *       "204":
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
 * /caregivers/{caregiverId}/patients/{patientId}:
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
 *   delete:
 *     summary: Remove a patient from a caregiver
 *     description: Only admins can remove caregivers.
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

