// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const moment = require('moment');

const app = require('../utils/integration-app');
const { Org, Client, Token, ConsentRecord } = require('../../src/models');
const { insertOrgs } = require('../fixtures/org.fixture');
const { clientOne } = require('../fixtures/client.fixture');
const tokenService = require('../../src/services/token.service');
const { tokenTypes } = require('../../src/config/tokens');
const { REQUIRED_CLIENT_CONSENT_PURPOSES } = require('../../src/constants/clientConsent.constants');
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
    test('should return 200 and verify consent with valid token and selected purposes', async () => {
      const [org] = await insertOrgs([
        { name: 'Test Org', email: 'test@example.com', country: 'DE', requireClientConsent: true },
      ]);
      const client = await Client.create({ ...clientOne, org: org._id });
      const consentToken = await tokenService.generateClientConsentToken(client);

      const res = await request(app)
        .post('/v1/clients/consent/verify')
        .query({ token: consentToken })
        .send({ purposes: REQUIRED_CLIENT_CONSENT_PURPOSES })
        .set('Accept', 'application/json')
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.fullyConsented).toBe(true);
      expect(res.body.alreadyConsented).toBe(false);
      if (res.body.client) {
        expect(res.body.client.consented).toBe(true);
      }

      const updatedClient = await Client.findById(client._id);
      expect(updatedClient.consented).toBe(true);

      const record = await ConsentRecord.findOne({ clientId: client._id, recordType: 'grant' });
      expect(record).toBeTruthy();
      expect(record.purposes).toEqual(expect.arrayContaining(REQUIRED_CLIENT_CONSENT_PURPOSES));
    });

    test('should return 400 when no purposes are submitted', async () => {
      const [org] = await insertOrgs([
        { name: 'Test Org', email: 'test@example.com', country: 'US', requireClientConsent: true },
      ]);
      const client = await Client.create({ ...clientOne, org: org._id });
      const consentToken = await tokenService.generateClientConsentToken(client);

      await request(app)
        .post('/v1/clients/consent/verify')
        .query({ token: consentToken })
        .send({ purposes: [] })
        .set('Accept', 'application/json')
        .expect(httpStatus.BAD_REQUEST);
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
        .send({ purposes: ['recording'] })
        .set('Accept', 'application/json')
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /v1/clients/consent/verify', () => {
    test('should validate token without granting consent', async () => {
      const [org] = await insertOrgs([
        { name: 'Test Org', email: 'test@example.com', country: 'US', requireClientConsent: true },
      ]);
      const client = await Client.create({ ...clientOne, org: org._id });
      const consentToken = await tokenService.generateClientConsentToken(client);

      const res = await request(app)
        .get(`/v1/clients/consent/verify?token=${consentToken}`)
        .set('Accept', 'application/json')
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(true);
      expect(res.body.clientName).toBeTruthy();

      const unchanged = await Client.findById(client._id);
      expect(unchanged.consented).toBe(false);
      expect(await ConsentRecord.countDocuments({ clientId: client._id })).toBe(0);
    });
  });
});
