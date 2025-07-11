const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Invoice, LineItem, Org, Patient } = require('../../../src/models');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { patientOne, insertPatients } = require('../../fixtures/patient.fixture');

describe('Invoice and LineItem Models', () => {
  let mongoServer;
  let org;
  let patient;

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Create test data
    const [testOrg] = await insertOrgs([orgOne]);
    org = testOrg;
    
    const patientData = { ...patientOne, org: org._id };
    const [testPatient] = await insertPatients([patientData]);
    patient = testPatient;
  });

  afterEach(async () => {
    await Invoice.deleteMany();
    await LineItem.deleteMany();
    await Org.deleteMany();
    await Patient.deleteMany();
  });

  describe('Invoice Model', () => {
    let validInvoice;

    beforeEach(() => {
      validInvoice = {
        org: org._id,
        invoiceNumber: 'INV-000001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'pending',
        totalAmount: 100.50,
        notes: 'Test invoice',
      };
    });

    test('should validate a valid invoice', async () => {
      const invoice = new Invoice(validInvoice);
      await expect(invoice.validate()).resolves.toBeUndefined();
    });

    test('should save a valid invoice', async () => {
      const invoice = new Invoice(validInvoice);
      const savedInvoice = await invoice.save();
      
      expect(savedInvoice._id).toBeDefined();
      expect(savedInvoice.invoiceNumber).toBe(validInvoice.invoiceNumber);
      expect(savedInvoice.org.toString()).toBe(org._id.toString());
      expect(savedInvoice.status).toBe('pending');
      expect(savedInvoice.totalAmount).toBe(100.50);
    });

    test('should require org field', async () => {
      const invoiceWithoutOrg = { ...validInvoice };
      delete invoiceWithoutOrg.org;
      
      const invoice = new Invoice(invoiceWithoutOrg);
      await expect(invoice.validate()).rejects.toThrow();
    });

    test('should require invoiceNumber field', async () => {
      const invoiceWithoutNumber = { ...validInvoice };
      delete invoiceWithoutNumber.invoiceNumber;
      
      const invoice = new Invoice(invoiceWithoutNumber);
      await expect(invoice.validate()).rejects.toThrow();
    });

    test('should require unique invoiceNumber', async () => {
      const invoice1 = new Invoice(validInvoice);
      await invoice1.save();

      const invoice2 = new Invoice(validInvoice);
      await expect(invoice2.save()).rejects.toThrow();
    });

    test('should validate status enum values', async () => {
      const validStatuses = ['draft', 'pending', 'paid', 'void', 'overdue'];
      
      for (const status of validStatuses) {
        const invoice = new Invoice({ ...validInvoice, status });
        await expect(invoice.validate()).resolves.toBeUndefined();
      }

      const invalidInvoice = new Invoice({ ...validInvoice, status: 'invalid' });
      await expect(invalidInvoice.validate()).rejects.toThrow();
    });

    test('should require totalAmount field', async () => {
      const invoiceWithoutAmount = { ...validInvoice };
      delete invoiceWithoutAmount.totalAmount;
      
      const invoice = new Invoice(invoiceWithoutAmount);
      await expect(invoice.validate()).rejects.toThrow();
    });

    test('should set default values correctly', async () => {
      const invoice = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000002',
        dueDate: new Date(),
        totalAmount: 50,
      });
      
      const savedInvoice = await invoice.save();
      expect(savedInvoice.status).toBe('draft');
      expect(savedInvoice.issueDate).toBeDefined();
    });

    test('should calculate total from line items', async () => {
      const invoice = new Invoice(validInvoice);
      await invoice.save();

      // Create line items
      const lineItem1 = new LineItem({
        patientId: patient._id,
        invoiceId: invoice._id,
        amount: 50.25,
        description: 'Service 1',
        quantity: 1,
        unitPrice: 50.25,
      });

      const lineItem2 = new LineItem({
        patientId: patient._id,
        invoiceId: invoice._id,
        amount: 75.75,
        description: 'Service 2',
        quantity: 2,
        unitPrice: 37.875,
      });

      await lineItem1.save();
      await lineItem2.save();

      // Test calculateTotal method
      const calculatedTotal = await invoice.calculateTotal();
      expect(calculatedTotal).toBe(126); // 50.25 + 75.75

      // Verify the invoice total was updated
      await invoice.save();
      expect(invoice.totalAmount).toBe(126);
    });

    test('should populate line items virtual', async () => {
      const invoice = new Invoice(validInvoice);
      await invoice.save();

      const lineItem = new LineItem({
        patientId: patient._id,
        invoiceId: invoice._id,
        amount: 100,
        description: 'Test service',
        quantity: 1,
        unitPrice: 100,
      });
      await lineItem.save();

      const populatedInvoice = await Invoice.findById(invoice._id).populate('lineItems');
      expect(populatedInvoice.lineItems).toHaveLength(1);
      expect(populatedInvoice.lineItems[0].amount).toBe(100);
    });
  });

  describe('LineItem Model', () => {
    let validLineItem;
    let invoice;

    beforeEach(async () => {
      invoice = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000003',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 0,
      });
      await invoice.save();

      validLineItem = {
        patientId: patient._id,
        invoiceId: invoice._id,
        amount: 150.75,
        description: 'Wellness check consultation',
        periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        quantity: 2.5,
        unitPrice: 60.30,
      };
    });

    test('should validate a valid line item', async () => {
      const lineItem = new LineItem(validLineItem);
      await expect(lineItem.validate()).resolves.toBeUndefined();
    });

    test('should save a valid line item', async () => {
      const lineItem = new LineItem(validLineItem);
      const savedLineItem = await lineItem.save();
      
      expect(savedLineItem._id).toBeDefined();
      expect(savedLineItem.patientId.toString()).toBe(patient._id.toString());
      expect(savedLineItem.invoiceId.toString()).toBe(invoice._id.toString());
      expect(savedLineItem.amount).toBe(150.75);
      expect(savedLineItem.description).toBe('Wellness check consultation');
      expect(savedLineItem.quantity).toBe(2.5);
      expect(savedLineItem.unitPrice).toBe(60.30);
    });

    test('should require patientId field', async () => {
      const lineItemWithoutPatient = { ...validLineItem };
      delete lineItemWithoutPatient.patientId;
      
      const lineItem = new LineItem(lineItemWithoutPatient);
      await expect(lineItem.validate()).rejects.toThrow();
    });

    test('should require amount field', async () => {
      const lineItemWithoutAmount = { ...validLineItem };
      delete lineItemWithoutAmount.amount;
      
      const lineItem = new LineItem(lineItemWithoutAmount);
      await expect(lineItem.validate()).rejects.toThrow();
    });

    test('should require description field', async () => {
      const lineItemWithoutDescription = { ...validLineItem };
      delete lineItemWithoutDescription.description;
      
      const lineItem = new LineItem(lineItemWithoutDescription);
      await expect(lineItem.validate()).rejects.toThrow();
    });

    test('should set default quantity to 1', async () => {
      const lineItemWithoutQuantity = { ...validLineItem };
      delete lineItemWithoutQuantity.quantity;
      
      const lineItem = new LineItem(lineItemWithoutQuantity);
      const savedLineItem = await lineItem.save();
      
      expect(savedLineItem.quantity).toBe(1);
    });

    test('should handle decimal amounts correctly', async () => {
      const lineItem = new LineItem({
        ...validLineItem,
        amount: 99.99,
        quantity: 3.5,
        unitPrice: 28.57,
      });
      
      const savedLineItem = await lineItem.save();
      expect(savedLineItem.amount).toBe(99.99);
      expect(savedLineItem.quantity).toBe(3.5);
      expect(savedLineItem.unitPrice).toBe(28.57);
    });

    test('should handle zero amounts', async () => {
      const lineItem = new LineItem({
        ...validLineItem,
        amount: 0,
        quantity: 0,
        unitPrice: 0,
      });
      
      const savedLineItem = await lineItem.save();
      expect(savedLineItem.amount).toBe(0);
      expect(savedLineItem.quantity).toBe(0);
      expect(savedLineItem.unitPrice).toBe(0);
    });
  });

  describe('Invoice-LineItem Relationships', () => {
    let invoice;

    beforeEach(async () => {
      invoice = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000004',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 0,
      });
      await invoice.save();
    });

    test('should create multiple line items for an invoice', async () => {
      const lineItem1 = new LineItem({
        patientId: patient._id,
        invoiceId: invoice._id,
        amount: 50,
        description: 'Initial consultation',
        quantity: 1,
        unitPrice: 50,
      });

      const lineItem2 = new LineItem({
        patientId: patient._id,
        invoiceId: invoice._id,
        amount: 100,
        description: 'Follow-up session',
        quantity: 2,
        unitPrice: 50,
      });

      await lineItem1.save();
      await lineItem2.save();

      const lineItems = await LineItem.find({ invoiceId: invoice._id });
      expect(lineItems).toHaveLength(2);
      expect(lineItems[0].amount).toBe(50);
      expect(lineItems[1].amount).toBe(100);
    });

    test('should calculate total correctly with multiple line items', async () => {
      const lineItem1 = new LineItem({
        patientId: patient._id,
        invoiceId: invoice._id,
        amount: 75.50,
        description: 'Service A',
        quantity: 1,
        unitPrice: 75.50,
      });

      const lineItem2 = new LineItem({
        patientId: patient._id,
        invoiceId: invoice._id,
        amount: 125.25,
        description: 'Service B',
        quantity: 2.5,
        unitPrice: 50.10,
      });

      await lineItem1.save();
      await lineItem2.save();

      const calculatedTotal = await invoice.calculateTotal();
      expect(calculatedTotal).toBe(200.75); // 75.50 + 125.25

      await invoice.save();
      expect(invoice.totalAmount).toBe(200.75);
    });

    test('should handle line items with different patients', async () => {
      const patient2 = new Patient({
        ...patientOne,
        email: 'patient2@example.com',
        org: org._id,
      });
      await patient2.save();

      const lineItem1 = new LineItem({
        patientId: patient._id,
        invoiceId: invoice._id,
        amount: 50,
        description: 'Patient 1 service',
        quantity: 1,
        unitPrice: 50,
      });

      const lineItem2 = new LineItem({
        patientId: patient2._id,
        invoiceId: invoice._id,
        amount: 75,
        description: 'Patient 2 service',
        quantity: 1,
        unitPrice: 75,
      });

      await lineItem1.save();
      await lineItem2.save();

      const lineItems = await LineItem.find({ invoiceId: invoice._id });
      expect(lineItems).toHaveLength(2);
      expect(lineItems[0].patientId.toString()).toBe(patient._id.toString());
      expect(lineItems[1].patientId.toString()).toBe(patient2._id.toString());
    });

    test('should populate line items when querying invoice', async () => {
      const lineItem = new LineItem({
        patientId: patient._id,
        invoiceId: invoice._id,
        amount: 100,
        description: 'Test service',
        quantity: 1,
        unitPrice: 100,
      });
      await lineItem.save();

      const populatedInvoice = await Invoice.findById(invoice._id).populate('lineItems');
      expect(populatedInvoice.lineItems).toHaveLength(1);
      expect(populatedInvoice.lineItems[0].amount).toBe(100);
      expect(populatedInvoice.lineItems[0].description).toBe('Test service');
    });
  });

  describe('Invoice Status Transitions', () => {
    let invoice;

    beforeEach(async () => {
      invoice = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000005',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'draft',
        totalAmount: 100,
      });
      await invoice.save();
    });

    test('should transition from draft to pending', async () => {
      invoice.status = 'pending';
      await invoice.save();
      
      const updatedInvoice = await Invoice.findById(invoice._id);
      expect(updatedInvoice.status).toBe('pending');
    });

    test('should transition from pending to paid', async () => {
      invoice.status = 'paid';
      invoice.paidAt = new Date();
      await invoice.save();
      
      const updatedInvoice = await Invoice.findById(invoice._id);
      expect(updatedInvoice.status).toBe('paid');
      expect(updatedInvoice.paidAt).toBeDefined();
    });

    test('should transition to void', async () => {
      invoice.status = 'void';
      await invoice.save();
      
      const updatedInvoice = await Invoice.findById(invoice._id);
      expect(updatedInvoice.status).toBe('void');
    });

    test('should transition to overdue', async () => {
      invoice.status = 'overdue';
      await invoice.save();
      
      const updatedInvoice = await Invoice.findById(invoice._id);
      expect(updatedInvoice.status).toBe('overdue');
    });
  });

  describe('Invoice Number Generation', () => {
    test('should generate sequential invoice numbers', async () => {
      const invoice1 = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 100,
      });

      const invoice2 = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000002',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 200,
      });

      await invoice1.save();
      await invoice2.save();

      expect(invoice1.invoiceNumber).toBe('INV-000001');
      expect(invoice2.invoiceNumber).toBe('INV-000002');
    });

    test('should enforce unique invoice numbers', async () => {
      const invoice1 = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 100,
      });

      const invoice2 = new Invoice({
        org: org._id,
        invoiceNumber: 'INV-000001', // Same number
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 200,
      });

      await invoice1.save();
      await expect(invoice2.save()).rejects.toThrow();
    });
  });
}); 