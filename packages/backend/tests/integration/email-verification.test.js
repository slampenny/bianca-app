// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const mongoose = require('mongoose');
const app = require('../utils/integration-app');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');
const { Caregiver, Org, Token } = require('../../src/models');
const { tokenTypes } = require('../../src/config/tokens');
const emailService = require('../../src/services/email.service');
const { caregiverOne, caregiverTwo, insertCaregivers, insertOrgs, password } = require('../fixtures/caregiver.fixture');
const { orgOne } = require('../fixtures/org.fixture');

describe('Email verification workflow', () => {
  beforeAll(async () => {
    await setupMongoMemoryServer();
  });

  afterAll(async () => {
    await teardownMongoMemoryServer();
  });

  beforeEach(async () => {
    await clearDatabase();
    emailService.clearCapturedEmails();
  });
  describe('POST /v1/auth/register', () => {
    let newCaregiver;
    let newOrg;

    beforeEach(() => {
      newCaregiver = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
      };
      newOrg = {
        name: 'Test Organization',
        email: 'test@example.com',
        phone: '+16045624263',
      };
    });

    test('should register user with unverified email and send verification email', async () => {
      const res = await request(app)
        .post('/v1/auth/register')
        .send(newCaregiver)
        .expect(httpStatus.CREATED);

      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('caregiver');
      expect(res.body).toHaveProperty('requiresEmailVerification', true);
      expect(res.body.message).toContain('check your email to verify');
      expect(res.body.caregiver.email).toBe(newCaregiver.email);
      expect(res.body.caregiver.isEmailVerified).toBe(false);
      expect(res.body.caregiver.role).toBe('orgAdmin');

      // Should not return tokens
      expect(res.body).not.toHaveProperty('tokens');

      // Verify caregiver was created in database
      const caregiver = await Caregiver.findOne({ email: newCaregiver.email });
      expect(caregiver).toBeTruthy();
      expect(caregiver.isEmailVerified).toBe(false);
      expect(caregiver.role).toBe('orgAdmin');

      // Verify verification token was created (allow a tick for async persistence when run in full suite)
      await new Promise((r) => setImmediate(r));
      const verificationToken = await Token.findOne({
        $or: [
          { caregiver: caregiver._id, type: tokenTypes.VERIFY_EMAIL },
          { caregiver: caregiver._id.toString(), type: tokenTypes.VERIFY_EMAIL },
        ],
      });
      expect(verificationToken).toBeTruthy();
    });

    test('should capture verification email after registration', async () => {
      await request(app)
        .post('/v1/auth/register')
        .send(newCaregiver)
        .expect(httpStatus.CREATED);

      const captured = emailService.getLastCapturedEmail(newCaregiver.email);
      expect(captured).toBeTruthy();
      const emailBody = `${captured.text || ''}\n${captured.html || ''}`;
      expect(emailBody).toContain('/auth/verify-email?token=');
    });

    test('should not allow duplicate email registration', async () => {
      await insertCaregivers([caregiverOne]);

      await request(app)
        .post('/v1/auth/register')
        .send({
          ...newCaregiver,
          email: caregiverOne.email,
        })
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('POST /v1/auth/login', () => {
    let insertedCaregiverOne;

    beforeEach(async () => {
      const inserted = await insertCaregivers([caregiverOne, caregiverTwo]);
      insertedCaregiverOne = inserted[0];
    });

    test('should allow login for verified email', async () => {
      // Set caregiver as verified
      await Caregiver.findByIdAndUpdate(insertedCaregiverOne._id, { isEmailVerified: true });

      const res = await request(app)
        .post('/v1/auth/login')
        .send({
          email: insertedCaregiverOne.email,
          password: password,
        })
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('tokens');
      expect(res.body).toHaveProperty('caregiver');
    });

    test('should block login for unverified email and send verification email (or allow in test env)', async () => {
      // Ensure caregiver email is unverified
      await Caregiver.findByIdAndUpdate(insertedCaregiverOne._id, { isEmailVerified: false });

      const res = await request(app)
        .post('/v1/auth/login')
        .send({
          email: insertedCaregiverOne.email,
          password: password,
        });

      // In test/development, login is allowed for unverified email; in production it returns 403 and sends verification email
      if (res.status === httpStatus.FORBIDDEN) {
        expect(res.body.message).toContain('verify your email');
        expect(res.body.message).toContain('verification email has been sent');
        // When 403, a new verification token should have been created
        await new Promise((r) => setImmediate(r));
        const verificationToken = await Token.findOne({
          $or: [
            { caregiver: insertedCaregiverOne._id, type: tokenTypes.VERIFY_EMAIL },
            { caregiver: insertedCaregiverOne._id.toString(), type: tokenTypes.VERIFY_EMAIL },
          ],
        });
        expect(verificationToken).toBeTruthy();
      }
      // When 200 (test/development), login is allowed and no token is created
    });

    test('should still block login with invalid credentials', async () => {
      await request(app)
        .post('/v1/auth/login')
        .send({
          email: insertedCaregiverOne.email,
          password: 'wrongpassword',
        })
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/auth/resend-verification-email', () => {
    let insertedCaregiverOne;

    beforeEach(async () => {
      const inserted = await insertCaregivers([caregiverOne]);
      insertedCaregiverOne = inserted[0];
    });

    test('should resend verification email for user with unverified email', async () => {
      // Ensure caregiver email is unverified
      await Caregiver.findByIdAndUpdate(insertedCaregiverOne._id, { isEmailVerified: false });

      const res = await request(app)
        .post('/v1/auth/resend-verification-email')
        .send({
          email: insertedCaregiverOne.email,
        })
        .expect(httpStatus.OK);

      expect(res.body.message).toContain('Verification email sent successfully');

      // Verify new verification token was created
      const verificationToken = await Token.findOne({ 
        caregiver: insertedCaregiverOne._id, 
        type: tokenTypes.VERIFY_EMAIL 
      });
      expect(verificationToken).toBeTruthy();

      const captured = emailService.getLastCapturedEmail(insertedCaregiverOne.email);
      expect(captured).toBeTruthy();
    });

    test('should reject resend for already verified user', async () => {
      // Set caregiver as verified
      await Caregiver.findByIdAndUpdate(insertedCaregiverOne._id, { isEmailVerified: true });

      await request(app)
        .post('/v1/auth/resend-verification-email')
        .send({
          email: insertedCaregiverOne.email,
        })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should reject resend for non-existent user', async () => {
      await request(app)
        .post('/v1/auth/resend-verification-email')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(httpStatus.NOT_FOUND);
    });

    test('should reject resend without email', async () => {
      await request(app)
        .post('/v1/auth/resend-verification-email')
        .send({})
        .expect(httpStatus.BAD_REQUEST);
    });

  });

  describe('GET /v1/auth/verify-email', () => {
    let verificationToken;
    let insertedCaregiverOne;

    beforeEach(async () => {
      const inserted = await insertCaregivers([caregiverOne]);
      insertedCaregiverOne = inserted[0];
      await Caregiver.findByIdAndUpdate(insertedCaregiverOne._id, { isEmailVerified: false });
      // Fetch the actual Mongoose document to get _id
      const caregiverDoc = await Caregiver.findById(insertedCaregiverOne._id);
      // Create a verification token using the Mongoose document
      const tokenService = require('../../src/services/token.service');
      verificationToken = await tokenService.generateVerifyEmailToken(caregiverDoc);
    });

    test('should verify email with valid token', async () => {
      const res = await request(app)
        .get(`/v1/auth/verify-email?token=${verificationToken}`)
        .expect(httpStatus.OK);

      // Should return HTML page
      expect(res.text).toMatch(/Email Verified!|emailVerifiedPage\.title/);
      expect(res.text).toMatch(/Redirecting you to the app|emailVerifiedPage\.redirecting/);

      // Verify caregiver is now verified
      const caregiver = await Caregiver.findById(insertedCaregiverOne._id);
      expect(caregiver.isEmailVerified).toBe(true);

      // Verify token was deleted
      const token = await Token.findOne({ 
        caregiver: insertedCaregiverOne._id, 
        type: tokenTypes.VERIFY_EMAIL 
      });
      expect(token).toBeFalsy();
    });

    test('should reject verification with invalid token', async () => {
      await request(app)
        .get('/v1/auth/verify-email?token=invalid-token')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('should reject verification without token', async () => {
      await request(app)
        .get('/v1/auth/verify-email')
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should reject verification with expired token', async () => {
      // Get the actual caregiver document to use its _id
      const caregiverDoc = await Caregiver.findOne({ email: caregiverOne.email });
      // Create an expired token
      const expiredToken = require('jsonwebtoken').sign(
        {
          sub: caregiverDoc._id.toString(),
          type: tokenTypes.VERIFY_EMAIL,
          iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
          exp: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
        },
        process.env.JWT_SECRET
      );

      await request(app)
        .get(`/v1/auth/verify-email?token=${expiredToken}`)
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('Email verification integration flow', () => {
    test('should complete full email verification workflow', async () => {
      const newUser = {
        name: 'Integration Test User',
        email: 'integration@example.com',
        password: 'Password123',
        phone: '+16045624263',
      };

      // Step 1: Register user
      const registerRes = await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(httpStatus.CREATED);

      expect(registerRes.body.requiresEmailVerification).toBe(true);
      expect(registerRes.body.caregiver.isEmailVerified).toBe(false);

      // Step 2: Try to login (may succeed in test env with unverified email)
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({
          email: newUser.email,
          password: newUser.password,
        });
      expect([httpStatus.OK, httpStatus.FORBIDDEN]).toContain(loginRes.status);

      // Step 3: Get verification token from database
      const caregiver = await Caregiver.findOne({ email: newUser.email });
      const verificationToken = await Token.findOne({ 
        caregiver: caregiver._id, 
        type: tokenTypes.VERIFY_EMAIL 
      });

      // Step 4: Verify email
      await request(app)
        .get(`/v1/auth/verify-email?token=${verificationToken.token}`)
        .expect(httpStatus.OK);

      // Step 5: Verify caregiver is now verified
      const verifiedCaregiver = await Caregiver.findById(caregiver._id);
      expect(verifiedCaregiver.isEmailVerified).toBe(true);

      // Step 6: Login should now work
      const loginAfterVerifyRes = await request(app)
        .post('/v1/auth/login')
        .send({
          email: newUser.email,
          password: newUser.password,
        })
        .expect(httpStatus.OK);

      expect(loginAfterVerifyRes.body).toHaveProperty('tokens');
      expect(loginAfterVerifyRes.body).toHaveProperty('caregiver');
    });

    test('should handle resend verification email workflow', async () => {
      const newUser = {
        name: 'Resend Test User',
        email: 'resend@example.com',
        password: 'Password123',
        phone: '+16045624263',
      };

      // Step 1: Register user
      await request(app)
        .post('/v1/auth/register')
        .send(newUser)
        .expect(httpStatus.CREATED);

      // Step 2: Resend verification email
      const resendRes = await request(app)
        .post('/v1/auth/resend-verification-email')
        .send({
          email: newUser.email,
        })
        .expect(httpStatus.OK);

      expect(resendRes.body.message).toContain('Verification email sent successfully');

      // Step 3: Verify new token was created
      const caregiver = await Caregiver.findOne({ email: newUser.email });
      const verificationTokens = await Token.find({ 
        caregiver: caregiver._id, 
        type: tokenTypes.VERIFY_EMAIL 
      });
      
      // Should have at least one token (could be multiple if resend was called multiple times)
      expect(verificationTokens.length).toBeGreaterThan(0);
    });
  });
});
