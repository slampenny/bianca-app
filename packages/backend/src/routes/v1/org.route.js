const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const orgValidation = require('../../validations/org.validation');
const orgController = require('../../controllers/org.controller');

const router = express.Router();

router
  .route('/')
  .post(validate(orgValidation.createOrg), orgController.createOrg)
  .get(auth('readAny:org'), validate(orgValidation.getOrgs), orgController.getOrgs);

router
  .route('/:orgId')
  .get(auth('readOwn:org'), validate(orgValidation.getOrg), orgController.getOrg)
  .patch(auth('updateOwn:org'), validate(orgValidation.updateOrg), orgController.updateOrg)
  .delete(auth('deleteOwn:org'), validate(orgValidation.deleteOrg), orgController.deleteOrg);

/**
 * @swagger
 * /orgs/{orgId}/caregiver/{caregiverId}:
 *   post:
 *     summary: Assign a caregiver to a org
 *     description: Only admins can assign caregivers.
 *     tags: [Orgs]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Org ID
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
router.route('/:orgId/caregiver/:caregiverId').post(auth('updateAny:caregiver'), orgController.addCaregiver);

// New route for removing a org from caregiver
/**
 * @swagger
 * /orgs/{orgId}/caregiver/{caregiverId}:
 *   delete:
 *     summary: Remove a org from a caregiver
 *     description: Only admins can assign caregivers.
 *     tags: [Orgs]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Org ID
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
router.route('/:orgId/caregiver/:caregiverId').delete(auth('updateAny:caregiver'), orgController.removeCaregiver);

/**
 * @swagger
 * /orgs/{orgId}/caregiver/{caregiverId}/role:
 *   patch:
 *     summary: Change a caregiver's role
 *     description: Only admins with the 'changeRole' permission can change a caregiver's role.
 *     tags: [Orgs]
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Org ID
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
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *             example:
 *               role: newRole
 *     responses:
 *       "200":
 *         description: Role changed
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.route('/:orgId/caregiver/:caregiverId/role').patch(auth('updateAny:caregiver'), orgController.setRole);

/**
 * @swagger
 * /orgs/{orgId}/invite:
 *   patch:
 *     summary: Send organization invite
 *     description: Send an invitation to join an organization
 *     tags: [Orgs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address to invite
 *               role:
 *                 type: string
 *                 description: "Role to assign (default: staff)"
 *     responses:
 *       "200":
 *         description: Invite sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.route('/:orgId/invite').patch(/* auth('updateOwn:org'), */ orgController.sendInvite);

/**
 * @swagger
 * /orgs/{orgId}/verify-invite/{token}:
 *   patch:
 *     summary: Verify organization invite
 *     description: Verify and accept an organization invitation using the invite token
 *     tags: [Orgs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization ID
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invite verification token
 *     responses:
 *       "200":
 *         description: Invite verified and accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 org:
 *                   $ref: '#/components/schemas/Org'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.route('/:orgId/verify-invite/:token').patch(auth('updateOwn:caregiver'), orgController.verifyInvite);

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: Orgs
 *   description: Org management and retrieval
 */

/**
 * @swagger
 * /orgs:
 *   post:
 *     summary: Create an org
 *     description: Only admins can create other orgs.
 *     tags: [Orgs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Org'
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Org'
 *       "400":
 *         $ref: '#/components/responses/DuplicateEmail'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *
 *   get:
 *     summary: Get all orgs
 *     description: Only admins can retrieve all orgs.
 *     tags: [Orgs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Org name
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Org role
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
 *         description: Maximum number of orgs
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
 *                     $ref: '#/components/schemas/Org'
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
 * /orgs/{id}:
 *   get:
 *     summary: Get an org
 *     description: Logged in orgs can fetch only their own org information. Only admins can fetch other orgs.
 *     tags: [Orgs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Org id
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Org'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   patch:
 *     summary: Update an org
 *     description: Logged in orgs can only update their own information. Only admins can update other orgs.
 *     tags: [Orgs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Org id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Org'
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/Org'
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
 *     summary: Delete an org
 *     description: Logged in orgs can delete only themselves. Only admins can delete other orgs.
 *     tags: [Orgs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Org id
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
