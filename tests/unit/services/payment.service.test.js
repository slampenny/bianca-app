const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const stripe = require('../../../src/config/stripe');
const { Org, Conversation, Invoice, LineItem } = require('../../../src/models');
const paymentService = require('../../../src/services/payment.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { conversationOne, conversationTwo, insertConversations } = require('../../fixtures/conversation.fixture');

let mongoServer;

jest.mock('stripe', () => {
  const attach = jest.fn().mockResolvedValue({ id: 'pm_test', customer: 'cus_test' });
  const retrieve = jest.fn().mockResolvedValue({ id: 'pm_test' });
  const update = jest.fn().mockResolvedValue({ id: 'pm_test', metadata: { updated: true } });
  const detach = jest.fn().mockResolvedValue({ id: 'pm_test' });
  return jest.fn(() => ({
    paymentMethods: { attach, retrieve, update, detach }
  }));
});

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('paymentService', () => {
  afterEach(async () => {
    jest.clearAllMocks();
    await Org.deleteMany();
    await Conversation.deleteMany();
    await Invoice.deleteMany();
    await LineItem.deleteMany();
  });

  describe('Payment Method functions', () => {
    it('should create a new payment method', async () => {
      const [org] = await insertOrgs([orgOne]);
      const paymentMethod = await paymentService.createPaymentMethod(org.id, 'pm_test');
      expect(paymentMethod).toHaveProperty('id', 'pm_test');
      const updatedOrg = await Org.findById(org.id);
      expect(updatedOrg.paymentMethods).toContain('pm_test');
    });

    it('should get a payment method', async () => {
      const paymentMethod = await paymentService.getPaymentMethod('pm_test');
      expect(paymentMethod).toHaveProperty('id', 'pm_test');
    });

    it('should update a payment method', async () => {
      const updatedPaymentMethod = await paymentService.updatePaymentMethod('pm_test', { metadata: { updated: true } });
      expect(updatedPaymentMethod).toHaveProperty('id', 'pm_test');
      expect(updatedPaymentMethod.metadata).toHaveProperty('updated', true);
    });

    it('should delete a payment method', async () => {
      const [org] = await insertOrgs([orgOne]);
      // First, create the payment method so it is attached to the org
      await paymentService.createPaymentMethod(org.id, 'pm_test');
      const deletedPaymentMethodId = await paymentService.deletePaymentMethod(org.id, 'pm_test');
      expect(deletedPaymentMethodId).toEqual('pm_test');
      const updatedOrg = await Org.findById(org.id);
      expect(updatedOrg.paymentMethods).not.toContain('pm_test');
    });
  });

  describe('Invoice and LineItem functions', () => {
    it('should create an invoice from conversations and link them', async () => {
      // Insert two conversations for the same patient with no invoice link.
      const patientId = new mongoose.Types.ObjectId();
      await insertConversations([
        { ...conversationOne, patientId, duration: 120, lineItemId: null },
        { ...conversationTwo, patientId, duration: 180, lineItemId: null }
      ]);
      
      // Stub the aggregate function on Conversation model
      const aggregatedResult = [{
        patientId: patientId,
        totalDuration: 300, // 120 + 180 seconds
        conversationIds: [] // will be filled after inserting conversations
      }];
      
      // Get all inserted conversation IDs for patient
      const conversations = await Conversation.find({ patientId });
      aggregatedResult[0].conversationIds = conversations.map(conv => conv._id);
      
      // Mock the aggregateUnchargedConversations to return our aggregatedResult
      Conversation.aggregateUnchargedConversations = jest.fn().mockResolvedValue(aggregatedResult);
      
      const invoice = await paymentService.createInvoiceFromConversations(patientId);
      expect(invoice).toHaveProperty('status', 'pending');
      expect(invoice.lineItems).toHaveLength(1);
      const lineItem = invoice.lineItems[0];
      // Calculate amount based on 300 seconds (5 minutes) and config.billing.ratePerMinute.
      // For testing, we'll assume the rate is set in config. If not, you may stub calculateAmount.
      expect(invoice.totalAmount).toEqual(lineItem.amount);
      
      // Verify conversations are updated with the invoice _id in their lineItemId field
      const updatedConversations = await Conversation.find({ patientId });
      updatedConversations.forEach(conv => {
        expect(conv.lineItemId.toString()).toEqual(invoice._id.toString());
      });
    });
  });
});
