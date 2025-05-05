// routes/v1/health.route.js
const express = require('express');
const healthController = require('../../controllers/health.controller');

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Get application health status
 *     description: Get basic application health status
 *     tags: [Health]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 env:
 *                   type: string
 */
router.get('/', healthController.getHealth);

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Get detailed health status
 *     description: Get detailed health status with service checks (requires API key)
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: API key for health check access
 *     responses:
 *       "200":
 *         description: Detailed health information
 *       "401":
 *         description: Unauthorized - invalid or missing API key
 */
router.get('/detailed', healthController.getDetailedHealth);

/**
 * @swagger
 * /health/connections:
 *   get:
 *     summary: Log active connection state
 *     description: Log active connection state to the application logs (requires API key)
 *     tags: [Health]
 *     parameters:
 *       - in: query
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: API key for health check access
 *     responses:
 *       "200":
 *         description: Connection state logged successfully
 *       "401":
 *         description: Unauthorized - invalid or missing API key
 */
router.get('/connections', healthController.logConnections);

module.exports = router;