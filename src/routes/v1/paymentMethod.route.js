const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const paymentMethodValidation = require('../../validations/paymentMethod.validation');
const paymentMethodController = require('../../controllers/paymentMethod.controller');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: PaymentMethods
 *   description: Payment method management
 */

/**
 * @swagger
 * /orgs/{orgId}/payment-methods:
 *   post:
 *     summary: Attach a payment method
 *     description: Attach a Stripe payment method to an organization. The payment method must be created client-side using Stripe.js.
 *     tags: [PaymentMethods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethodId
 *             properties:
 *               paymentMethodId:
 *                 type: string
 *                 description: Stripe payment method ID created client-side
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentMethod'
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   get:
 *     summary: Get all organization payment methods
 *     description: Retrieve all payment methods for an organization.
 *     tags: [PaymentMethods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization id
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PaymentMethod'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/orgs/:orgId/payment-methods')
  .post(
    auth('createAny:paymentMethod'),
    validate(paymentMethodValidation.attachPaymentMethod),
    paymentMethodController.attachPaymentMethod
  )
  .get(
    auth('readAny:paymentMethod'),
    validate(paymentMethodValidation.getOrgPaymentMethods),
    paymentMethodController.getOrgPaymentMethods
  );

/**
 * @swagger
 * /orgs/{orgId}/payment-methods/{paymentMethodId}:
 *   get:
 *     summary: Get a payment method
 *     description: Get detailed information about a specific payment method.
 *     tags: [PaymentMethods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization id
 *       - in: path
 *         name: paymentMethodId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method id
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentMethod'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   patch:
 *     summary: Set default payment method
 *     description: Set a payment method as the default payment method for an organization.
 *     tags: [PaymentMethods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization id
 *       - in: path
 *         name: paymentMethodId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method id
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentMethod'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Detach a payment method
 *     description: Detach a payment method from an organization and from Stripe.
 *     tags: [PaymentMethods]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization id
 *       - in: path
 *         name: paymentMethodId
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method id
 *     responses:
 *       "204":
 *         description: No content
 *       "400":
 *         $ref: '#/components/responses/BadRequest'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/orgs/:orgId/payment-methods/:paymentMethodId')
  .get(
    auth('readAny:paymentMethod'),
    validate(paymentMethodValidation.getPaymentMethod),
    paymentMethodController.getPaymentMethod
  )
  .patch(
    auth('updateAny:paymentMethod'),
    validate(paymentMethodValidation.setDefaultPaymentMethod),
    paymentMethodController.setDefaultPaymentMethod
  )
  .delete(
    auth('deleteAny:paymentMethod'),
    validate(paymentMethodValidation.detachPaymentMethod),
    paymentMethodController.detachPaymentMethod
  );

module.exports = router;