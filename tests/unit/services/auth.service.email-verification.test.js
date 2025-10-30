const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const httpStatus = require('http-status');
const { Caregiver, Token } = require('../../../src/models');
const { tokenTypes } = require('../../../src/config/tokens');
const authService = require('../../../src/services/auth.service');
const caregiverService = require('../../../src/services/caregiver.service');
const tokenService = require('../../../src/services/token.service');
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

describe('Auth Service - Email Verification', () => {
  afterEach(async () => {
    await Caregiver.deleteMany();
    await Token.deleteMany();
  });

  describe('verifyEmail', () => {
    test('should verify email successfully', async () => {
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
      const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);

      // Verify the email
      await authService.verifyEmail(verifyEmailToken);

      // Check that caregiver is now verified
      const verifiedCaregiver = await Caregiver.findById(caregiver._id);
      expect(verifiedCaregiver.isEmailVerified).toBe(true);

      // Check that token was deleted
      const token = await Token.findOne({ 
        caregiver: caregiver._id, 
        type: tokenTypes.VERIFY_EMAIL 
      });
      expect(token).toBeNull();
    });

    test('should throw error for invalid token', async () => {
      await expect(authService.verifyEmail('invalid-token')).rejects.toThrow(ApiError);
    });

    test('should throw error for non-existent caregiver', async () => {
      // Create a fake token for non-existent caregiver
      const fakeToken = require('jsonwebtoken').sign(
        {
          sub: new mongoose.Types.ObjectId(),
          type: tokenTypes.VERIFY_EMAIL,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        process.env.JWT_SECRET
      );

      await expect(authService.verifyEmail(fakeToken)).rejects.toThrow(ApiError);
    });
  });

  describe('loginCaregiverWithEmailAndPassword', () => {
    test('should login successfully with valid credentials', async () => {
      // Create a caregiver
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isEmailVerified: true,
        role: 'staff',
      });
      await caregiver.save();

      const result = await authService.loginCaregiverWithEmailAndPassword('test@example.com', 'Password123');

      expect(result).toHaveProperty('caregiver');
      expect(result).toHaveProperty('patients');
      expect(result.caregiver.email).toBe('test@example.com');
    });

    test('should throw error for invalid credentials', async () => {
      // Create a caregiver
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isEmailVerified: true,
        role: 'staff',
      });
      await caregiver.save();

      await expect(
        authService.loginCaregiverWithEmailAndPassword('test@example.com', 'WrongPassword')
      ).rejects.toThrow(ApiError);
    });

    test('should throw error for non-existent user', async () => {
      await expect(
        authService.loginCaregiverWithEmailAndPassword('nonexistent@example.com', 'Password123')
      ).rejects.toThrow(ApiError);
    });
  });
});