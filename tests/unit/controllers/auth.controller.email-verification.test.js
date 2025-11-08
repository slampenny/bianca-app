const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const httpStatus = require('http-status');
const { Caregiver, Org, Token } = require('../../../src/models');
const { tokenTypes } = require('../../../src/config/tokens');
const authController = require('../../../src/controllers/auth.controller');
const emailService = require('../../../src/services/email.service');
const ApiError = require('../../../src/utils/ApiError');

let mongoServer;

beforeAll(async () => {
  // Set JWT_SECRET for token generation
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing';
  
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Auth Controller - Email Verification', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      get: jest.fn().mockReturnValue('test-user-agent'),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
      setHeader: jest.fn(), // Added for verifyEmail tests
    };
    next = jest.fn((error) => {
      // Simulate error middleware behavior - when catchAsync passes error to next(),
      // the error middleware converts it and calls res.status().json()
      if (error) {
        const statusCode = error.statusCode || 500;
        const message = error.message || 'Internal server error';
        res.status(statusCode);
        // Match the format expected by tests (just message, not code)
        res.json({ message });
      }
    });
    
    // Mock email service (external service - SES)
    jest.spyOn(emailService, 'sendVerificationEmail').mockResolvedValue();
    
    // Don't mock generateVerifyEmailToken - let it use the real implementation
    // It needs to save tokens to the database for the tests to work correctly
  });

  afterEach(async () => {
    await Caregiver.deleteMany();
    await Org.deleteMany();
    await Token.deleteMany();
    jest.clearAllMocks(); // Clear call history but keep spies
  });

  describe('resendVerificationEmail', () => {
    test('should resend verification email for unverified user', async () => {
      // Create an unverified caregiver
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isEmailVerified: false,
        role: 'unverified',
      });
      await caregiver.save();

      req.body = { email: 'test@example.com' };

      // Don't mock our own services - let them use the real database
      // The caregiver is already saved to the database, so getCaregiverByEmail will find it
      // Email service is mocked (external service - SES)
      
      // Call the wrapped function - catchAsync returns a function
      const wrappedFn = authController.resendVerificationEmail;
      const promise = wrappedFn(req, res, next);
      
      // Wait for the promise to resolve
      await promise;
      
      // Wait a tick for any final async operations
      await new Promise(resolve => setImmediate(resolve));

      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.send).toHaveBeenCalledWith({
        message: 'Verification email sent successfully',
      });
      
      // Verify email service was called
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    test('should reject resend for verified user', async () => {
      // Create a verified caregiver
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isEmailVerified: true,
        role: 'staff',
      });
      await caregiver.save();

      req.body = { email: 'test@example.com' };

      // Don't mock our own services - let them use the real database
      await authController.resendVerificationEmail(req, res, next);

      // catchAsync handles ApiError by calling res.status().json()
      expect(res.status).toHaveBeenCalledWith(httpStatus.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email is already verified',
      });
    });

    test('should reject resend for non-existent user', async () => {
      req.body = { email: 'nonexistent@example.com' };

      // Don't mock our own services - let them use the real database
      // This email doesn't exist in the database, so it should return NOT_FOUND
      await authController.resendVerificationEmail(req, res, next);

      // catchAsync handles ApiError by calling res.status().json()
      expect(res.status).toHaveBeenCalledWith(httpStatus.NOT_FOUND);
      expect(res.json).toHaveBeenCalledWith({
        message: 'User not found',
      });
    });

    test('should reject resend without email', async () => {
      req.body = {};

      await authController.resendVerificationEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(httpStatus.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email is required',
      });
    });
  });

  describe('verifyEmail', () => {
    test('should verify email with valid token', async () => {
      // Create a caregiver
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isEmailVerified: false,
        role: 'unverified',
      });
      await caregiver.save();

      // Create a verification token
      const tokenService = require('../../../src/services/token.service');
      const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);

      req.query = { token: verifyEmailToken };

      // Don't mock our own services - let them use the real database
      // The token was generated for the caregiver, so verifyEmail should work
      await authController.verifyEmail(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      // Check that HTML response was sent (contains HTML structure)
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<div class="checkmark">'));
      
      // Verify the caregiver was actually verified
      const updatedCaregiver = await Caregiver.findById(caregiver._id);
      expect(updatedCaregiver.isEmailVerified).toBe(true);
    });

    test('should handle verification failure', async () => {
      req.query = { token: 'invalid-token' };

      // Don't mock our own services - let them use the real implementation
      // An invalid token should cause verifyEmail to throw an error
      await authController.verifyEmail(req, res, next);

      // verifyEmail handles errors internally and sends HTML (not JSON)
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
      expect(res.status).toHaveBeenCalledWith(httpStatus.UNAUTHORIZED);
      // Check that HTML error response was sent (contains HTML structure and error icon)
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<div class="error-icon">'));
    });
  });
});