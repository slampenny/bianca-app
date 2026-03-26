// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const moment = require('moment');

// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { Org, Client, Token, ConsentRecord } = require('../../src/models');
const { insertOrgs } = require('../fixtures/org.fixture');
const { clientOne } = require('../fixtures/client.fixture');
const tokenService = require('../../src/services/token.service');
const { tokenTypes } = require('../../src/config/tokens');
const { setupMongoMemoryServer, teardownMongoMemoryServer } = require('../utils/mongodb-memory-server');

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Client consent routes', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Client.deleteMany();
    await Token.deleteMany();
    await ConsentRecord.deleteMany();
  });

  describe('POST /v1/clients/consent/verify', () => {
    test('should return 200 and verify consent with valid token', async () => {
      const [org] = await insertOrgs([{ name: 'Test Org', email: 'test@example.com', country: 'US', requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      // Generate consent token
      const consentToken = await tokenService.generateClientConsentToken(client);

      const res = await request(app)
        .post('/v1/clients/consent/verify')
        .query({ token: consentToken })
        .set('Accept', 'application/json')
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Thank you/);
      expect(res.body.alreadyConsented).toBe(false);
      if (res.body.client) {
        expect(res.body.client).toMatchObject({
          id: client._id.toString(),
          consented: true,
        });
      }

      // Verify patient was updated
      const updatedClient = await Client.findById(client._id);
      expect(updatedClient.consented).toBe(true);
      expect(updatedClient.consentedAt).toBeTruthy();

      const auditRows = await ConsentRecord.find({
        userId: client._id,
        userModel: 'Client',
        consentType: 'recording',
      });
      expect(auditRows.length).toBeGreaterThanOrEqual(1);
      expect(auditRows.some((r) => r.granted === true)).toBe(true);
    });

    test('should return 200 with alreadyConsented=true when patient already consented', async () => {
      const [org] = await insertOrgs([{ name: 'Test Org', email: 'test@example.com', country: 'US', requireClientConsent: true }]);
      const clientData = { 
        ...clientOne, 
        org: org._id, 
        consented: true,
        consentedAt: new Date(),
        consentEmailVersion: '1.0'
      };
      const client = await Client.create(clientData);

      // Generate consent token
      const consentToken = await tokenService.generateClientConsentToken(client);

      const res = await request(app)
        .post('/v1/clients/consent/verify')
        .query({ token: consentToken })
        .set('Accept', 'application/json')
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.alreadyConsented).toBe(true);
      expect(res.body.message).toContain('already provided consent');
    });

    test('should return 400 if consent token is missing', async () => {
      await request(app)
        .post('/v1/clients/consent/verify')
        .set('Accept', 'application/json')
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if consent token is invalid', async () => {
      await request(app)
        .post('/v1/clients/consent/verify')
        .query({ token: 'invalid-token' })
        .set('Accept', 'application/json')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 401 if consent token is expired', async () => {
      const [org] = await insertOrgs([{ name: 'Test Org', email: 'test@example.com', country: 'US', requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      // Create expired token
      const expires = moment().subtract(1, 'day');
      const expiredToken = tokenService.generateToken(client._id, expires, tokenTypes.CLIENT_CONSENT);
      await tokenService.saveToken(expiredToken, null, expires, tokenTypes.CLIENT_CONSENT, false, client._id);

      await request(app)
        .post('/v1/clients/consent/verify')
        .query({ token: expiredToken })
        .set('Accept', 'application/json')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return HTML page when Accept header does not include application/json', async () => {
      const [org] = await insertOrgs([{ name: 'Test Org', email: 'test@example.com', country: 'US', requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const consentToken = await tokenService.generateClientConsentToken(client);

      const res = await request(app)
        .post('/v1/clients/consent/verify')
        .query({ token: consentToken })
        .expect(httpStatus.OK);

      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Consent Confirmed');
      expect(res.text).toContain('Thank you');
    });
  });

  describe('GET /v1/clients/consent/verify', () => {
    test('should return 200 and verify consent with valid token via GET', async () => {
      const [org] = await insertOrgs([{ name: 'Test Org', email: 'test@example.com', country: 'US', requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const consentToken = await tokenService.generateClientConsentToken(client);

      const res = await request(app)
        .get(`/v1/clients/consent/verify?token=${consentToken}`)
        .set('Accept', 'application/json')
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      if (res.body.client) {
        expect(res.body.client.consented).toBe(true);
      }
    });

    test('should return HTML page by default for GET requests', async () => {
      const [org] = await insertOrgs([{ name: 'Test Org', email: 'test@example.com', country: 'US', requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const consentToken = await tokenService.generateClientConsentToken(client);

      const res = await request(app)
        .get(`/v1/clients/consent/verify?token=${consentToken}`)
        .expect(httpStatus.OK);

      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Consent Confirmed');
    });
  });
});


















