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
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
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
    };
    next = jest.fn();
    
    // Mock email service
    jest.spyOn(emailService, 'sendVerificationEmail').mockResolvedValue();
    
    // Mock token service
    const tokenService = require('../../../src/services/token.service');
    jest.spyOn(tokenService, 'generateVerifyEmailToken').mockResolvedValue('mock-token-123');
  });

  afterEach(async () => {
    await Caregiver.deleteMany();
    await Org.deleteMany();
    await Token.deleteMany();
    jest.restoreAllMocks();
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

      // Debug: Check if function exists
      expect(typeof authController.resendVerificationEmail).toBe('function');
      
      console.log('About to call resendVerificationEmail');
      console.log('Caregiver exists:', await Caregiver.findOne({ email: 'test@example.com' }));
      console.log('Function type:', typeof authController.resendVerificationEmail);
      console.log('Function toString:', authController.resendVerificationEmail.toString().substring(0, 200));
      try {
        await authController.resendVerificationEmail(req, res, next);
        console.log('Function completed without error');
      } catch (error) {
        console.log('Error caught:', error);
        throw error;
      }

      // Debug: Check what was called
      console.log('res.status calls:', res.status.mock.calls);
      console.log('res.send calls:', res.send.mock.calls);
      console.log('res.json calls:', res.json.mock.calls);
      console.log('next calls:', next.mock.calls);

      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.send).toHaveBeenCalledWith({
        message: 'Verification email sent successfully',
      });
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

      await authController.resendVerificationEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(httpStatus.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email is already verified',
      });
    });

    test('should reject resend for non-existent user', async () => {
      req.body = { email: 'nonexistent@example.com' };

      await authController.resendVerificationEmail(req, res, next);

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

      await authController.verifyEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Email Verified!'));
    });

    test('should handle verification failure', async () => {
      req.query = { token: 'invalid-token' };

      await authController.verifyEmail(req, res, next);

      expect(res.status).toHaveBeenCalledWith(httpStatus.UNAUTHORIZED);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Email verification failed',
      });
    });
  });
});