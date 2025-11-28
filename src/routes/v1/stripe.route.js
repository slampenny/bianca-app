const express = require('express');
const stripeController = require('../../controllers/stripe.controller');

const router = express.Router();

// Middleware to handle raw body for webhook signature verification
const rawBodyMiddleware = express.raw({ type: 'application/json' });

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

/**
 * @swagger
 * /stripe/webhook:
 *   post:
 *     summary: Stripe webhook endpoint
 *     description: Handles Stripe webhook events for billing and subscriptions
 *     tags: [Stripe]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       "200":
 *         description: Webhook processed successfully
 *       "400":
 *         description: Invalid webhook signature
 *       "500":
 *         description: Webhook processing failed
 */
router.post('/webhook', rawBodyMiddleware, stripeController.handleWebhook);

module.exports = router;








