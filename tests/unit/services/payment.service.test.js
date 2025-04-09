const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Conversation, Invoice, LineItem, Patient } = require('../../../src/models');
const paymentService = require('../../../src/services/payment.service');
const config = require('../../../src/config/config');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { patientOne, insertPatients } = require('../../fixtures/patient.fixture');
const { conversationOne, conversationTwo, insertConversations } = require('../../fixtures/conversation.fixture');

// Mock the Stripe module
jest.mock('../../../src/config/stripe', () => ({
  paymentMethods: {
    attach: jest.fn().mockResolvedValue({ id: 'pm_test', customer: 'cus_test' }),
    retrieve: jest.fn().mockResolvedValue({ id: 'pm_test' }),
    update: jest.fn().mockResolvedValue({ id: 'pm_test', metadata: { updated: true } }),
    detach: jest.fn().mockResolvedValue({ id: 'pm_test' })
  },
  customers: {
    create: jest.fn().mockResolvedValue({ id: 'cus_test' }),
    update: jest.fn().mockResolvedValue({ id: 'cus_test' })
  }
}));

let mongoServer;

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
    await Patient.deleteMany();
    await Conversation.deleteMany();
    await Invoice.deleteMany();
    await LineItem.deleteMany();
  });

  describe('Invoice and LineItem functions', () => {
    it('should create an invoice using the real aggregation pipeline and compute the math correctly', async () => {
      // Insert an organization.
      const [org] = await insertOrgs([orgOne]);
      
      // Create a patient associated with the org.
      const patientData = { ...patientOne, org: org._id };
      const [patient] = await insertPatients([patientData]);
      
      // Insert two conversations for the patient with no invoice link.
      // First conversation: 120 seconds (2 minutes).
      // Second conversation: 180 seconds (3 minutes).
      await insertConversations([
        { 
          ...conversationOne, 
          patientId: patient._id, 
          duration: 120,
          lineItemId: null,
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T10:02:00Z')
        },
        { 
          ...conversationTwo, 
          patientId: patient._id, 
          duration: 180,
          lineItemId: null,
          startTime: new Date('2023-01-02T14:00:00Z'),
          endTime: new Date('2023-01-02T14:03:00Z')
        }
      ]);
      
      // IMPORTANT: Do NOT stub Conversation.aggregateUnchargedConversations.
      // Let the real aggregation pipeline run against the inserted conversations.
      
      // Execute the service method to create an invoice.
      const invoice = await paymentService.createInvoiceFromConversations(patient._id);
      
      // The total duration should be 120 + 180 = 300 seconds (5 minutes).
      const expectedAmount = (300 / 60) * config.billing.ratePerMinute;
      
      // Verify invoice properties.
      expect(invoice).toBeDefined();
      expect(invoice.org.toString()).toBe(org._id.toString());
      expect(invoice.status).toBe('pending');
      expect(invoice.totalAmount).toBe(expectedAmount);
      expect(invoice.issueDate).toBeDefined();
      expect(invoice.dueDate).toBeDefined();
      expect(invoice.invoiceNumber).toMatch(/^INV-\d{6}$/);
      
      // Verify that a line item was created with the expected values.
      const lineItems = await LineItem.find({ invoiceId: invoice._id });
      expect(lineItems).toHaveLength(1);
      
      const lineItem = lineItems[0];
      expect(lineItem.patientId.toString()).toBe(patient._id.toString());
      expect(lineItem.amount).toBe(expectedAmount);
      // The line item quantity should be the total duration in minutes (5 minutes).
      expect(lineItem.quantity).toBe(5);
      expect(lineItem.unitPrice).toBe(config.billing.ratePerMinute);
      expect(lineItem.description).toContain('300 seconds');
      
      // Verify that all conversations for the patient have been updated with the created line item ID.
      const updatedConversations = await Conversation.find({ patientId: patient._id });
      updatedConversations.forEach(conv => {
        expect(conv.lineItemId?.toString()).toBe(lineItem._id.toString());
      });
    });
    
    it('should throw an error if no uncharged conversations are found', async () => {
      // Create organization and patient
      const [org] = await insertOrgs([orgOne]);
      const patientData = { ...patientOne, org: org._id };
      const [patient] = await insertPatients([patientData]);
      
      // Mock empty result from aggregation
      Conversation.aggregateUnchargedConversations = jest.fn().mockResolvedValue([]);
      
      // Expect an error when trying to create an invoice
      await expect(paymentService.createInvoiceFromConversations(patient._id))
        .rejects.toThrow('No uncharged conversations found');
    });
  });
});