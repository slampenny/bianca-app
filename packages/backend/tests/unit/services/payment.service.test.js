const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Conversation, Call, Invoice, LineItem, Client } = require('../../../src/models');
const paymentService = require('../../../src/services/payment.service');
const config = require('../../../src/config/config');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { clientOne, insertClients } = require('../../fixtures/client.fixture');
const { conversationOne, conversationTwo, insertConversations } = require('../../fixtures/conversation.fixture');

// Mock Stripe SDK (external dependency)
jest.mock('stripe');

let mongoServer;

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
  await Promise.all([
    Conversation.deleteMany({}),
    Call.deleteMany({}),
    Invoice.deleteMany({}),
    LineItem.deleteMany({}),
    Client.deleteMany({}),
    Org.deleteMany({}),
  ]);
  // Small delay to ensure MongoDB has finished processing
  await new Promise(resolve => setTimeout(resolve, 50));
});

afterEach(async () => {
  await Promise.all([
    Conversation.deleteMany({}),
    Invoice.deleteMany({}),
    LineItem.deleteMany({}),
    Client.deleteMany({}),
    Org.deleteMany({}),
  ]);
});

describe('paymentService', () => {
  afterEach(async () => {
    jest.clearAllMocks();
    await Org.deleteMany();
    await Client.deleteMany();
    await Conversation.deleteMany();
    await Invoice.deleteMany();
    await LineItem.deleteMany();
  });

  describe('createInvoiceFromConversations', () => {
    it('should create an invoice using the real aggregation pipeline and compute the math correctly', async () => {
      // Insert an organization.
      const [org] = await insertOrgs([orgOne]);
      
      // Create a client associated with the org.
      const clientData = { ...clientOne, org: org._id };
      const [client] = await insertClients([clientData]);

      // Insert two calls for the client with no invoice link.
      // First call: 120 seconds (2 minutes).
      // Second call: 180 seconds (3 minutes).
      await Call.insertMany([
        { 
          clientId: client._id, 
          org: org._id,
          callSid: 'CA1234567890abcdef',
          duration: 120,
          lineItemId: null,
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T10:02:00Z'),
          status: 'completed'
        },
        { 
          clientId: client._id, 
          org: org._id,
          callSid: 'CA0987654321fedcba',
          duration: 180,
          lineItemId: null,
          startTime: new Date('2023-01-02T14:00:00Z'),
          endTime: new Date('2023-01-02T14:03:00Z'),
          status: 'completed'
        }
      ]);
      
      // Execute the service method to create an invoice.
      const invoice = await paymentService.createInvoiceFromConversations(client._id);
      
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
      expect(lineItem.clientId.toString()).toBe(client._id.toString());
      expect(lineItem.amount).toBe(expectedAmount);
      // The line item quantity should be the total duration in minutes (5 minutes).
      expect(lineItem.quantity).toBe(5);
      expect(lineItem.unitPrice).toBe(config.billing.ratePerMinute);
      expect(lineItem.description).toContain('300 seconds');
      
      // Verify that all calls for the client have been updated with the created line item ID.
      const updatedCalls = await Call.find({ clientId: client._id });
      updatedCalls.forEach(call => {
        expect(call.lineItemId?.toString()).toBe(lineItem._id.toString());
      });
    });
    
    it('should throw an error if no uncharged conversations are found', async () => {
      // Create organization and client
      const [org] = await insertOrgs([orgOne]);
      const clientData = { ...clientOne, org: org._id };
      const [client] = await insertClients([clientData]);
      
      // No calls exist, so the service will find no uncharged calls
      
      // Expect an error when trying to create an invoice
      await expect(paymentService.createInvoiceFromConversations(client._id))
        .rejects.toThrow('No uncharged calls found');
    });

    it('should throw an error if client is not found', async () => {
      const nonExistentClientId = new mongoose.Types.ObjectId();
      
      await expect(paymentService.createInvoiceFromConversations(nonExistentClientId))
        .rejects.toThrow('Client not found');
    });

    it('should handle conversations with zero duration by setting minimum duration', async () => {
      const [org] = await insertOrgs([orgOne]);
      const clientData = { ...clientOne, org: org._id };
      const [client] = await insertClients([clientData]);
      
      // Insert conversation with zero duration (will be adjusted by validation)
      await insertConversations([
        { 
          ...conversationOne, 
          clientId: client._id, 
          duration: 0, // This will be overridden by the pre-save hook
          lineItemId: null,
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T10:00:00Z'), // Same as start time - will be adjusted
          status: 'failed' // Mark as failed call to trigger minimum billing
        }
      ]);
      
      const invoice = await paymentService.createInvoiceFromConversations(client._id);
      
      // The conversation should now have a minimum 30-second duration for failed calls
      expect(invoice.totalAmount).toBeGreaterThan(0);
      
      // Calculate expected amount for 30 seconds
      const expectedAmount = (30 / 60) * config.billing.ratePerMinute;
      expect(invoice.totalAmount).toBe(expectedAmount);
      
      const lineItems = await LineItem.find({ invoiceId: invoice._id });
      expect(lineItems).toHaveLength(1);
      expect(lineItems[0].amount).toBe(expectedAmount);
      expect(lineItems[0].quantity).toBe(30 / 60); // 0.5 minutes
    });

    it('should generate sequential invoice numbers', async () => {
      const [org] = await insertOrgs([orgOne]);
      const clientData = { ...clientOne, org: org._id };
      const [client] = await insertClients([clientData]);
      
      // Create first conversation
      await insertConversations([
        { 
          ...conversationOne, 
          clientId: client._id, 
          duration: 60,
          lineItemId: null,
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T10:01:00Z')
        }
      ]);
      
      const invoice1 = await paymentService.createInvoiceFromConversations(client._id);
      
      // Create second conversation
      await insertConversations([
        { 
          ...conversationTwo, 
          clientId: client._id, 
          duration: 120,
          lineItemId: null,
          startTime: new Date('2023-01-02T10:00:00Z'),
          endTime: new Date('2023-01-02T10:02:00Z')
        }
      ]);
      
      const invoice2 = await paymentService.createInvoiceFromConversations(client._id);
      
      // Extract numbers from invoice numbers
      const num1 = parseInt(invoice1.invoiceNumber.split('-')[1]);
      const num2 = parseInt(invoice2.invoiceNumber.split('-')[1]);
      
      expect(num2).toBe(num1 + 1);
    });

    it('should handle conversations with decimal durations', async () => {
      const [org] = await insertOrgs([orgOne]);
      const clientData = { ...clientOne, org: org._id };
      const [client] = await insertClients([clientData]);
      
      // Insert conversation with decimal duration (90.5 seconds = 1.508 minutes)
      await insertConversations([
        { 
          ...conversationOne, 
          clientId: client._id, 
          duration: 90.5,
          lineItemId: null,
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T10:01:30.5Z')
        }
      ]);
      
      const invoice = await paymentService.createInvoiceFromConversations(client._id);
      
      const expectedAmount = (90.5 / 60) * config.billing.ratePerMinute;
      expect(invoice.totalAmount).toBe(expectedAmount);
      
      const lineItems = await LineItem.find({ invoiceId: invoice._id });
      expect(lineItems[0].quantity).toBe(90.5 / 60);
    });

    it('should bill minimum duration for failed calls and actual duration for successful calls', async () => {
      const [org] = await insertOrgs([orgOne]);
      const clientData = { ...clientOne, org: org._id };
      const [client] = await insertClients([clientData]);
      
      // Insert a failed call (should be billed minimum 30 seconds)
      await insertConversations([
        { 
          ...conversationOne, 
          clientId: client._id, 
          duration: 0,
          lineItemId: null,
          startTime: new Date('2023-01-01T10:00:00Z'),
          endTime: new Date('2023-01-01T10:00:00Z'),
          status: 'failed'
        }
      ]);
      
      // Insert a successful call with 2 minutes duration
      await insertConversations([
        { 
          ...conversationTwo, 
          clientId: client._id, 
          duration: 120, // 2 minutes
          lineItemId: null,
          startTime: new Date('2023-01-01T11:00:00Z'),
          endTime: new Date('2023-01-01T11:02:00Z'),
          status: 'completed'
        }
      ]);
      
      const invoice = await paymentService.createInvoiceFromConversations(client._id);
      
      // Expected: 30 seconds (0.5 min) + 2 minutes = 2.5 minutes
      const expectedAmount = (2.5) * config.billing.ratePerMinute;
      expect(invoice.totalAmount).toBe(expectedAmount);
      
      const lineItems = await LineItem.find({ invoiceId: invoice._id });
      expect(lineItems).toHaveLength(1);
      expect(lineItems[0].quantity).toBe(2.5); // 2.5 minutes total
    });
  });

  describe('listInvoicesByOrg', () => {
    let org, client1, client2;

    beforeEach(async () => {
      const [testOrg] = await insertOrgs([orgOne]);
      org = testOrg;
      
      const clientData1 = { ...clientOne, org: org._id };
      const clientData2 = { ...clientOne, email: 'client2@example.com', org: org._id };
      const [testClient1, testClient2] = await insertClients([clientData1, clientData2]);
      client1 = testClient1;
      client2 = testClient2;
    });

    it('should return all invoices for an organization', async () => {
      // Create invoices for both clients
      const invoice1 = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 100,
      });
      await invoice1.save();

      const invoice2 = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000002',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'paid',
        totalAmount: 200,
      });
      await invoice2.save();

      const invoices = await paymentService.listInvoicesByOrg(org._id);
      
      expect(invoices).toHaveLength(2);
      expect(invoices[0].org.toString()).toBe(org._id.toString());
      expect(invoices[1].org.toString()).toBe(org._id.toString());
    });

    it('should filter invoices by status', async () => {
      // Create invoices with different statuses
      const pendingInvoice = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 100,
      });
      await pendingInvoice.save();

      const paidInvoice = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000002',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'paid',
        totalAmount: 200,
      });
      await paidInvoice.save();

      const pendingInvoices = await paymentService.listInvoicesByOrg(org._id, { status: 'pending' });
      expect(pendingInvoices).toHaveLength(1);
      expect(pendingInvoices[0].status).toBe('pending');

      const paidInvoices = await paymentService.listInvoicesByOrg(org._id, { status: 'paid' });
      expect(paidInvoices).toHaveLength(1);
      expect(paidInvoices[0].status).toBe('paid');
    });

    it('should filter invoices by due date', async () => {
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Create invoices with different due dates
      const overdueInvoice = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000001',
        issueDate: new Date(),
        dueDate: new Date(today.getTime() - 24 * 60 * 60 * 1000), // Yesterday
        status: 'pending',
        totalAmount: 100,
      });
      await overdueInvoice.save();

      const dueTodayInvoice = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000002',
        issueDate: new Date(),
        dueDate: today,
        status: 'pending',
        totalAmount: 200,
      });
      await dueTodayInvoice.save();

      const futureInvoice = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000003',
        issueDate: new Date(),
        dueDate: nextWeek,
        status: 'pending',
        totalAmount: 300,
      });
      await futureInvoice.save();

      // Filter for invoices due today or before
      const overdueInvoices = await paymentService.listInvoicesByOrg(org._id, { dueDate: today });
      expect(overdueInvoices).toHaveLength(2); // overdue and due today
    });

    it('should return empty array for non-existent organization', async () => {
      const nonExistentOrgId = new mongoose.Types.ObjectId();
      const invoices = await paymentService.listInvoicesByOrg(nonExistentOrgId);
      expect(invoices).toHaveLength(0);
    });

    it('should populate line items when returning invoices', async () => {
      const invoice = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 100,
      });
      await invoice.save();

      const lineItem = new LineItem({
        clientId: client1._id,
        invoiceId: invoice._id,
        amount: 100,
        description: 'Test service',
        quantity: 1,
        unitPrice: 100,
      });
      await lineItem.save();

      const invoices = await paymentService.listInvoicesByOrg(org._id);
      expect(invoices[0].lineItems).toHaveLength(1);
      expect(invoices[0].lineItems[0].amount).toBe(100);
    });
  });

  describe('listInvoicesByClient', () => {
    let org, client1, client2;

    beforeEach(async () => {
      const [testOrg] = await insertOrgs([orgOne]);
      org = testOrg;
      
      const clientData1 = { ...clientOne, org: org._id };
      const clientData2 = { ...clientOne, email: 'client2@example.com', org: org._id };
      const [testClient1, testClient2] = await insertClients([clientData1, clientData2]);
      client1 = testClient1;
      client2 = testClient2;
    });

    it('should return invoices for a specific client', async () => {
      // Create invoices for both clients
      const invoice1 = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 100,
      });
      await invoice1.save();

      const invoice2 = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000002',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'paid',
        totalAmount: 200,
      });
      await invoice2.save();

      // Create line items linking invoices to clients
      const lineItem1 = new LineItem({
        clientId: client1._id,
        invoiceId: invoice1._id,
        amount: 100,
        description: 'Client 1 service',
        quantity: 1,
        unitPrice: 100,
      });
      await lineItem1.save();

      const lineItem2 = new LineItem({
        clientId: client2._id,
        invoiceId: invoice2._id,
        amount: 200,
        description: 'Client 2 service',
        quantity: 1,
        unitPrice: 200,
      });
      await lineItem2.save();

      const client1Invoices = await paymentService.listInvoicesByClient(client1._id);
      expect(client1Invoices).toHaveLength(1);
      expect(client1Invoices[0].lineItems[0].clientId.toString()).toBe(client1._id.toString());

      const client2Invoices = await paymentService.listInvoicesByClient(client2._id);
      expect(client2Invoices).toHaveLength(1);
      expect(client2Invoices[0].lineItems[0].clientId.toString()).toBe(client2._id.toString());
    });

    it('should filter client invoices by status', async () => {
      const invoice1 = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 100,
      });
      await invoice1.save();

      const invoice2 = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000002',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'paid',
        totalAmount: 200,
      });
      await invoice2.save();

      // Create line items for both invoices for the same client
      const lineItem1 = new LineItem({
        clientId: client1._id,
        invoiceId: invoice1._id,
        amount: 100,
        description: 'Service 1',
        quantity: 1,
        unitPrice: 100,
      });
      await lineItem1.save();

      const lineItem2 = new LineItem({
        clientId: client1._id,
        invoiceId: invoice2._id,
        amount: 200,
        description: 'Service 2',
        quantity: 1,
        unitPrice: 200,
      });
      await lineItem2.save();

      const pendingInvoices = await paymentService.listInvoicesByClient(client1._id, { status: 'pending' });
      expect(pendingInvoices).toHaveLength(1);
      expect(pendingInvoices[0].status).toBe('pending');

      const paidInvoices = await paymentService.listInvoicesByClient(client1._id, { status: 'paid' });
      expect(paidInvoices).toHaveLength(1);
      expect(paidInvoices[0].status).toBe('paid');
    });

    it('should filter client invoices by due date', async () => {
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      const invoice1 = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000001',
        issueDate: new Date(),
        dueDate: today,
        status: 'pending',
        totalAmount: 100,
      });
      await invoice1.save();

      const invoice2 = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000002',
        issueDate: new Date(),
        dueDate: nextWeek,
        status: 'pending',
        totalAmount: 200,
      });
      await invoice2.save();

      // Create line items for both invoices
      const lineItem1 = new LineItem({
        clientId: client1._id,
        invoiceId: invoice1._id,
        amount: 100,
        description: 'Service 1',
        quantity: 1,
        unitPrice: 100,
      });
      await lineItem1.save();

      const lineItem2 = new LineItem({
        clientId: client1._id,
        invoiceId: invoice2._id,
        amount: 200,
        description: 'Service 2',
        quantity: 1,
        unitPrice: 200,
      });
      await lineItem2.save();

      const dueTodayInvoices = await paymentService.listInvoicesByClient(client1._id, { dueDate: today });
      expect(dueTodayInvoices).toHaveLength(1);
      expect(dueTodayInvoices[0].dueDate.toDateString()).toBe(today.toDateString());
    });

    it('should return empty array for client with no invoices', async () => {
      const invoices = await paymentService.listInvoicesByClient(client1._id);
      expect(invoices).toHaveLength(0);
    });

    it('should return empty array for non-existent client', async () => {
      const nonExistentClientId = new mongoose.Types.ObjectId();
      const invoices = await paymentService.listInvoicesByClient(nonExistentClientId);
      expect(invoices).toHaveLength(0);
    });
  });

  describe('calculateAmount', () => {
    it('should calculate amount correctly for whole minutes', () => {
      const duration = 120; // 2 minutes
      const expectedAmount = (duration / 60) * config.billing.ratePerMinute;
      
      // Access the calculateAmount function through the service
      const result = paymentService.calculateAmount(duration);
      expect(result).toBe(expectedAmount);
    });

    it('should calculate amount correctly for decimal minutes', () => {
      const duration = 90; // 1.5 minutes
      const expectedAmount = (duration / 60) * config.billing.ratePerMinute;
      
      const result = paymentService.calculateAmount(duration);
      expect(result).toBe(expectedAmount);
    });

    it('should handle zero duration', () => {
      const duration = 0;
      const expectedAmount = 0;
      
      const result = paymentService.calculateAmount(duration);
      expect(result).toBe(expectedAmount);
    });

    it('should handle very small durations', () => {
      const duration = 1; // 1 second
      const expectedAmount = (duration / 60) * config.billing.ratePerMinute;
      
      const result = paymentService.calculateAmount(duration);
      expect(result).toBe(expectedAmount);
    });

    it('should handle large durations', () => {
      const duration = 3600; // 1 hour
      const expectedAmount = (duration / 60) * config.billing.ratePerMinute;
      
      const result = paymentService.calculateAmount(duration);
      expect(result).toBe(expectedAmount);
    });
  });
});