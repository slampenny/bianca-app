// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const moment = require('moment');

// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { Org, Patient, Token } = require('../../src/models');
const { insertOrgs } = require('../fixtures/org.fixture');
const { patientOne } = require('../fixtures/patient.fixture');
const tokenService = require('../../src/services/token.service');
const { tokenTypes } = require('../../src/config/tokens');
const { setupMongoMemoryServer, teardownMongoMemoryServer } = require('../utils/mongodb-memory-server');

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Patient Consent Routes', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Patient.deleteMany();
    await Token.deleteMany();
  });

  describe('POST /v1/patients/consent/verify', () => {
    test('should return 200 and verify consent with valid token', async () => {
      const [org] = await insertOrgs([{ name: 'Test Org', email: 'test@example.com', country: 'US', requirePatientConsent: true }]);
      const patientData = { ...patientOne, org: org._id, consented: false };
      const patient = await Patient.create(patientData);

      // Generate consent token
      const consentToken = await tokenService.generatePatientConsentToken(patient);

      const res = await request(app)
        .post('/v1/patients/consent/verify')
        .query({ token: consentToken })
        .set('Accept', 'application/json')
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        success: true,
        message: expect.stringContaining('Thank you'),
        alreadyConsented: false,
        patient: expect.objectContaining({
          id: patient._id.toString(),
          consented: true,
        }),
      });

      // Verify patient was updated
      const updatedPatient = await Patient.findById(patient._id);
      expect(updatedPatient.consented).toBe(true);
      expect(updatedPatient.consentedAt).toBeTruthy();
    });

    test('should return 200 with alreadyConsented=true when patient already consented', async () => {
      const [org] = await insertOrgs([{ name: 'Test Org', email: 'test@example.com', country: 'US', requirePatientConsent: true }]);
      const patientData = { 
        ...patientOne, 
        org: org._id, 
        consented: true,
        consentedAt: new Date(),
        consentEmailVersion: '1.0'
      };
      const patient = await Patient.create(patientData);

      // Generate consent token
      const consentToken = await tokenService.generatePatientConsentToken(patient);

      const res = await request(app)
        .post('/v1/patients/consent/verify')
        .query({ token: consentToken })
        .set('Accept', 'application/json')
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.alreadyConsented).toBe(true);
      expect(res.body.message).toContain('already provided consent');
    });

    test('should return 400 if consent token is missing', async () => {
      await request(app)
        .post('/v1/patients/consent/verify')
        .set('Accept', 'application/json')
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if consent token is invalid', async () => {
      await request(app)
        .post('/v1/patients/consent/verify')
        .query({ token: 'invalid-token' })
        .set('Accept', 'application/json')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if consent token is expired', async () => {
      const [org] = await insertOrgs([{ name: 'Test Org', email: 'test@example.com', country: 'US', requirePatientConsent: true }]);
      const patientData = { ...patientOne, org: org._id, consented: false };
      const patient = await Patient.create(patientData);

      // Create expired token
      const expires = moment().subtract(1, 'day');
      const expiredToken = tokenService.generateToken(patient._id, expires, tokenTypes.PATIENT_CONSENT);
      await tokenService.saveToken(expiredToken, null, expires, tokenTypes.PATIENT_CONSENT, false, patient._id);

      await request(app)
        .post('/v1/patients/consent/verify')
        .query({ token: expiredToken })
        .set('Accept', 'application/json')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return HTML page when Accept header does not include application/json', async () => {
      const [org] = await insertOrgs([{ name: 'Test Org', email: 'test@example.com', country: 'US', requirePatientConsent: true }]);
      const patientData = { ...patientOne, org: org._id, consented: false };
      const patient = await Patient.create(patientData);

      const consentToken = await tokenService.generatePatientConsentToken(patient);

      const res = await request(app)
        .post('/v1/patients/consent/verify')
        .query({ token: consentToken })
        .expect(httpStatus.OK);

      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Consent Confirmed');
      expect(res.text).toContain('Thank you');
    });
  });

  describe('GET /v1/patients/consent/verify', () => {
    test('should return 200 and verify consent with valid token via GET', async () => {
      const [org] = await insertOrgs([{ name: 'Test Org', email: 'test@example.com', country: 'US', requirePatientConsent: true }]);
      const patientData = { ...patientOne, org: org._id, consented: false };
      const patient = await Patient.create(patientData);

      const consentToken = await tokenService.generatePatientConsentToken(patient);

      const res = await request(app)
        .get(`/v1/patients/consent/verify?token=${consentToken}`)
        .set('Accept', 'application/json')
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.patient.consented).toBe(true);
    });

    test('should return HTML page by default for GET requests', async () => {
      const [org] = await insertOrgs([{ name: 'Test Org', email: 'test@example.com', country: 'US', requirePatientConsent: true }]);
      const patientData = { ...patientOne, org: org._id, consented: false };
      const patient = await Patient.create(patientData);

      const consentToken = await tokenService.generatePatientConsentToken(patient);

      const res = await request(app)
        .get(`/v1/patients/consent/verify?token=${consentToken}`)
        .expect(httpStatus.OK);

      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Consent Confirmed');
    });
  });
});




