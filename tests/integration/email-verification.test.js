// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const mongoose = require('mongoose');
const app = require('../utils/integration-app');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');
const { Caregiver, Org, Token } = require('../../src/models');
const { tokenTypes } = require('../../src/config/tokens');
const { caregiverOne, caregiverTwo, insertCaregivers, insertOrgs } = require('../fixtures/caregiver.fixture');
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
      expect(res.body.caregiver.role).toBe('unverified');

      // Should not return tokens
      expect(res.body).not.toHaveProperty('tokens');

      // Verify caregiver was created in database
      const caregiver = await Caregiver.findOne({ email: newCaregiver.email });
      expect(caregiver).toBeTruthy();
      expect(caregiver.isEmailVerified).toBe(false);
      expect(caregiver.role).toBe('unverified');

      // Verify verification token was created
      const verificationToken = await Token.findOne({ 
        caregiver: caregiver._id, 
        type: tokenTypes.VERIFY_EMAIL 
      });
      expect(verificationToken).toBeTruthy();
    });

    test('should fail registration if email verification sending fails', async () => {
      // Mock email service to throw error
      const emailService = require('../../src/services/email.service');
      const originalSendVerificationEmail = emailService.sendVerificationEmail;
      emailService.sendVerificationEmail = jest.fn().mockRejectedValue(new Error('Email service down'));

      await request(app)
        .post('/v1/auth/register')
        .send(newCaregiver)
        .expect(httpStatus.INTERNAL_SERVER_ERROR);

      // Restore original function
      emailService.sendVerificationEmail = originalSendVerificationEmail;
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
    beforeEach(async () => {
      await insertCaregivers([caregiverOne, caregiverTwo]);
    });

    test('should allow login for verified email', async () => {
      // Set caregiver as verified
      await Caregiver.findByIdAndUpdate(caregiverOne._id, { isEmailVerified: true });

      const res = await request(app)
        .post('/v1/auth/login')
        .send({
          email: caregiverOne.email,
          password: caregiverOne.password,
        })
        .expect(httpStatus.OK);

      expect(res.body).toHaveProperty('tokens');
      expect(res.body).toHaveProperty('caregiver');
    });

    test('should block login for unverified email and send verification email', async () => {
      // Ensure caregiver is unverified
      await Caregiver.findByIdAndUpdate(caregiverOne._id, { isEmailVerified: false });

      const res = await request(app)
        .post('/v1/auth/login')
        .send({
          email: caregiverOne.email,
          password: caregiverOne.password,
        })
        .expect(httpStatus.FORBIDDEN);

      expect(res.body.message).toContain('verify your email');
      expect(res.body.message).toContain('verification email has been sent');

      // Verify new verification token was created
      const verificationToken = await Token.findOne({ 
        caregiver: caregiverOne._id, 
        type: tokenTypes.VERIFY_EMAIL 
      });
      expect(verificationToken).toBeTruthy();
    });

    test('should handle email verification sending failure gracefully', async () => {
      // Mock email service to throw error
      const emailService = require('../../src/services/email.service');
      const originalSendVerificationEmail = emailService.sendVerificationEmail;
      emailService.sendVerificationEmail = jest.fn().mockRejectedValue(new Error('Email service down'));

      // Ensure caregiver is unverified
      await Caregiver.findByIdAndUpdate(caregiverOne._id, { isEmailVerified: false });

      const res = await request(app)
        .post('/v1/auth/login')
        .send({
          email: caregiverOne.email,
          password: caregiverOne.password,
        })
        .expect(httpStatus.FORBIDDEN);

      expect(res.body.message).toContain('verify your email');

      // Restore original function
      emailService.sendVerificationEmail = originalSendVerificationEmail;
    });

    test('should still block login with invalid credentials', async () => {
      await request(app)
        .post('/v1/auth/login')
        .send({
          email: caregiverOne.email,
          password: 'wrongpassword',
        })
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('POST /v1/auth/resend-verification-email', () => {
    beforeEach(async () => {
      await insertCaregivers([caregiverOne]);
    });

    test('should resend verification email for unverified user', async () => {
      // Ensure caregiver is unverified
      await Caregiver.findByIdAndUpdate(caregiverOne._id, { isEmailVerified: false });

      const res = await request(app)
        .post('/v1/auth/resend-verification-email')
        .send({
          email: caregiverOne.email,
        })
        .expect(httpStatus.OK);

      expect(res.body.message).toContain('Verification email sent successfully');

      // Verify new verification token was created
      const verificationToken = await Token.findOne({ 
        caregiver: caregiverOne._id, 
        type: tokenTypes.VERIFY_EMAIL 
      });
      expect(verificationToken).toBeTruthy();
    });

    test('should reject resend for already verified user', async () => {
      // Set caregiver as verified
      await Caregiver.findByIdAndUpdate(caregiverOne._id, { isEmailVerified: true });

      await request(app)
        .post('/v1/auth/resend-verification-email')
        .send({
          email: caregiverOne.email,
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

    test('should handle email sending failure', async () => {
      // Mock email service to throw error
      const emailService = require('../../src/services/email.service');
      const originalSendVerificationEmail = emailService.sendVerificationEmail;
      emailService.sendVerificationEmail = jest.fn().mockRejectedValue(new Error('Email service down'));

      // Ensure caregiver is unverified
      await Caregiver.findByIdAndUpdate(caregiverOne._id, { isEmailVerified: false });

      await request(app)
        .post('/v1/auth/resend-verification-email')
        .send({
          email: caregiverOne.email,
        })
        .expect(httpStatus.INTERNAL_SERVER_ERROR);

      // Restore original function
      emailService.sendVerificationEmail = originalSendVerificationEmail;
    });
  });

  describe('GET /v1/auth/verify-email', () => {
    let verificationToken;

    beforeEach(async () => {
      await insertCaregivers([caregiverOne]);
      // Create a verification token
      const tokenService = require('../../src/services/token.service');
      verificationToken = await tokenService.generateVerifyEmailToken(caregiverOne);
    });

    test('should verify email with valid token', async () => {
      const res = await request(app)
        .get(`/v1/auth/verify-email?token=${verificationToken}`)
        .expect(httpStatus.OK);

      // Should return HTML page
      expect(res.text).toContain('Email Verified!');
      expect(res.text).toContain('Redirecting you to the app');

      // Verify caregiver is now verified
      const caregiver = await Caregiver.findById(caregiverOne._id);
      expect(caregiver.isEmailVerified).toBe(true);

      // Verify token was deleted
      const token = await Token.findOne({ 
        caregiver: caregiverOne._id, 
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
      // Create an expired token
      const expiredToken = require('jsonwebtoken').sign(
        {
          sub: caregiverOne._id,
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

      // Step 2: Try to login (should fail)
      await request(app)
        .post('/v1/auth/login')
        .send({
          email: newUser.email,
          password: newUser.password,
        })
        .expect(httpStatus.FORBIDDEN);

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
      const loginRes = await request(app)
        .post('/v1/auth/login')
        .send({
          email: newUser.email,
          password: newUser.password,
        })
        .expect(httpStatus.OK);

      expect(loginRes.body).toHaveProperty('tokens');
      expect(loginRes.body).toHaveProperty('caregiver');
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
