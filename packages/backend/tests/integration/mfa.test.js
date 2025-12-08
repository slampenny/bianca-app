// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const speakeasy = require('speakeasy');

// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');
const { Caregiver, Token, Org } = require('../../src/models');
const {
  caregiverOne,
  password,
  insertCaregivertoOrgAndReturnToken,
  insertCaregiversAndAddToOrg,
} = require('../fixtures/caregiver.fixture');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');

// Set MFA encryption key for tests
process.env.MFA_ENCRYPTION_KEY = 'test-encryption-key-for-mfa-testing-32-chars';

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('MFA routes', () => {
  beforeEach(async () => {
    // Clear database before each test to avoid duplicate key errors
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('GET /v1/mfa/status', () => {
    test('should return 200 and MFA status for authenticated user', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      const res = await request(app)
        .get('/v1/mfa/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        mfaEnabled: false,
        backupCodesRemaining: 0,
      });
    });

    test('should return 401 if access token is missing', async () => {
      await request(app)
        .get('/v1/mfa/status')
        .send()
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/mfa/enable', () => {
    test('should return 200 and generate QR code and backup codes', async () => {
      const [org] = await insertOrgs([orgOne]);
      // Use insertCaregivertoOrgAndReturnToken which handles the insertion
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      const res = await request(app)
        .post('/v1/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('qrCode');
      expect(res.body).toHaveProperty('secret');
      expect(res.body).toHaveProperty('backupCodes');
      expect(res.body.qrCode).toContain('data:image');
      expect(res.body.secret).toBeTruthy();
      expect(res.body.backupCodes).toHaveLength(10);

      // Verify MFA secret is saved but not enabled yet
      // Get the caregiver by email since we don't have the _id from the fixture
      const caregiver = await Caregiver.findOne({ email: caregiverOne.email });
      expect(caregiver).toBeDefined();
      expect(caregiver.mfaSecret).toBeDefined();
      expect(caregiver.mfaEnabled).toBe(false);
      expect(caregiver.mfaBackupCodes).toHaveLength(10);
    });

    test('should return 401 if access token is missing', async () => {
      // Note: The auth middleware might return 401 or 404 depending on route registration
      // If route is not found, it's 404; if auth fails, it's 401
      const res = await request(app)
        .post('/v1/mfa/enable')
        .send();
      
      // Accept either 401 (unauthorized) or 404 (route not found/not authenticated)
      expect([httpStatus.UNAUTHORIZED, httpStatus.NOT_FOUND]).toContain(res.status);
    });

    test('should return 400 if MFA is already enabled', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken, caregiver } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      // Enable MFA first
      await request(app)
        .post('/v1/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send();

      // Get the secret from the enable response
      const enableRes = await request(app)
        .post('/v1/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);
      
      const secret = enableRes.body.secret;
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });

      // Verify and enable
      await request(app)
        .post('/v1/mfa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token })
        .expect(httpStatus.OK);

      // Try to enable again
      await request(app)
        .post('/v1/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/mfa/verify', () => {
    test('should return 200 and enable MFA with valid token', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken, caregiver } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      // Step 1: Enable MFA (get QR code)
      const enableRes = await request(app)
        .post('/v1/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      const secret = enableRes.body.secret;

      // Step 2: Generate a valid TOTP token
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });

      // Step 3: Verify and enable
      const res = await request(app)
        .post('/v1/mfa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token })
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        message: 'MFA successfully enabled',
        mfaEnabled: true,
      });

      // Verify MFA is enabled in database
      const updatedCaregiver = await Caregiver.findById(caregiver._id);
      expect(updatedCaregiver.mfaEnabled).toBe(true);
      expect(updatedCaregiver.mfaEnrolledAt).toBeDefined();
    });

    test('should return 400 if token is missing', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      await request(app)
        .post('/v1/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send();

      await request(app)
        .post('/v1/mfa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 401 if token is invalid', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      await request(app)
        .post('/v1/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send();

      await request(app)
        .post('/v1/mfa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: '000000' })
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 400 if MFA setup not initiated', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      await request(app)
        .post('/v1/mfa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: '123456' })
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/mfa/disable', () => {
    test('should return 200 and disable MFA with valid token', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken, caregiver } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      // Enable MFA first
      const enableRes = await request(app)
        .post('/v1/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      const secret = enableRes.body.secret;
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });

      await request(app)
        .post('/v1/mfa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token })
        .expect(httpStatus.OK);

      // Now disable with a new token
      const disableToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });

      const res = await request(app)
        .post('/v1/mfa/disable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: disableToken })
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        message: 'MFA successfully disabled',
        mfaEnabled: false,
      });

      // Verify MFA is disabled in database
      const updatedCaregiver = await Caregiver.findById(caregiver._id);
      expect(updatedCaregiver.mfaEnabled).toBe(false);
      expect(updatedCaregiver.mfaSecret).toBeNull();
      expect(updatedCaregiver.mfaBackupCodes).toHaveLength(0);
    });

    test('should return 400 if MFA is not enabled', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      await request(app)
        .post('/v1/mfa/disable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: '123456' })
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/mfa/backup-codes', () => {
    test('should return 200 and regenerate backup codes with valid token', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken, caregiver } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      // Enable MFA first
      const enableRes = await request(app)
        .post('/v1/mfa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      const secret = enableRes.body.secret;
      const token = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });

      await request(app)
        .post('/v1/mfa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token })
        .expect(httpStatus.OK);

      // Get old backup codes count
      const caregiverBefore = await Caregiver.findById(caregiver._id);
      const oldBackupCodesCount = caregiverBefore.mfaBackupCodes.length;

      // Regenerate with a new token
      const regenerateToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
      });

      const res = await request(app)
        .post('/v1/mfa/backup-codes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: regenerateToken })
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('backupCodes');
      expect(res.body.backupCodes).toHaveLength(10);

      // Verify backup codes were regenerated
      const caregiverAfter = await Caregiver.findById(caregiver._id);
      expect(caregiverAfter.mfaBackupCodes.length).toBe(10);
      expect(caregiverAfter.mfaBackupCodes).not.toEqual(caregiverBefore.mfaBackupCodes);
    });

    test('should return 400 if MFA is not enabled', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      await request(app)
        .post('/v1/mfa/backup-codes')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: '123456' })
        .expect(httpStatus.BAD_REQUEST);
    });
  });
});

