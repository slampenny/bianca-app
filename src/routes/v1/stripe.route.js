const express = require('express');
const stripeController = require('../../controllers/stripe.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Stripe
 *   description: Stripe configuration and utilities
 */

/**
 * @swagger
 * /stripe/publishable-key:
 *   get:
 *     summary: Get Stripe publishable key
 *     description: Retrieve the Stripe publishable key for client-side integration
 *     tags: [Stripe]
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 publishableKey:
 *                   type: string
 *                   description: Stripe publishable key
 *                 mode:
 *                   type: string
 *                   description: Stripe mode (test or live)
 *       "503":
 *         description: Service Unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 */
router.get('/publishable-key', stripeController.getPublishableKey);

module.exports = router;

