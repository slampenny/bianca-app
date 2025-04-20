const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const paymentValidation = require('../../validations/payment.validation');
const paymentController = require('../../controllers/payment.controller'); // Changed to match your controller name

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment and invoice management
 */

/**
 * @swagger
 * /payments/patients/{patientId}/invoices:
 *   post:
 *     summary: Create invoice from conversations
 *     description: Create a new invoice for a patient based on their conversation history.
 *     tags: [Payments]
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
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Invoice'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   get:
 *     summary: Get all patient invoices
 *     description: Retrieve all invoices for a patient with optional filtering.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Patient id
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by invoice status
 *       - in: query
 *         name: dueDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by invoice due date
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invoice'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/patients/:patientId/invoices')
  .post(
    (req, res, next) => {
      console.log('Received POST to /patients/:patientId/invoices');
      next();
    },
    auth('createAny:invoice'),
    // validate(paymentValidation.createInvoiceFromConversations),
    paymentController.createInvoiceFromConversations
  )
  .get(
    auth('readAny:invoice'),
    // validate(paymentValidation.listInvoicesByPatient),
    paymentController.listInvoicesByPatient
  );

/**
 * @swagger
 * /payments/orgs/{orgId}/invoices:
 *   get:
 *     summary: Get all organization invoices
 *     description: Retrieve all invoices for an organization with optional filtering.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema:
 *           type: string
 *         description: Organization id
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by invoice status
 *       - in: query
 *         name: dueDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by invoice due date
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Invoice'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router
  .route('/orgs/:orgId/invoices')
  .get(auth('readAny:invoice'), validate(paymentValidation.listInvoicesByOrg), paymentController.listInvoicesByOrg);

module.exports = router;
