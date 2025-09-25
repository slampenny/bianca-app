// Import integration setup first to ensure proper mocking
require('../../utils/integration-setup');

const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../utils/integration-app');
const { Org, Patient, Conversation, Invoice, LineItem, Caregiver } = require('../../../src/models');
const { tokenService } = require('../../../src/services');

describe('Payment Controller - Billing', () => {
  let mongoServer;
  let org;
  let patient1;
  let patient2;
  let conversation1;
  let conversation2;
  let conversation3;
  let accessToken;

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
    // Clear the database before each test
    await Conversation.deleteMany({});
    await Patient.deleteMany({});
    await Org.deleteMany({});
    await Invoice.deleteMany({});
    await LineItem.deleteMany({});
    await Caregiver.deleteMany({});
    
    // Create test data
    org = await Org.create({
      name: 'Test Healthcare Org',
      email: 'test@healthcare.com',
      phone: '+12345678901'
    });

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

    // Create test conversations
    const startTime1 = new Date();
    const endTime1 = new Date(startTime1.getTime() + 120000); // 2 minutes later
    
    const startTime2 = new Date();
    const endTime2 = new Date(startTime2.getTime() + 180000); // 3 minutes later
    
    const startTime3 = new Date();
    const endTime3 = new Date(startTime3.getTime() + 90000); // 1.5 minutes later

    conversation1 = await Conversation.create({
      callSid: 'CA11111111111111111111111111111111',
      patientId: patient1._id,
      duration: 120, // 2 minutes
      cost: 0.20,
      status: 'completed',
      startTime: startTime1,
      endTime: endTime1,
      lineItemId: null // Unbilled
    });

    conversation2 = await Conversation.create({
      callSid: 'CA22222222222222222222222222222222',
      patientId: patient1._id,
      duration: 180, // 3 minutes
      cost: 0.30,
      status: 'completed',
      startTime: startTime2,
      endTime: endTime2,
      lineItemId: null // Unbilled
    });

    conversation3 = await Conversation.create({
      callSid: 'CA33333333333333333333333333333333',
      patientId: patient2._id,
      duration: 90, // 1.5 minutes
      cost: 0.15,
      status: 'completed',
      startTime: startTime3,
      endTime: endTime3,
      lineItemId: null // Unbilled
    });

    // Create test caregiver in database
    const caregiver = await Caregiver.create({
      email: 'test@healthcare.com',
      name: 'Test User',
      role: 'orgAdmin',
      org: org._id,
      isEmailVerified: true,
      password: 'testpassword123',
      phone: '+12345678901'
    });

    const tokens = await tokenService.generateAuthTokens(caregiver);
    accessToken = tokens.access.token;
  });

  describe('GET /payments/orgs/:orgId/unbilled-costs', () => {
    it('should return unbilled costs for organization', async () => {
      const res = await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.orgId).toBe(org._id.toString());
      expect(res.body.orgName).toBe('Test Healthcare Org');
      expect(res.body.totalUnbilledCost).toBe(0.65); // 0.20 + 0.30 + 0.15
      expect(res.body.patientCosts).toHaveLength(2);
      
      // Check patient 1 (John Doe)
      const patient1Cost = res.body.patientCosts.find(p => p.patientId === patient1._id.toString());
      expect(patient1Cost).toBeDefined();
      expect(patient1Cost.patientName).toBe('John Doe');
      expect(patient1Cost.conversationCount).toBe(2);
      expect(patient1Cost.totalCost).toBe(0.50); // 0.20 + 0.30
      expect(patient1Cost.conversations).toHaveLength(2);
      
      // Check patient 2 (Jane Smith)
      const patient2Cost = res.body.patientCosts.find(p => p.patientId === patient2._id.toString());
      expect(patient2Cost).toBeDefined();
      expect(patient2Cost.patientName).toBe('Jane Smith');
      expect(patient2Cost.conversationCount).toBe(1);
      expect(patient2Cost.totalCost).toBe(0.15);
      expect(patient2Cost.conversations).toHaveLength(1);
    });

    it('should accept custom days parameter', async () => {
      const res = await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs?days=30`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.period.days).toBe(30);
      expect(res.body.period.startDate).toBeDefined();
      expect(res.body.period.endDate).toBeDefined();
    });

    it('should return empty result when no unbilled conversations exist', async () => {
      // Mark all conversations as billed
      await Conversation.updateMany({}, { lineItemId: new mongoose.Types.ObjectId() });

      const res = await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toMatchObject({
        orgId: org._id.toString(),
        orgName: 'Test Healthcare Org',
        totalUnbilledCost: 0,
        patientCosts: []
      });

      // Restore unbilled status for other tests
      await Conversation.updateMany({}, { $unset: { lineItemId: 1 } });
    });

    it('should return 404 for non-existent organization', async () => {
      const nonExistentOrgId = new mongoose.Types.ObjectId();
      
      await request(app)
        .get(`/v1/payments/orgs/${nonExistentOrgId}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .expect(401);
    });

    it('should require proper authorization', async () => {
      // Create caregiver with insufficient permissions
      const limitedCaregiver = await Caregiver.create({
        email: 'limited@healthcare.com',
        name: 'Limited User',
        role: 'staff',
        org: org._id,
        isEmailVerified: true,
        password: 'testpassword123',
        phone: '+12345678902'
      });
      const limitedTokens = await tokenService.generateAuthTokens(limitedCaregiver);

      await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${limitedTokens.access.token}`)
        .expect(403);
    });
  });

  describe('POST /payments/patients/:patientId/invoices', () => {
    it('should create invoice from patient conversations', async () => {
      const res = await request(app)
        .post(`/v1/payments/patients/${patient1._id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(res.body.org).toBe(org._id.toString());
      expect(res.body.status).toBe('pending');
      expect(res.body.totalAmount).toBe(0.50); // 0.20 + 0.30
      if (res.body.notes) {
        expect(res.body.notes).toContain('Billing for 300 seconds');
      }

      expect(res.body.invoiceNumber).toMatch(/^INV-\d{6}$/);
      if (res.body.lineItems) {
        expect(res.body.lineItems).toHaveLength(1);
        expect(res.body.lineItems[0].patientId).toBe(patient1._id.toString());
        expect(res.body.lineItems[0].amount).toBe(0.50);
        if (res.body.lineItems[0].description) {
          expect(res.body.lineItems[0].description).toContain('Billing for 300 seconds');
        }
        expect(res.body.lineItems[0].quantity).toBe(2); // 2 minutes total
      }
    });

    it('should mark conversations as billed after creating invoice', async () => {
      // Reset conversations to unbilled state
      await Conversation.updateMany({ patientId: patient1._id }, { $unset: { lineItemId: 1 } });

      await request(app)
        .post(`/v1/payments/patients/${patient1._id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const updatedConversations = await Conversation.find({ patientId: patient1._id });
      expect(updatedConversations.every(conv => conv.lineItemId !== null)).toBe(true);
    });

    it('should return 404 when no unbilled conversations exist', async () => {
      // Mark all conversations as billed
      await Conversation.updateMany({ patientId: patient1._id }, { 
        lineItemId: new mongoose.Types.ObjectId() 
      });

      await request(app)
        .post(`/v1/payments/patients/${patient1._id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      // Restore unbilled status
      await Conversation.updateMany({ patientId: patient1._id }, { $unset: { lineItemId: 1 } });
    });

    it('should return 404 for non-existent patient', async () => {
      const nonExistentPatientId = new mongoose.Types.ObjectId();
      
      await request(app)
        .post(`/v1/payments/patients/${nonExistentPatientId}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/v1/payments/patients/${patient1._id}/invoices`)
        .expect(401);
    });
  });

  describe('GET /payments/orgs/:orgId/invoices', () => {
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

    afterEach(async () => {
      await Invoice.deleteMany({});
      await LineItem.deleteMany({});
    });

    it('should return invoices for organization', async () => {
      const res = await request(app)
        .get(`/v1/payments/orgs/${org._id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].org).toBe(org._id.toString());
      expect(res.body[0].invoiceNumber).toBe('INV-000001');
      expect(res.body[0].status).toBe('pending');
      expect(res.body[0].totalAmount).toBe(0.65);
      if (res.body[0].lineItems) {
        expect(res.body[0].lineItems).toHaveLength(2);
      }
    });

    it('should filter invoices by status', async () => {
      const res = await request(app)
        .get(`/v1/payments/orgs/${org._id}/invoices?status=pending`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);

      const paidRes = await request(app)
        .get(`/v1/payments/orgs/${org._id}/invoices?status=paid`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(paidRes.body).toHaveLength(0);
    });

    it('should filter invoices by due date', async () => {
      const futureDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days from now
      const res = await request(app)
        .get(`/v1/payments/orgs/${org._id}/invoices?dueDate=${futureDate.toISOString()}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);

      const pastDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      const pastRes = await request(app)
        .get(`/v1/payments/orgs/${org._id}/invoices?dueDate=${pastDate.toISOString()}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(pastRes.body).toHaveLength(0);
    });

    it('should return empty array for non-existent organization', async () => {
      const nonExistentOrgId = new mongoose.Types.ObjectId();
      
      const res = await request(app)
        .get(`/v1/payments/orgs/${nonExistentOrgId}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/v1/payments/orgs/${org._id}/invoices`)
        .expect(401);
    });
  });

  describe('GET /payments/patients/:patientId/invoices', () => {
    let invoice;

    beforeEach(async () => {
      // Create a test invoice
      invoice = await Invoice.create({
        org: org._id,
        invoiceNumber: 'INV-000001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 0.50
      });

      // Create line item for patient1
      await LineItem.create({
        patientId: patient1._id,
        invoiceId: invoice._id,
        amount: 0.50,
        description: 'Billing for patient 1',
        quantity: 2
      });
    });

    afterEach(async () => {
      await Invoice.deleteMany({});
      await LineItem.deleteMany({});
    });

    it('should return invoices for patient', async () => {
      const res = await request(app)
        .get(`/v1/payments/patients/${patient1._id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].org).toBe(org._id.toString());
      expect(res.body[0].invoiceNumber).toBe('INV-000001');
      expect(res.body[0].status).toBe('pending');
      expect(res.body[0].totalAmount).toBe(0.50);
      if (res.body[0].lineItems) {
        expect(res.body[0].lineItems).toHaveLength(1);
      }
    });

    it('should filter invoices by status', async () => {
      const res = await request(app)
        .get(`/v1/payments/patients/${patient1._id}/invoices?status=pending`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);

      const paidRes = await request(app)
        .get(`/v1/payments/patients/${patient1._id}/invoices?status=paid`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(paidRes.body).toHaveLength(0);
    });

    it('should return empty array for patient with no invoices', async () => {
      const res = await request(app)
        .get(`/v1/payments/patients/${patient2._id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/v1/payments/patients/${patient1._id}/invoices`)
        .expect(401);
    });
  });
});
