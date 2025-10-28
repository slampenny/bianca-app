const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { Caregiver, Org, Token } = require('../../models');
const { tokenTypes } = require('../../config/tokens');
const authController = require('../../controllers/auth.controller');
const authService = require('../../services/auth.service');
const tokenService = require('../../services/token.service');
const emailService = require('../../services/email.service');
const caregiverService = require('../../services/caregiver.service');
const ApiError = require('../../utils/ApiError');

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
    };
    next = jest.fn();
  });

  describe('register', () => {
    beforeEach(() => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+1234567890',
      };
    });

    test('should register user and send verification email', async () => {
      const mockOrg = {
        caregivers: [{ _id: 'caregiver123', email: 'test@example.com' }],
      };
      const mockCaregiver = {
        _id: 'caregiver123',
        email: 'test@example.com',
        name: 'Test User',
        isEmailVerified: false,
        role: 'unverified',
      };

      // Mock services
      const orgService = require('../../services/org.service');
      orgService.createOrg = jest.fn().mockResolvedValue(mockOrg);
      tokenService.generateVerifyEmailToken = jest.fn().mockResolvedValue('verify-token-123');
      emailService.sendVerificationEmail = jest.fn().mockResolvedValue();

      await authController.register(req, res, next);

      expect(orgService.createOrg).toHaveBeenCalledWith(
        {
          email: 'test@example.com',
          name: 'Test User',
          phone: '+1234567890',
        },
        {
          email: 'test@example.com',
          name: 'Test User',
          phone: '+1234567890',
          password: 'Password123',
          role: 'unverified',
        }
      );
      expect(tokenService.generateVerifyEmailToken).toHaveBeenCalledWith(mockOrg.caregivers[0]);
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith('test@example.com', 'verify-token-123');
      expect(res.status).toHaveBeenCalledWith(httpStatus.CREATED);
      expect(res.send).toHaveBeenCalledWith({
        message: 'Registration successful. Please check your email to verify your account.',
        caregiver: expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
        }),
        requiresEmailVerification: true,
      });
    });

    test('should handle email sending failure', async () => {
      const mockOrg = {
        caregivers: [{ _id: 'caregiver123', email: 'test@example.com' }],
      };

      const orgService = require('../../services/org.service');
      orgService.createOrg = jest.fn().mockResolvedValue(mockOrg);
      tokenService.generateVerifyEmailToken = jest.fn().mockResolvedValue('verify-token-123');
      emailService.sendVerificationEmail = jest.fn().mockRejectedValue(new Error('Email service down'));

      await authController.register(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(httpStatus.INTERNAL_SERVER_ERROR);
      expect(next.mock.calls[0][0].message).toContain('verification email failed');
    });
  });

  describe('login', () => {
    beforeEach(() => {
      req.body = {
        email: 'test@example.com',
        password: 'Password123',
      };
    });

    test('should allow login for verified user', async () => {
      const mockCaregiver = {
        _id: 'caregiver123',
        email: 'test@example.com',
        isEmailVerified: true,
        accountLocked: false,
        mfaEnabled: false,
        failedLoginAttempts: 0,
      };
      const mockPatients = [];
      const mockTokens = { access: { token: 'access-token' }, refresh: { token: 'refresh-token' } };

      authService.loginCaregiverWithEmailAndPassword = jest.fn().mockResolvedValue({
        caregiver: mockCaregiver,
        patients: mockPatients,
      });
      tokenService.generateAuthTokens = jest.fn().mockResolvedValue(mockTokens);

      await authController.login(req, res, next);

      expect(authService.loginCaregiverWithEmailAndPassword).toHaveBeenCalledWith('test@example.com', 'Password123');
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.send).toHaveBeenCalledWith(expect.objectContaining({
        caregiver: expect.any(Object),
        tokens: mockTokens,
      }));
    });

    test('should block login for unverified user and send verification email', async () => {
      const mockCaregiver = {
        _id: 'caregiver123',
        email: 'test@example.com',
        isEmailVerified: false,
        accountLocked: false,
        mfaEnabled: false,
        failedLoginAttempts: 0,
      };

      authService.loginCaregiverWithEmailAndPassword = jest.fn().mockResolvedValue({
        caregiver: mockCaregiver,
        patients: [],
      });
      tokenService.generateVerifyEmailToken = jest.fn().mockResolvedValue('verify-token-123');
      emailService.sendVerificationEmail = jest.fn().mockResolvedValue();

      await authController.login(req, res, next);

      expect(tokenService.generateVerifyEmailToken).toHaveBeenCalledWith(mockCaregiver);
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith('test@example.com', 'verify-token-123');
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(httpStatus.FORBIDDEN);
      expect(next.mock.calls[0][0].message).toContain('verify your email');
    });

    test('should handle email sending failure gracefully during login', async () => {
      const mockCaregiver = {
        _id: 'caregiver123',
        email: 'test@example.com',
        isEmailVerified: false,
        accountLocked: false,
        mfaEnabled: false,
        failedLoginAttempts: 0,
      };

      authService.loginCaregiverWithEmailAndPassword = jest.fn().mockResolvedValue({
        caregiver: mockCaregiver,
        patients: [],
      });
      tokenService.generateVerifyEmailToken = jest.fn().mockResolvedValue('verify-token-123');
      emailService.sendVerificationEmail = jest.fn().mockRejectedValue(new Error('Email service down'));

      await authController.login(req, res, next);

      // Should still block login even if email sending fails
      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(httpStatus.FORBIDDEN);
      expect(next.mock.calls[0][0].message).toContain('verify your email');
    });
  });

  describe('resendVerificationEmail', () => {
    beforeEach(() => {
      req.body = {
        email: 'test@example.com',
      };
    });

    test('should resend verification email for unverified user', async () => {
      const mockCaregiver = {
        _id: 'caregiver123',
        email: 'test@example.com',
        isEmailVerified: false,
      };

      caregiverService.getCaregiverByEmail = jest.fn().mockResolvedValue(mockCaregiver);
      tokenService.generateVerifyEmailToken = jest.fn().mockResolvedValue('verify-token-123');
      emailService.sendVerificationEmail = jest.fn().mockResolvedValue();

      await authController.resendVerificationEmail(req, res, next);

      expect(caregiverService.getCaregiverByEmail).toHaveBeenCalledWith('test@example.com');
      expect(tokenService.generateVerifyEmailToken).toHaveBeenCalledWith(mockCaregiver);
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith('test@example.com', 'verify-token-123');
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.send).toHaveBeenCalledWith({
        message: 'Verification email sent successfully',
      });
    });

    test('should reject resend for verified user', async () => {
      const mockCaregiver = {
        _id: 'caregiver123',
        email: 'test@example.com',
        isEmailVerified: true,
      };

      caregiverService.getCaregiverByEmail = jest.fn().mockResolvedValue(mockCaregiver);

      await authController.resendVerificationEmail(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(httpStatus.BAD_REQUEST);
      expect(next.mock.calls[0][0].message).toContain('already verified');
    });

    test('should reject resend for non-existent user', async () => {
      caregiverService.getCaregiverByEmail = jest.fn().mockResolvedValue(null);

      await authController.resendVerificationEmail(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(httpStatus.NOT_FOUND);
      expect(next.mock.calls[0][0].message).toContain('User not found');
    });

    test('should reject resend without email', async () => {
      req.body = {};

      await authController.resendVerificationEmail(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(httpStatus.BAD_REQUEST);
      expect(next.mock.calls[0][0].message).toContain('Email is required');
    });

    test('should handle email sending failure', async () => {
      const mockCaregiver = {
        _id: 'caregiver123',
        email: 'test@example.com',
        isEmailVerified: false,
      };

      caregiverService.getCaregiverByEmail = jest.fn().mockResolvedValue(mockCaregiver);
      tokenService.generateVerifyEmailToken = jest.fn().mockResolvedValue('verify-token-123');
      emailService.sendVerificationEmail = jest.fn().mockRejectedValue(new Error('Email service down'));

      await authController.resendVerificationEmail(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ApiError));
      expect(next.mock.calls[0][0].statusCode).toBe(httpStatus.INTERNAL_SERVER_ERROR);
      expect(next.mock.calls[0][0].message).toContain('Failed to send verification email');
    });
  });

  describe('verifyEmail', () => {
    beforeEach(() => {
      req.query = {
        token: 'verify-token-123',
      };
    });

    test('should verify email with valid token', async () => {
      authService.verifyEmail = jest.fn().mockResolvedValue();

      await authController.verifyEmail(req, res, next);

      expect(authService.verifyEmail).toHaveBeenCalledWith('verify-token-123');
      expect(res.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Email Verified!'));
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Redirecting you to the app'));
    });

    test('should handle verification failure', async () => {
      authService.verifyEmail = jest.fn().mockRejectedValue(new Error('Invalid token'));

      await authController.verifyEmail(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
