const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const httpStatus = require('http-status');
const { Caregiver } = require('../../../src/models');
const smsVerificationService = require('../../../src/services/smsVerification.service');
const { snsService } = require('../../../src/services/sns.service');
const ApiError = require('../../../src/utils/ApiError');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('SMS Verification Service', () => {
  beforeEach(async () => {
    await Caregiver.deleteMany();
    // Mock SNS service methods
    if (snsService.sendToPhone) {
      jest.spyOn(snsService, 'sendToPhone').mockResolvedValue({
        MessageId: 'test-message-id-123'
      });
    }
    if (snsService.formatPhoneNumber) {
      jest.spyOn(snsService, 'formatPhoneNumber').mockImplementation((phone) => {
        if (!phone) return null;
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) {
          return `+1${digits}`;
        }
        return phone.startsWith('+') ? phone : `+${phone}`;
      });
    }
    if (snsService.isValidPhoneNumber) {
      jest.spyOn(snsService, 'isValidPhoneNumber').mockReturnValue(true);
    }
    // Mock isInitialized getter
    Object.defineProperty(snsService, 'isInitialized', {
      get: jest.fn(() => true),
      configurable: true
    });
  });

  afterEach(async () => {
    await Caregiver.deleteMany();
    jest.clearAllMocks();
  });

  describe('generateVerificationCode', () => {
    test('should generate a 6-digit code', () => {
      const code = smsVerificationService.generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(parseInt(code)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(code)).toBeLessThanOrEqual(999999);
    });

    test('should generate unique codes', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(smsVerificationService.generateVerificationCode());
      }
      // Should have high uniqueness (at least 95 unique codes out of 100)
      expect(codes.size).toBeGreaterThan(95);
    });
  });

  describe('maskPhoneNumber', () => {
    test('should mask phone number correctly', () => {
      const masked = smsVerificationService.maskPhoneNumber('+1234567890');
      expect(masked).toContain('***');
      // Format should be like "+1 (234) ***-7890" or similar
      expect(masked).toMatch(/\d{3}.*\*\*\*.*\d{4}/);
      expect(masked).not.toContain('234567');
    });

    test('should handle 10-digit numbers', () => {
      const masked = smsVerificationService.maskPhoneNumber('2345678901');
      expect(masked).toContain('***');
    });
  });

  describe('sendVerificationCode', () => {
    test('should send verification code successfully', async () => {
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263', // Valid phone format
        isPhoneVerified: false,
        role: 'staff',
      });
      await caregiver.save();

      const result = await smsVerificationService.sendVerificationCode(null, caregiver._id.toString());

      expect(result).toHaveProperty('messageId');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('phoneNumber');
      expect(result.phoneNumber).toContain('***'); // Masked

      // Verify code was stored in database
      const caregiverWithCode = await Caregiver.findById(caregiver._id)
        .select('+phoneVerificationCode +phoneVerificationCodeExpires +phoneVerificationAttempts');
      expect(caregiverWithCode.phoneVerificationCode).toMatch(/^\d{6}$/);
      expect(caregiverWithCode.phoneVerificationCodeExpires).toBeInstanceOf(Date);
      expect(caregiverWithCode.phoneVerificationAttempts).toBe(1);

      // Verify SNS was called
      expect(snsService.sendToPhone).toHaveBeenCalled();
    });

    test('should throw error if caregiver not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await expect(
        smsVerificationService.sendVerificationCode('+1234567890', fakeId.toString())
      ).rejects.toThrow(ApiError);
    });

    test('should throw error if phone already verified', async () => {
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isPhoneVerified: true,
        role: 'staff',
      });
      await caregiver.save();

      await expect(
        smsVerificationService.sendVerificationCode(null, caregiver._id.toString())
      ).rejects.toThrow(ApiError);
    });

    test('should enforce rate limiting', async () => {
      // Rate limiting: attempts >= 3 AND expires > oneHourAgo (meaning expires is in the future, within the hour)
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isPhoneVerified: false,
        phoneVerificationAttempts: 3,
        phoneVerificationCodeExpires: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        role: 'staff',
      });
      await caregiver.save();

      // Should be rate limited (3 attempts and expires in future)
      await expect(
        smsVerificationService.sendVerificationCode(null, caregiver._id.toString())
      ).rejects.toThrow(ApiError);
    });

    test('should allow sending after rate limit expires', async () => {
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isPhoneVerified: false,
        phoneVerificationAttempts: 3,
        phoneVerificationCodeExpires: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        role: 'staff',
      });
      await caregiver.save();

      const result = await smsVerificationService.sendVerificationCode(null, caregiver._id.toString());
      expect(result).toHaveProperty('messageId');
      expect(snsService.sendToPhone).toHaveBeenCalled();
    });

    test('should throw error if SNS service not initialized', async () => {
      Object.defineProperty(snsService, 'isInitialized', {
        get: jest.fn(() => false),
        configurable: true
      });
      
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isPhoneVerified: false,
        role: 'staff',
      });
      await caregiver.save();

      await expect(
        smsVerificationService.sendVerificationCode(null, caregiver._id.toString())
      ).rejects.toThrow(ApiError);
    });
  });

  describe('verifyCode', () => {
    test('should verify code successfully', async () => {
      const code = '123456';
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isPhoneVerified: false,
        phoneVerificationCode: code,
        phoneVerificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        role: 'staff',
      });
      await caregiver.save();

      const result = await smsVerificationService.verifyCode(caregiver._id.toString(), code);

      expect(result).toBe(true);

      // Verify caregiver is now verified
      // Need to select hidden fields
      const verifiedCaregiver = await Caregiver.findById(caregiver._id)
        .select('+phoneVerificationCode +phoneVerificationCodeExpires +phoneVerificationAttempts +phoneVerifiedAt');
      expect(verifiedCaregiver.isPhoneVerified).toBe(true);
      expect(verifiedCaregiver.phoneVerificationCode).toBeUndefined();
      expect(verifiedCaregiver.phoneVerificationCodeExpires).toBeUndefined();
      expect(verifiedCaregiver.phoneVerificationAttempts).toBe(0);
      expect(verifiedCaregiver.phoneVerifiedAt).toBeInstanceOf(Date);
    });

    test('should return true if already verified', async () => {
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isPhoneVerified: true,
        role: 'staff',
      });
      await caregiver.save();

      const result = await smsVerificationService.verifyCode(caregiver._id.toString(), '123456');
      expect(result).toBe(true);
    });

    test('should throw error for invalid code', async () => {
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isPhoneVerified: false,
        phoneVerificationCode: '123456',
        phoneVerificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000),
        role: 'staff',
      });
      await caregiver.save();

      await expect(
        smsVerificationService.verifyCode(caregiver._id.toString(), '000000')
      ).rejects.toThrow(ApiError);

      // Verify attempts incremented
      const caregiverAfterAttempt = await Caregiver.findById(caregiver._id)
        .select('+phoneVerificationAttempts');
      expect(caregiverAfterAttempt.phoneVerificationAttempts).toBe(1);
    });

    test('should throw error for expired code', async () => {
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isPhoneVerified: false,
        phoneVerificationCode: '123456',
        phoneVerificationCodeExpires: new Date(Date.now() - 1000), // Expired
        role: 'staff',
      });
      await caregiver.save();

      await expect(
        smsVerificationService.verifyCode(caregiver._id.toString(), '123456')
      ).rejects.toThrow(ApiError);

      // Verify code was cleared
      const caregiverAfterAttempt = await Caregiver.findById(caregiver._id)
        .select('+phoneVerificationCode');
      expect(caregiverAfterAttempt.phoneVerificationCode).toBeUndefined();
    });

    test('should throw error if no code exists', async () => {
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isPhoneVerified: false,
        role: 'staff',
      });
      await caregiver.save();

      await expect(
        smsVerificationService.verifyCode(caregiver._id.toString(), '123456')
      ).rejects.toThrow(ApiError);
    });
  });

  describe('resendVerificationCode', () => {
    test('should resend verification code', async () => {
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isPhoneVerified: false,
        role: 'staff',
      });
      await caregiver.save();

      const result = await smsVerificationService.resendVerificationCode(caregiver._id.toString());

      expect(result).toHaveProperty('messageId');
      expect(snsService.sendToPhone).toHaveBeenCalled();
    });

    test('should throw error if phone already verified', async () => {
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
        isPhoneVerified: true,
        role: 'staff',
      });
      await caregiver.save();

      await expect(
        smsVerificationService.resendVerificationCode(caregiver._id.toString())
      ).rejects.toThrow(ApiError);
    });

    test('should throw error if phone not set', async () => {
      // Create caregiver without phone (role unverified doesn't require phone)
      const caregiver = new Caregiver({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        isPhoneVerified: false,
        role: 'unverified', // unverified role doesn't require phone
      });
      await caregiver.save();

      await expect(
        smsVerificationService.resendVerificationCode(caregiver._id.toString())
      ).rejects.toThrow(ApiError);
    });
  });

  describe('isVerificationRequired', () => {
    test('should return true for staff role', () => {
      expect(smsVerificationService.isVerificationRequired('staff')).toBe(true);
    });

    test('should return true for admin role', () => {
      expect(smsVerificationService.isVerificationRequired('admin')).toBe(true);
    });

    test('should return false for unverified role', () => {
      expect(smsVerificationService.isVerificationRequired('unverified')).toBe(false);
    });

    test('should return false for invited role', () => {
      expect(smsVerificationService.isVerificationRequired('invited')).toBe(false);
    });
  });
});

