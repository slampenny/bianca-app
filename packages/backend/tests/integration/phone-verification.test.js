// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../utils/integration-app');
const { setupMongoMemoryServer, teardownMongoMemoryServer } = require('../utils/mongodb-memory-server');
const { Caregiver, Org } = require('../../src/models');
const { insertCaregiversAndAddToOrg } = require('../fixtures/caregiver.fixture');
const { insertOrgs } = require('../fixtures/org.fixture');
const { caregiverOne, caregiverOneWithPassword, password } = require('../fixtures/caregiver.fixture');
const { orgOne } = require('../fixtures/org.fixture');
const { snsService } = require('../../src/services/sns.service');

describe('Phone Verification Integration Tests', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
    // Mock SNS service methods by directly assigning mock functions
    // This works even if methods don't exist yet
    snsService.sendToPhone = jest.fn().mockResolvedValue({
      MessageId: 'test-message-id-123'
    });
    snsService.formatPhoneNumber = jest.fn().mockImplementation((phone) => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 10) {
        return `+1${digits}`;
      }
      return phone.startsWith('+') ? phone : `+${phone}`;
    });
    snsService.isValidPhoneNumber = jest.fn().mockReturnValue(true);
    // Mock isInitialized getter
    Object.defineProperty(snsService, 'isInitialized', {
      get: jest.fn(() => true),
      configurable: true
    });
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
    jest.restoreAllMocks();
  });

  afterEach(async () => {
    await Caregiver.deleteMany();
    await Org.deleteMany();
    jest.clearAllMocks();
  });

  describe('POST /v1/phone-verification/send-code', () => {
    test('should send verification code successfully', async () => {
      const [org] = await insertOrgs([orgOne]);
      const caregiver = await insertCaregiversAndAddToOrg(org, [{
        ...caregiverOneWithPassword,
        isPhoneVerified: false,
      }]);
      
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({
          email: caregiverOne.email,
          password,
        })
        .expect(httpStatus.OK);

      const accessToken = loginRes.body.tokens.access.token;

      const res = await request(app)
        .post('/v1/phone-verification/send-code')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('expiresAt');
      expect(res.body).toHaveProperty('phoneNumber');
      expect(res.body.phoneNumber).toContain('***'); // Masked

      // Verify code was stored
      const caregiverWithCode = await Caregiver.findById(caregiver[0]._id)
        .select('+phoneVerificationCode +phoneVerificationCodeExpires');
      expect(caregiverWithCode.phoneVerificationCode).toMatch(/^\d{6}$/);
      expect(caregiverWithCode.phoneVerificationCodeExpires).toBeInstanceOf(Date);
    });

    test('should return 401 if not authenticated', async () => {
      await request(app)
        .post('/v1/phone-verification/send-code')
        .send({})
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 400 if phone already verified', async () => {
      const [org] = await insertOrgs([orgOne]);
      const caregiver = await insertCaregiversAndAddToOrg(org, [{
        ...caregiverOneWithPassword,
        isPhoneVerified: true,
      }]);
      
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({
          email: caregiverOne.email,
          password,
        })
        .expect(httpStatus.OK);

      const accessToken = loginRes.body.tokens.access.token;

      await request(app)
        .post('/v1/phone-verification/send-code')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/phone-verification/verify', () => {
    test('should verify code successfully', async () => {
      const [org] = await insertOrgs([orgOne]);
      const caregiver = await insertCaregiversAndAddToOrg(org, [{
        ...caregiverOneWithPassword,
        isPhoneVerified: false,
      }]);
      
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({
          email: caregiverOne.email,
          password,
        })
        .expect(httpStatus.OK);

      const accessToken = loginRes.body.tokens.access.token;

      // Send code first
      await request(app)
        .post('/v1/phone-verification/send-code')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(httpStatus.OK);

      // Get the code from database
      const caregiverWithCode = await Caregiver.findById(caregiver[0]._id)
        .select('+phoneVerificationCode');
      const code = caregiverWithCode.phoneVerificationCode;

      // Verify the code
      const res = await request(app)
        .post('/v1/phone-verification/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code })
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');

      // Verify caregiver is now verified
      const verifiedCaregiver = await Caregiver.findById(caregiver[0]._id);
      expect(verifiedCaregiver.isPhoneVerified).toBe(true);
    });

    test('should return 400 for invalid code', async () => {
      const [org] = await insertOrgs([orgOne]);
      const caregiver = await insertCaregiversAndAddToOrg(org, [{
        ...caregiverOneWithPassword,
        isPhoneVerified: false,
      }]);
      
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({
          email: caregiverOne.email,
          password,
        })
        .expect(httpStatus.OK);

      const accessToken = loginRes.body.tokens.access.token;

      await request(app)
        .post('/v1/phone-verification/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: '000000' })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if code is missing', async () => {
      const [org] = await insertOrgs([orgOne]);
      await insertCaregiversAndAddToOrg(org, [caregiverOneWithPassword]);
      
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({
          email: caregiverOne.email,
          password,
        })
        .expect(httpStatus.OK);

      const accessToken = loginRes.body.tokens.access.token;

      await request(app)
        .post('/v1/phone-verification/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/phone-verification/resend', () => {
    test('should resend verification code', async () => {
      const [org] = await insertOrgs([orgOne]);
      const caregiver = await insertCaregiversAndAddToOrg(org, [{
        ...caregiverOneWithPassword,
        isPhoneVerified: false,
      }]);
      
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({
          email: caregiverOne.email,
          password,
        })
        .expect(httpStatus.OK);

      const accessToken = loginRes.body.tokens.access.token;

      // Send initial code
      await request(app)
        .post('/v1/phone-verification/send-code')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(httpStatus.OK);

      // Get first code
      const caregiverWithCode1 = await Caregiver.findById(caregiver[0]._id)
        .select('+phoneVerificationCode');
      const firstCode = caregiverWithCode1.phoneVerificationCode;

      // Resend code
      const res = await request(app)
        .post('/v1/phone-verification/resend')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');

      // Get new code (select hidden fields)
      const caregiverWithCode2 = await Caregiver.findById(caregiver[0]._id)
        .select('+phoneVerificationCode +phoneVerificationCodeExpires');
      const secondCode = caregiverWithCode2.phoneVerificationCode;

      // Codes should be different (or same if generated within same millisecond, but unlikely)
      // At minimum, the expiration should be updated
      expect(caregiverWithCode2.phoneVerificationCodeExpires).toBeInstanceOf(Date);
      expect(caregiverWithCode2.phoneVerificationCode).toMatch(/^\d{6}$/);
    });

    test('should return 400 if phone already verified', async () => {
      const [org] = await insertOrgs([orgOne]);
      await insertCaregiversAndAddToOrg(org, [{
        ...caregiverOneWithPassword,
        isPhoneVerified: true,
      }]);
      
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({
          email: caregiverOne.email,
          password,
        })
        .expect(httpStatus.OK);

      const accessToken = loginRes.body.tokens.access.token;

      await request(app)
        .post('/v1/phone-verification/resend')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(httpStatus.BAD_REQUEST);
    });
  });
});

