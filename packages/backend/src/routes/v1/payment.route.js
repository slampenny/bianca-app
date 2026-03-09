const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const paymentValidation = require('../../validations/payment.validation');
const paymentController = require('../../controllers/payment.controller'); // Changed to match your controller name
const logger = require('../../config/logger');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment and invoice management
 */

/**
 * @swagger
 * /payments/clients/{clientId}/invoices:
 *   post:
 *     summary: Create invoice from conversations
 *     description: Create a new invoice for a client based on their conversation history.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client id
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
 *     summary: Get all client invoices
 *     description: Retrieve all invoices for a client with optional filtering.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *         description: Client id
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
  .route('/clients/:clientId/invoices')
  .post(
    (req, res, next) => {
      logger.debug('Received POST to /payments/clients/:clientId/invoices', {
        clientId: req.params.clientId
      });
      next();
    },
    auth('createAny:invoice'),
    paymentController.createInvoiceFromConversations
  )
  .get(
    auth('readAny:invoice'),
    paymentController.listInvoicesByClient
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

/**
 * @swagger
 * /payments/orgs/{orgId}/unbilled-costs:
 *   get:
 *     summary: Get current unbilled costs by client for an organization
 *     description: Retrieve current unbilled conversation costs grouped by client, showing what will be charged in the next billing cycle.
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
 *         name: days
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of days to look back for unbilled conversations
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 orgId:
 *                   type: string
 *                 orgName:
 *                   type: string
 *                 totalUnbilledCost:
 *                   type: number
 *                 clientCosts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       clientId:
 *                         type: string
 *                       clientName:
 *                         type: string
 *                       conversationCount:
 *                         type: integer
 *                       totalCost:
 *                         type: number
 *                       conversations:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             conversationId:
 *                               type: string
 *                             startTime:
 *                               type: string
 *                               format: date-time
 *                             duration:
 *                               type: integer
 *                             cost:
 *                               type: number
 *                             status:
 *                               type: string
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/orgs/:orgId/unbilled-costs', auth('readAny:invoice'), paymentController.getUnbilledCostsByOrg);

module.exports = router;
