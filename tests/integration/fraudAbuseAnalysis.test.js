// tests/integration/fraudAbuseAnalysis.test.js

require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const mongoose = require('mongoose');

const app = require('../utils/integration-app');
const { Patient, Caregiver, Org, Conversation, Message, FraudAbuseAnalysis } = require('../../src/models');
const { tokenService } = require('../../src/services');
const { setupMongoMemoryServer, teardownMongoMemoryServer } = require('../utils/mongodb-memory-server');

let accessToken;
let patientId;
let orgId;
let caregiverId;

beforeAll(async () => {
  await setupMongoMemoryServer();

  // Create test data
  const org = new Org({
    name: 'Test Fraud Abuse Org',
    email: 'fraudabuse@example.com',
    phone: '+16045624263',
    stripeCustomerId: 'test-stripe-id',
    isEmailVerified: true
  });
  await org.save();
  orgId = org._id;

  const caregiver = new Caregiver({
    name: 'Fraud Abuse Test Caregiver',
    email: 'fraudabuse.caregiver@example.com',
    phone: '+16045624264',
    org: orgId,
    role: 'orgAdmin',
    password: 'password123',
    patients: []
  });
  await caregiver.save();
  caregiverId = caregiver._id;

  const patient = new Patient({
    name: 'Vulnerable Test Patient',
    email: 'vulnerable.patient@example.com',
    phone: '+16045624265',
    org: orgId,
    caregivers: [caregiverId],
    isActive: true
  });
  await patient.save();
  patientId = patient._id;

  // Create conversations with fraud/abuse patterns
  const conversation1 = new Conversation({
    patientId: patientId,
    callSid: 'fraud-test-call-1',
    messages: [],
    startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 300000),
    duration: 300000,
    status: 'completed'
  });
  await conversation1.save();

  const message1 = new Message({
    role: 'patient',
    content: 'I met someone new online and they asked me to send them five thousand dollars through Western Union. They said it was urgent and I need to act now. They told me not to tell anyone about it.',
    messageType: 'text',
    conversationId: conversation1._id
  });
  await message1.save();

  conversation1.messages = [message1._id];
  await conversation1.save();

  const conversation2 = new Conversation({
    patientId: patientId,
    callSid: 'abuse-test-call-1',
    messages: [],
    startTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    endTime: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000 + 200000),
    duration: 200000,
    status: 'completed'
  });
  await conversation2.save();

  const message2 = new Message({
    role: 'patient',
    content: 'Someone hit me and I have a black eye. They said I deserved it. I am scared of them and I don\'t want to tell anyone because they said they would hurt me more.',
    messageType: 'text',
    conversationId: conversation2._id
  });
  await message2.save();

  conversation2.messages = [message2._id];
  await conversation2.save();

  const conversation3 = new Conversation({
    patientId: patientId,
    callSid: 'neglect-test-call-1',
    messages: [],
    startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    endTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 250000),
    duration: 250000,
    status: 'completed'
  });
  await conversation3.save();

  const message3 = new Message({
    role: 'patient',
    content: 'I haven\'t eaten in two days. There is no food in the house. I am hungry and I don\'t know what to do. No one visits me anymore.',
    messageType: 'text',
    conversationId: conversation3._id
  });
  await message3.save();

  conversation3.messages = [message3._id];
  await conversation3.save();

  // Generate access token
  accessToken = tokenService.generateToken(caregiver._id);
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Fraud Abuse Analysis API', () => {
  describe('GET /fraud-abuse-analysis/:patientId', () => {
    it('should return 200 and fraud/abuse analysis for a patient', async () => {
      const res = await request(app)
        .get(`/v1/fraud-abuse-analysis/${patientId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeRange: 'month' })
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('analysis');
      expect(res.body.data.analysis).toHaveProperty('financialRisk');
      expect(res.body.data.analysis).toHaveProperty('abuseRisk');
      expect(res.body.data.analysis).toHaveProperty('relationshipRisk');
      expect(res.body.data.analysis).toHaveProperty('overallRiskScore');
    });

    it('should detect financial exploitation patterns', async () => {
      const res = await request(app)
        .get(`/v1/fraud-abuse-analysis/${patientId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeRange: 'month' })
        .expect(httpStatus.OK);

      expect(res.body.data.analysis.financialRisk.riskScore).toBeGreaterThan(0);
      expect(res.body.data.analysis.financialRisk.largeAmountMentions).toBeGreaterThan(0);
    });

    it('should detect abuse patterns', async () => {
      const res = await request(app)
        .get(`/v1/fraud-abuse-analysis/${patientId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeRange: 'month' })
        .expect(httpStatus.OK);

      expect(res.body.data.analysis.abuseRisk.riskScore).toBeGreaterThan(0);
      expect(res.body.data.analysis.abuseRisk.physicalAbuseScore).toBeGreaterThan(0);
    });

    it('should generate warnings for high risk', async () => {
      const res = await request(app)
        .get(`/v1/fraud-abuse-analysis/${patientId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ timeRange: 'month' })
        .expect(httpStatus.OK);

      expect(res.body.data.analysis.warnings.length).toBeGreaterThan(0);
      expect(res.body.data.recommendations).toBeDefined();
      expect(Array.isArray(res.body.data.recommendations)).toBe(true);
      expect(res.body.data.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('GET /fraud-abuse-analysis/results/:patientId', () => {
    it('should return 200 and stored analysis results', async () => {
      // First trigger an analysis to create stored results
      await request(app)
        .post(`/v1/fraud-abuse-analysis/trigger-patient/${patientId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      const res = await request(app)
        .get(`/v1/fraud-abuse-analysis/results/${patientId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ limit: 10 })
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('results');
      expect(Array.isArray(res.body.results)).toBe(true);
    });
  });

  describe('POST /fraud-abuse-analysis/trigger-patient/:patientId', () => {
    it('should trigger analysis and return results', async () => {
      const res = await request(app)
        .post(`/v1/fraud-abuse-analysis/trigger-patient/${patientId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('result');
      expect(res.body.result).toHaveProperty('overallRiskScore');
      expect(res.body.result.overallRiskScore).toBeGreaterThan(0);
    });

    it('should store analysis results in database', async () => {
      await request(app)
        .post(`/v1/fraud-abuse-analysis/trigger-patient/${patientId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      const storedAnalysis = await FraudAbuseAnalysis.findOne({ patientId });
      expect(storedAnalysis).toBeTruthy();
      expect(storedAnalysis.overallRiskScore).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent patient', async () => {
      const fakePatientId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/v1/fraud-abuse-analysis/${fakePatientId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.NOT_FOUND);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/v1/fraud-abuse-analysis/${patientId}`)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });
});

