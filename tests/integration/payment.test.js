const request = require('supertest');
const faker = require('faker');
const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
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

let mongoServer;

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
      });

      const message2 = await Message.create({
        role: 'doctor',
        content: 'Test doctor response',
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
        org: patient.org.toString(),
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
      });
      const message2 = await Message.create({
        role: 'doctor',
        content: 'Test doctor response for unassigned patient',
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
        org: patient.org.toString(),
        invoiceNumber: expect.any(String),
        issueDate: expect.any(String),
        dueDate: expect.any(String),
        status: expect.any(String),
        totalAmount: expect.any(Number),
      });
    });

    test('should return 401 Unauthorized when no auth token is provided', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      await request(app)
        .post(`/v1/payments/patients/${patient.id}/invoices`)
        // No Authorization header set
        .send()
        .expect(httpStatus.UNAUTHORIZED);
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

    test('should return 200 and filtered invoices for a patient', async () => {
      // Use admin (orgAdmin role) instead of caregiverOne (staff role)
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);
      const [patient] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      // Modify invoiceOne to have status 'paid'
      const paidInvoice = { ...invoiceOne, status: 'paid' };
      const pendingInvoice = { ...invoiceTwo, status: 'pending' };

      await insertInvoices(patient, [paidInvoice, pendingInvoice]);

      const res = await request(app)
        .get(`/v1/payments/patients/${patient.id}/invoices?status=paid`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].status).toBe('paid');
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
  });
});
