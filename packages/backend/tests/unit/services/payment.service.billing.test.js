const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const ApiError = require('../../../src/utils/ApiError');

// Mock agenda before importing anything that uses it
jest.mock('../../../src/config/agenda', () => ({
  agenda: {
    on: jest.fn(),
    every: jest.fn(),
    schedule: jest.fn(),
    jobs: jest.fn(),
    define: jest.fn(),
  },
}));

// Mock Stripe usage service
jest.mock('../../../src/services/stripeUsage.service', () => ({
  getUsageSummary: jest.fn().mockResolvedValue({
    subscriptionId: 'sub_test123',
    subscriptionItemId: 'si_test123',
    currentPeriodStart: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
    currentPeriodEnd: Math.floor(Date.now() / 1000) + 86400 * 23, // 23 days from now
    usageRecords: [],
    totalUsage: 0,
  }),
  reportUsage: jest.fn().mockResolvedValue({}),
  reportConversationUsage: jest.fn().mockResolvedValue({}),
}));

// Now import services and models
const { paymentService } = require('../../../src/services');
const { Org, Patient, Call, Conversation, Invoice, LineItem } = require('../../../src/models');

describe('Payment Service - Billing', () => {
  let mongoServer;
  let org;
  let patient1;
  let patient2;
  let call1;
  let call2;
  let call3;

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri, {});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear the database before each test
    await Call.deleteMany({});
    await Conversation.deleteMany({});
    await Patient.deleteMany({});
    await Org.deleteMany({});
    await Invoice.deleteMany({});
    await LineItem.deleteMany({});
    
    // Create test organization with Stripe subscription ID for billing tests
    org = await Org.create({
      name: 'Test Healthcare Org',
      email: 'test@healthcare.com',
      phone: '+12345678901',
      stripeSubscriptionId: 'sub_test123', // Required for getUnbilledCostsByOrg
    });

    // Create test patients
    patient1 = await Patient.create({
      name: 'John Doe',
      email: 'john@test.com',
      phone: '+12345678901',
      org: org._id
    });

    patient2 = await Patient.create({
      name: 'Jane Smith',
      email: 'jane@test.com',
      phone: '+12345678902',
      org: org._id
    });

    // Create test Call records (Call tracks billing, not Conversation)
    const baseTime = new Date();
    call1 = await Call.create({
      callSid: 'CA11111111111111111111111111111111',
      patientId: patient1._id,
      cost: 0.20,
      duration: 120,
      status: 'completed',
      startTime: baseTime,
      endTime: new Date(baseTime.getTime() + 120000), // 2 minutes later
      lineItemId: null // Unbilled
    });

    call2 = await Call.create({
      callSid: 'CA22222222222222222222222222222222',
      patientId: patient1._id,
      cost: 0.30,
      duration: 180,
      status: 'completed',
      startTime: baseTime,
      endTime: new Date(baseTime.getTime() + 180000), // 3 minutes later
      lineItemId: null // Unbilled
    });

    call3 = await Call.create({
      callSid: 'CA33333333333333333333333333333333',
      patientId: patient2._id,
      cost: 0.15,
      duration: 90,
      status: 'completed',
      startTime: baseTime,
      endTime: new Date(baseTime.getTime() + 90000), // 1.5 minutes later
      lineItemId: null // Unbilled
    });
  });

  afterEach(async () => {
    await Call.deleteMany({});
    await Conversation.deleteMany({});
    await Patient.deleteMany({});
    await Org.deleteMany({});
    await Invoice.deleteMany({});
    await LineItem.deleteMany({});
  });

  describe('getUnbilledCostsByOrg', () => {
    it('should return unbilled costs grouped by patient', async () => {
      const result = await paymentService.getUnbilledCostsByOrg(org._id, 7);

      expect(result.orgName).toBe('Test Healthcare Org');
      expect(result.totalUnbilledCost).toBe(0.65); // 0.20 + 0.30 + 0.15
      expect(result.orgId.toString()).toBe(org._id.toString());
      expect(result.patientCosts).toHaveLength(2);
      
      // Check John Doe's data
      const johnDoe = result.patientCosts.find(p => p.patientName === 'John Doe');
      expect(johnDoe).toBeDefined();
      expect(johnDoe.patientId.toString()).toBe(patient1._id.toString());
      expect(johnDoe.callCount).toBe(2);
      expect(johnDoe.totalCost).toBe(0.50); // 0.20 + 0.30
      expect(johnDoe.calls).toHaveLength(2);
      
      // Check Jane Smith's data
      const janeSmith = result.patientCosts.find(p => p.patientName === 'Jane Smith');
      expect(janeSmith).toBeDefined();
      expect(janeSmith.patientId.toString()).toBe(patient2._id.toString());
      expect(janeSmith.callCount).toBe(1);
      expect(janeSmith.totalCost).toBe(0.15);
      expect(janeSmith.calls).toHaveLength(1);
    });

    it('should return empty result when no unbilled calls exist', async () => {
      // Mark all calls as billed
      await Call.updateMany({}, { lineItemId: new mongoose.Types.ObjectId() });

      const result = await paymentService.getUnbilledCostsByOrg(org._id, 7);

      expect(result).toMatchObject({
        orgName: 'Test Healthcare Org',
        totalUnbilledCost: 0,
        patientCosts: []
      });
      expect(result.orgId.toString()).toBe(org._id.toString());
    });

    it('should filter by date range', async () => {
      // Create an old call
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago
      
      await Call.create({
        callSid: 'CA44444444444444444444444444444444',
        patientId: patient1._id,
        duration: 60,
        cost: 0.10,
        status: 'completed',
        startTime: oldDate,
        endTime: oldDate,
        lineItemId: null
      });

      // Query for last 7 days only
      const result = await paymentService.getUnbilledCostsByOrg(org._id, 7);

      expect(result.totalUnbilledCost).toBe(0.65); // Should not include the old call
      expect(result.patientCosts[0].callCount).toBe(2); // Only recent calls
    });

    it('should exclude calls with zero cost', async () => {
      // Create a call with zero cost
      await Call.create({
        callSid: 'CA55555555555555555555555555555555',
        patientId: patient1._id,
        duration: 0,
        cost: 0,
        status: 'failed',
        startTime: new Date(),
        endTime: new Date(),
        lineItemId: null
      });

      const result = await paymentService.getUnbilledCostsByOrg(org._id, 7);

      expect(result.totalUnbilledCost).toBe(0.65); // Should not include zero-cost call
    });

    it('should throw error for non-existent organization', async () => {
      const nonExistentOrgId = new mongoose.Types.ObjectId();
      
      await expect(paymentService.getUnbilledCostsByOrg(nonExistentOrgId, 7))
        .rejects.toThrow(ApiError);
    });

    it('should sort patients by total cost (highest first)', async () => {
      const result = await paymentService.getUnbilledCostsByOrg(org._id, 7);

      expect(result.patientCosts[0].totalCost).toBeGreaterThanOrEqual(result.patientCosts[1].totalCost);
    });

    it('should handle custom days parameter', async () => {
      const result = await paymentService.getUnbilledCostsByOrg(org._id, 30);

      expect(result.period.days).toBe(30);
      expect(result.period.startDate).toBeInstanceOf(Date);
      expect(result.period.endDate).toBeInstanceOf(Date);
    });
  });

  describe('createInvoiceFromConversations', () => {
    it('should create invoice with line items for unbilled calls', async () => {
      const invoice = await paymentService.createInvoiceFromConversations(patient1._id);

      expect(invoice.org.toString()).toBe(org._id.toString());
      expect(invoice.status).toBe('pending');
      expect(invoice.totalAmount).toBe(0.50); // 0.20 + 0.30
      if (invoice.notes) {
        expect(invoice.notes).toContain('Billing for');
      }

      expect(invoice.invoiceNumber).toMatch(/^INV-\d{6}$/);
      expect(invoice.lineItems).toHaveLength(1);
      expect(invoice.lineItems[0].patientId.toString()).toBe(patient1._id.toString());
      expect(invoice.lineItems[0].amount).toBe(0.50);
      expect(invoice.lineItems[0].description).toContain('Billing for 300 seconds');
      expect(invoice.lineItems[0].quantity).toBe(5); // 5 minutes total (120 + 180 seconds = 300 seconds = 5 minutes)
    });

    it('should mark calls as billed after creating invoice', async () => {
      await paymentService.createInvoiceFromConversations(patient1._id);

      const updatedCalls = await Call.find({ patientId: patient1._id });
      expect(updatedCalls.every(call => call.lineItemId !== null)).toBe(true);
    });

    it('should throw error when no unbilled calls exist', async () => {
      // Mark all calls as billed
      await Call.updateMany({ patientId: patient1._id }, { 
        lineItemId: new mongoose.Types.ObjectId() 
      });

      await expect(paymentService.createInvoiceFromConversations(patient1._id))
        .rejects.toThrow(ApiError);
    });

    it('should throw error for non-existent patient', async () => {
      const nonExistentPatientId = new mongoose.Types.ObjectId();
      
      await expect(paymentService.createInvoiceFromConversations(nonExistentPatientId))
        .rejects.toThrow(ApiError);
    });
  });

  describe('listInvoicesByOrg', () => {
    let invoice;

    beforeEach(async () => {
      // Create a test invoice
      invoice = await Invoice.create({
        org: org._id,
        invoiceNumber: 'INV-000001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 0.65
      });

      // Create line items
      await LineItem.create([
        {
          patientId: patient1._id,
          invoiceId: invoice._id,
          amount: 0.50,
          description: 'Billing for patient 1',
          quantity: 2
        },
        {
          patientId: patient2._id,
          invoiceId: invoice._id,
          amount: 0.15,
          description: 'Billing for patient 2',
          quantity: 1
        }
      ]);
    });

    it('should return invoices for organization', async () => {
      const invoices = await paymentService.listInvoicesByOrg(org._id);

      expect(invoices).toHaveLength(1);
      expect(invoices[0]).toMatchObject({
        _id: invoice._id,
        org: org._id,
        invoiceNumber: 'INV-000001',
        status: 'pending',
        totalAmount: 0.65
      });
      expect(invoices[0].lineItems).toHaveLength(2);
    });

    it('should filter invoices by status', async () => {
      const invoices = await paymentService.listInvoicesByOrg(org._id, { status: 'pending' });
      expect(invoices).toHaveLength(1);

      const paidInvoices = await paymentService.listInvoicesByOrg(org._id, { status: 'paid' });
      expect(paidInvoices).toHaveLength(0);
    });

    it('should filter invoices by due date', async () => {
      const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days from now
      const invoices = await paymentService.listInvoicesByOrg(org._id, { dueDate: futureDate });
      expect(invoices).toHaveLength(1);

      const pastDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      const pastInvoices = await paymentService.listInvoicesByOrg(org._id, { dueDate: pastDate });
      expect(pastInvoices).toHaveLength(0);
    });

    it('should return empty array for non-existent organization', async () => {
      const nonExistentOrgId = new mongoose.Types.ObjectId();
      const invoices = await paymentService.listInvoicesByOrg(nonExistentOrgId);
      expect(invoices).toHaveLength(0);
    });
  });

  describe('calculateAmount', () => {
    it('should calculate amount correctly for given duration', () => {
      const duration = 300; // 5 minutes
      const amount = paymentService.calculateAmount(duration);
      expect(amount).toBe(0.50); // 5 * 0.10
    });

    it('should handle zero duration', () => {
      const amount = paymentService.calculateAmount(0);
      expect(amount).toBe(0);
    });

    it('should handle fractional minutes', () => {
      const duration = 90; // 1.5 minutes
      const amount = paymentService.calculateAmount(duration);
      expect(amount).toBeCloseTo(0.15, 2); // 1.5 * 0.10
    });
  });
});
