const express = require('express');
const multer = require('multer');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const config = require('../../config/config');

const upload = multer({ dest: config.multer.dest });
const caregiverValidation = require('../../validations/caregiver.validation');
const caregiverController = require('../../controllers/caregiver.controller');

const router = express.Router();

router
  .route('/')
  .get(auth('readAny:caregiver'), validate(caregiverValidation.getCaregivers), caregiverController.getCaregivers);

router
  .route('/:caregiverId')
  .get(
    auth('readOwn:caregiver', 'readAny:caregiver'),
    validate(caregiverValidation.getCaregiver),
    caregiverController.getCaregiver
  )
  .patch(
    auth('updateOwn:caregiver', 'updateAny:caregiver'),
    validate(caregiverValidation.updateCaregiver),
    caregiverController.updateCaregiver
  )
  .delete(
    auth('deleteOwn:caregiver', 'deleteAny:caregiver'),
    validate(caregiverValidation.deleteCaregiver),
    caregiverController.deleteCaregiver
  );

router
  .route('/:caregiverId/avatar')
  .post(
    auth('updateOwn:caregiver', 'updateAny:caregiver'),
    validate(caregiverValidation.uploadCaregiverAvatar),
    upload.single('avatar'),
    caregiverController.uploadCaregiverAvatar
  )
  .patch(
    auth('updateOwn:caregiver', 'updateAny:caregiver'),
    validate(caregiverValidation.uploadCaregiverAvatar),
    upload.single('avatar'),
    caregiverController.uploadCaregiverAvatar
  );

router
  .route('/:caregiverId/theme')
  .patch(
    auth('updateOwn:caregiver', 'updateAny:caregiver'),
    validate(caregiverValidation.updateThemePreference),
    caregiverController.updateThemePreference
  );

router
  .route('/:caregiverId/clients/:clientId')
  .post(
    auth('createAny:client'),
    validate(caregiverValidation.addClient),
    caregiverController.addClient
  )
  .delete(
    auth('deleteAny:client'),
    validate(caregiverValidation.removeClient),
    caregiverController.removeClient
  );

router
  .route('/:caregiverId/clients')
  .get(
    auth('readOwn:client', 'readAny:client'),
    validate(caregiverValidation.getClients),
    caregiverController.getClients
  );

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
 * /caregivers/{caregiverId}/clients/{clientId}:
 *   post:
 *     summary: Assign a caregiver to a client
 *     description: Only admins can assign caregivers.
 *     tags: [Clients]
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver ID
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ID
 *     responses:
 *       "200":
 *         description: Client added
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Remove a client from a caregiver
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
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ID
 *     responses:
 *       "200":
 *         description: Client removed
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /caregivers/{caregiverId}/avatar:
 *   post:
 *     summary: Upload caregiver avatar
 *     description: Upload or update a caregiver's avatar image
 *     tags: [Caregivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image file
 *     responses:
 *       "200":
 *         description: Avatar uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Caregiver'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     summary: Update caregiver avatar
 *     description: Update a caregiver's avatar image
 *     tags: [Caregivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *                 description: Avatar image file
 *     responses:
 *       "200":
 *         description: Avatar updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Caregiver'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /caregivers/{caregiverId}/theme:
 *   patch:
 *     summary: Update caregiver theme preference
 *     description: Update the theme preference for a caregiver (healthcare or colorblind)
 *     tags: [Caregivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - themePreference
 *             properties:
 *               themePreference:
 *                 type: string
 *                 enum: [healthcare, colorblind]
 *                 description: Theme preference for accessibility
 *     responses:
 *       "200":
 *         description: Theme preference updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Caregiver'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */

/**
 * @swagger
 * /caregivers/{caregiverId}/clients:
 *   get:
 *     summary: Get clients for a caregiver
 *     description: Retrieve all clients assigned to a caregiver
 *     tags: [Caregivers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caregiverId
 *         required: true
 *         schema:
 *           type: string
 *         description: Caregiver ID
 *     responses:
 *       "200":
 *         description: List of clients retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Client'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
