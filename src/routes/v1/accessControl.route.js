const express = require('express');
const auth = require('../../middlewares/auth');
const accessControlController = require('../../controllers/accessControl.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: AccessControl
 *   description: Manage access control for reports
 */

/**
 * @swagger
 * /access-control:
 *   post:
 *     summary: Set permissions for a report
 *     description: Only authorized users can set permissions.
 *     tags: [AccessControl]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reportId
 *               - allowedUsers
 *             properties:
 *               reportId:
 *                 type: string
 *               allowedUsers:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       "201":
 *         description: Permissions set
 *       "400":
 *         $ref: '#/components/responses/DuplicateEmail'
 */
