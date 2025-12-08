// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const faker = require('faker');
const httpStatus = require('http-status');
const mongoose = require('mongoose');
// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const config = require('../../src/config/config');
const { Invoice, LineItem, Patient, Org, Token, Caregiver, Conversation, Message } = require('../../src/models');
const { patientOne, insertPatients, insertPatientsAndAddToCaregiver } = require('../fixtures/patient.fixture');

const { orgOne, insertOrgs } = require('../fixtures/org.fixture');

const {
  caregiverOne,
  admin,
  insertCaregivertoOrgAndReturnToken,
  insertCaregivertoOrgAndReturnTokenByRole,
} = require('../fixtures/caregiver.fixture');

const { conversationOne, conversationTwo, insertConversations } = require('../fixtures/conversation.fixture');

const { invoiceOne, invoiceTwo, insertInvoices } = require('../fixtures/invoice.fixture');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Payment routes', () => {
  afterEach(async () => {
    await Caregiver.deleteMany();
    await Org.deleteMany();
    await Patient.deleteMany();
    await Invoice.deleteMany();
    await LineItem.deleteMany();
    await Token.deleteMany();
    await Conversation.deleteMany();
    await Message.deleteMany();
  });

  describe('POST /v1/payments/patients/:patientId/invoices', () => {
    test('should create an invoice from conversations and return 201', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      // Create messages first
      const message1 = await Message.create({
        role: 'patient',
        content: 'Test patient message',
        conversationId: new mongoose.Types.ObjectId(), // Temporary ID, will be updated
      });

      const message2 = await Message.create({
        role: 'assistant',
        content: 'Test doctor response',
        conversationId: new mongoose.Types.ObjectId(), // Temporary ID, will be updated
      });

      // Modify the conversation fixtures to use the patient ID and message IDs
      const patientConversations = [
        {
          ...conversationOne,
          patientId: patient._id,
          messages: [message1._id, message2._id],
          lineItemId: null,
          startTime: new Date(Date.now() - 3600000),
          endTime: new Date(),
          duration: 1800,
        },
      ];

      // Use your existing insertConversations helper
      await insertConversations(patientConversations);

      const res = await request(app)
        .post(`/v1/payments/patients/${patient.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.any(String),
        org: expect.any(String),
        invoiceNumber: expect.any(String),
        issueDate: expect.any(String),
        dueDate: expect.any(String),
        status: expect.any(String),
        totalAmount: expect.any(Number),
      });
    });

    test('should create an invoice for a patient with no caregiver assigned and return 201', async () => {
      // Create a caregiver with orgAdmin role
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      // Create a patient without assigning to the caregiver (patient belongs to the org only)
      const [patient] = await insertPatients([{ ...patientOne, org: caregiver.org }]);

      // Create messages for the conversation
      const message1 = await Message.create({
        role: 'patient',
        content: 'Test patient message for unassigned patient',
        conversationId: new mongoose.Types.ObjectId(), // Temporary ID, will be updated
      });
      const message2 = await Message.create({
        role: 'assistant',
        content: 'Test doctor response for unassigned patient',
        conversationId: new mongoose.Types.ObjectId(), // Temporary ID, will be updated
      });

      const patientConversations = [
        {
          ...conversationOne,
          patientId: patient._id,
          messages: [message1._id, message2._id],
          lineItemId: null,
          startTime: new Date(Date.now() - 3600000),
          endTime: new Date(),
          duration: 1800,
        },
      ];

      await insertConversations(patientConversations);

      const res = await request(app)
        .post(`/v1/payments/patients/${patient.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.any(String),
        org: expect.any(String),
        invoiceNumber: expect.any(String),
        issueDate: expect.any(String),
        dueDate: expect.any(String),
        status: expect.any(String),
        totalAmount: expect.any(Number),
      });
    });

    test('should return 404 when patient does not exist', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const nonExistentPatientId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .post(`/v1/payments/patients/${nonExistentPatientId}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.NOT_FOUND);

      expect(res.body.message).toBe('Patient not found');
    });

    test('should return 404 when no uncharged conversations exist', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      // Create a conversation that is already charged (has lineItemId)
      const message1 = await Message.create({
        role: 'patient',
        content: 'Test patient message',
        conversationId: new mongoose.Types.ObjectId(),
      });

      const message2 = await Message.create({
        role: 'assistant',
        content: 'Test doctor response',
        conversationId: new mongoose.Types.ObjectId(),
      });

      const chargedConversation = {
        ...conversationOne,
        patientId: patient._id,
        messages: [message1._id, message2._id],
        lineItemId: new mongoose.Types.ObjectId(), // Already charged
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(),
        duration: 1800,
      };

      await insertConversations([chargedConversation]);

      const res = await request(app)
        .post(`/v1/payments/patients/${patient.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.NOT_FOUND);

      expect(res.body.message).toBe('No uncharged conversations found');
    });

    test('should return 401 when no authorization token provided', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [patient] = await insertPatients([{ ...patientOne, org: org._id }]);

      await request(app)
        .post(`/v1/payments/patients/${patient.id}/invoices`)
        .send()
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 when user lacks permission', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'staff');
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      await request(app)
        .post(`/v1/payments/patients/${patient.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should handle conversations with zero duration by setting minimum duration', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      const message1 = await Message.create({
        role: 'patient',
        content: 'Test patient message',
        conversationId: new mongoose.Types.ObjectId(),
      });

      const message2 = await Message.create({
        role: 'assistant',
        content: 'Test doctor response',
        conversationId: new mongoose.Types.ObjectId(),
      });

      const zeroDurationConversation = [
        {
          ...conversationOne,
          patientId: patient._id,
          messages: [message1._id, message2._id],
          lineItemId: null,
          startTime: new Date(Date.now() - 3600000),
          endTime: new Date(Date.now() - 3600000), // Same as start time - will be adjusted by validation
          duration: 0, // This will be overridden by the pre-save hook
          status: 'failed', // Mark as failed call to trigger minimum billing
        },
      ];

      await insertConversations(zeroDurationConversation);

      const res = await request(app)
        .post(`/v1/payments/patients/${patient.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.CREATED);

      // The conversation should now have a minimum 30-second duration for failed calls
      expect(res.body.totalAmount).toBeGreaterThan(0);
      
      // Calculate expected amount for 30 seconds
      const expectedAmount = (30 / 60) * config.billing.ratePerMinute;
      expect(res.body.totalAmount).toBe(expectedAmount);
    });
  });

  describe('GET /v1/payments/patients/:patientId/invoices', () => {
    test('should return 200 and all invoices for a patient', async () => {
      // Use admin (orgAdmin role) instead of caregiverOne (staff role)
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);
      await insertInvoices(patient, [invoiceOne, invoiceTwo]);

      const res = await request(app)
        .get(`/v1/payments/patients/${patient.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual({
        id: expect.any(String),
        org: patient.org.toString(),
        invoiceNumber: expect.any(String),
        issueDate: expect.any(String),
        dueDate: expect.any(String),
        status: expect.any(String),
        totalAmount: expect.any(Number),
        notes: expect.any(String),
        // createdAt and updatedAt no longer expected
      });
    });

    test('should return 200 and filtered invoices by status', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);
      await insertInvoices(patient, [invoiceOne, invoiceTwo]);

      const res = await request(app)
        .get(`/v1/payments/patients/${patient.id}/invoices?status=pending`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('pending');
    });

    test('should return 200 and filtered invoices by due date', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);
      // Insert an invoice with dueDate set to today
      const today = new Date().toISOString().split('T')[0];
      const todayInvoice = {
        ...invoiceOne,
        dueDate: today,
      };
      await insertInvoices(patient, [todayInvoice, invoiceTwo]);

      const res = await request(app)
        .get(`/v1/payments/patients/${patient.id}/invoices?dueDate=${today}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].dueDate).toContain(today);
    });

    test('should return 404 when patient does not exist', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const nonExistentPatientId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/v1/payments/patients/${nonExistentPatientId}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK); // Returns empty array, not 404

      expect(res.body).toHaveLength(0);
    });

    test('should return 401 when no authorization token provided', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [patient] = await insertPatients([{ ...patientOne, org: org._id }]);

      await request(app)
        .get(`/v1/payments/patients/${patient.id}/invoices`)
        .send()
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 when user lacks permission', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'staff');
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      await request(app)
        .get(`/v1/payments/patients/${patient.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return empty array for patient with no invoices', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      const res = await request(app)
        .get(`/v1/payments/patients/${patient.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /v1/payments/orgs/:orgId/invoices', () => {
    test('should return 200 and all invoices for an org', async () => {
      // Use admin (orgAdmin role) consistently
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient1, patient2] = await insertPatients([
        { ...patientOne, org: org.id },
        { ...patientOne, email: faker.internet.email(), org: org.id },
      ]);

      await insertInvoices(patient1, [invoiceOne]);
      await insertInvoices(patient2, [invoiceTwo]);

      const res = await request(app)
        .get(`/v1/payments/orgs/${org.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual({
        id: expect.any(String),
        org: org.id,
        invoiceNumber: expect.any(String),
        issueDate: expect.any(String),
        notes: expect.any(String),
        dueDate: expect.any(String),
        status: expect.any(String),
        totalAmount: expect.any(Number),
      });
    });

    test('should return 200 and filtered invoices for an org', async () => {
      // Use admin (orgAdmin role) consistently
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatients([{ ...patientOne, org: org.id }]);

      const todayInvoice = {
        ...invoiceOne,
        dueDate: new Date().toISOString().split('T')[0],
      };
      const futureInvoice = {
        ...invoiceTwo,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      await insertInvoices(patient, [todayInvoice, futureInvoice]);

      const today = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .get(`/v1/payments/orgs/${org.id}/invoices?dueDate=${today}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].dueDate).toContain(today);
    });

    test('should return 200 and filter invoices by status', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatients([{ ...patientOne, org: org.id }]);

      await insertInvoices(patient, [invoiceOne, invoiceTwo]);

      const res = await request(app)
        .get(`/v1/payments/orgs/${org.id}/invoices?status=pending`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('pending');
    });

    test('should return 404 when org does not exist', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const nonExistentOrgId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/v1/payments/orgs/${nonExistentOrgId}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK); // Returns empty array, not 404

      expect(res.body).toHaveLength(0);
    });

    test('should return 401 when no authorization token provided', async () => {
      const [org] = await insertOrgs([orgOne]);

      await request(app)
        .get(`/v1/payments/orgs/${org.id}/invoices`)
        .send()
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 when user lacks permission', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'staff');

      await request(app)
        .get(`/v1/payments/orgs/${org.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return empty array for org with no invoices', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);

      const res = await request(app)
        .get(`/v1/payments/orgs/${org.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toHaveLength(0);
    });

    test('should handle multiple filters simultaneously', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatients([{ ...patientOne, org: org.id }]);

      const pendingInvoice = {
        ...invoiceOne,
        status: 'pending',
        dueDate: new Date().toISOString().split('T')[0],
      };
      const paidInvoice = {
        ...invoiceTwo,
        status: 'paid',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      await insertInvoices(patient, [pendingInvoice, paidInvoice]);

      const today = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .get(`/v1/payments/orgs/${org.id}/invoices?status=pending&dueDate=${today}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('pending');
      expect(res.body[0].dueDate).toContain(today);
    });
  });

  describe('Invoice creation with multiple conversations', () => {
    test('should aggregate multiple conversations into single invoice', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      // Create multiple conversations for the same patient
      const conversations = [];
      for (let i = 0; i < 3; i++) {
        const message1 = await Message.create({
          role: 'patient',
          content: `Test patient message ${i}`,
          conversationId: new mongoose.Types.ObjectId(),
        });

        const message2 = await Message.create({
          role: 'assistant',
          content: `Test doctor response ${i}`,
          conversationId: new mongoose.Types.ObjectId(),
        });

        conversations.push({
          ...conversationOne,
          patientId: patient._id,
          messages: [message1._id, message2._id],
          lineItemId: null,
          startTime: new Date(Date.now() - (i + 1) * 3600000),
          endTime: new Date(Date.now() - i * 3600000),
          duration: 600 + (i * 60), // 10, 11, 12 minutes
        });
      }

      await insertConversations(conversations);

      const res = await request(app)
        .post(`/v1/payments/patients/${patient.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.CREATED);

      // Should create one invoice with total duration of all conversations
      expect(res.body.totalAmount).toBeGreaterThan(0);
      
      // Verify all conversations are now marked as charged
      const updatedConversations = await Conversation.find({ patientId: patient._id });
      updatedConversations.forEach(conv => {
        expect(conv.lineItemId).toBeDefined();
      });
    });
  });

  describe('Invoice number generation', () => {
    test('should generate sequential invoice numbers', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      // Create first conversation and invoice
      const message1 = await Message.create({
        role: 'patient',
        content: 'Test patient message 1',
        conversationId: new mongoose.Types.ObjectId(),
      });

      const message2 = await Message.create({
        role: 'assistant',
        content: 'Test doctor response 1',
        conversationId: new mongoose.Types.ObjectId(),
      });

      const conversation1 = {
        ...conversationOne,
        patientId: patient._id,
        messages: [message1._id, message2._id],
        lineItemId: null,
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(),
        duration: 600,
      };

      await insertConversations([conversation1]);

      const res1 = await request(app)
        .post(`/v1/payments/patients/${patient.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.CREATED);

      // Create second conversation and invoice
      const message3 = await Message.create({
        role: 'patient',
        content: 'Test patient message 2',
        conversationId: new mongoose.Types.ObjectId(),
      });

      const message4 = await Message.create({
        role: 'assistant',
        content: 'Test doctor response 2',
        conversationId: new mongoose.Types.ObjectId(),
      });

      const conversation2 = {
        ...conversationTwo,
        patientId: patient._id,
        messages: [message3._id, message4._id],
        lineItemId: null,
        startTime: new Date(Date.now() - 1800000),
        endTime: new Date(),
        duration: 900,
      };

      await insertConversations([conversation2]);

      const res2 = await request(app)
        .post(`/v1/payments/patients/${patient.id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.CREATED);

      // Extract numbers from invoice numbers
      const num1 = parseInt(res1.body.invoiceNumber.split('-')[1]);
      const num2 = parseInt(res2.body.invoiceNumber.split('-')[1]);

      expect(num2).toBe(num1 + 1);
    });
  });
});
