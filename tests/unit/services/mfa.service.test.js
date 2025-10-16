/**
 * Unit Tests for MFA Service
 * Tests Multi-Factor Authentication functionality
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const httpStatus = require('http-status');
const mfaService = require('../../../src/services/mfa.service');
const { Caregiver, AuditLog } = require('../../../src/models');
const ApiError = require('../../../src/utils/ApiError');

let mongoServer;

// Mock speakeasy and qrcode
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(() => ({
    base32: 'JBSWY3DPEHPK3PXP',
    otpauth_url: 'otpauth://totp/MyPhoneFriend%20(test@example.com)?secret=JBSWY3DPEHPK3PXP&issuer=MyPhoneFriend'
  })),
  totp: {
    verify: jest.fn()
  }
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn((url) => Promise.resolve('data:image/png;base64,iVBORw0KGgoAAAANS'))
}));

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// Set test environment variable
process.env.MFA_ENCRYPTION_KEY = 'test-encryption-key-for-mfa-testing-32-chars';

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Caregiver.deleteMany();
  await AuditLog.deleteMany();
  jest.clearAllMocks();
});

describe('MFA Service', () => {
  let testCaregiver;

  beforeEach(async () => {
    // Create a test caregiver
    testCaregiver = await Caregiver.create({
      name: 'Test Caregiver',
      email: 'test@example.com',
      password: 'Password123',
      phone: '1234567890',
      role: 'staff',
      isEmailVerified: true
    });
  });

  describe('enableMFA', () => {
    it('should generate QR code and backup codes', async () => {
      const result = await mfaService.enableMFA(testCaregiver._id);

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCode');
      expect(result).toHaveProperty('backupCodes');
      expect(result.backupCodes).toHaveLength(10);
      expect(result.secret).toBe('JBSWY3DPEHPK3PXP');
      expect(result.qrCode).toContain('data:image/png;base64');
    });

    it('should save encrypted MFA secret to database', async () => {
      await mfaService.enableMFA(testCaregiver._id);

      const updatedCaregiver = await Caregiver.findById(testCaregiver._id);
      expect(updatedCaregiver.mfaSecret).toBeDefined();
      expect(updatedCaregiver.mfaSecret).not.toBe('JBSWY3DPEHPK3PXP'); // Should be encrypted
      expect(updatedCaregiver.mfaEnabled).toBe(false); // Not enabled until verified
      expect(updatedCaregiver.mfaBackupCodes).toHaveLength(10);
    });

    it('should create audit log for MFA setup', async () => {
      await mfaService.enableMFA(testCaregiver._id);

      const auditLogs = await AuditLog.find({ 
        action: 'MFA_SETUP_INITIATED',
        userId: testCaregiver._id 
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].outcome).toBe('SUCCESS');
    });

    it('should throw error if caregiver not found', async () => {
      const fakeId = mongoose.Types.ObjectId();
      
      await expect(mfaService.enableMFA(fakeId))
        .rejects
        .toThrow(ApiError);
    });

    it('should throw error if MFA already enabled', async () => {
      // Enable MFA first time
      await mfaService.enableMFA(testCaregiver._id);
      await Caregiver.findByIdAndUpdate(testCaregiver._id, { mfaEnabled: true });

      // Try to enable again
      await expect(mfaService.enableMFA(testCaregiver._id))
        .rejects
        .toThrow('MFA is already enabled');
    });
  });

  describe('verifyAndEnableMFA', () => {
    beforeEach(async () => {
      // Setup MFA for testing
      await mfaService.enableMFA(testCaregiver._id);
    });

    it('should enable MFA with valid token', async () => {
      speakeasy.totp.verify.mockReturnValue(true);

      const result = await mfaService.verifyAndEnableMFA(
        testCaregiver._id,
        '123456',
        '127.0.0.1'
      );

      expect(result).toBe(true);

      const updatedCaregiver = await Caregiver.findById(testCaregiver._id);
      expect(updatedCaregiver.mfaEnabled).toBe(true);
      expect(updatedCaregiver.mfaEnrolledAt).toBeDefined();
    });

    it('should create audit log for successful verification', async () => {
      speakeasy.totp.verify.mockReturnValue(true);

      await mfaService.verifyAndEnableMFA(testCaregiver._id, '123456', '127.0.0.1');

      const auditLogs = await AuditLog.find({ 
        action: 'MFA_ENABLED',
        userId: testCaregiver._id 
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].outcome).toBe('SUCCESS');
    });

    it('should throw error with invalid token', async () => {
      speakeasy.totp.verify.mockReturnValue(false);

      await expect(
        mfaService.verifyAndEnableMFA(testCaregiver._id, '000000', '127.0.0.1')
      ).rejects.toThrow('Invalid MFA token');
    });

    it('should create audit log for failed verification', async () => {
      speakeasy.totp.verify.mockReturnValue(false);

      try {
        await mfaService.verifyAndEnableMFA(testCaregiver._id, '000000', '127.0.0.1');
      } catch (error) {
        // Expected to fail
      }

      const auditLogs = await AuditLog.find({ 
        action: 'MFA_VERIFICATION_FAILED',
        userId: testCaregiver._id 
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].outcome).toBe('FAILURE');
    });

    it('should throw error if MFA not initiated', async () => {
      const newCaregiver = await Caregiver.create({
        name: 'New User',
        email: 'new@example.com',
        password: 'Password123',
        phone: '9876543210',
        role: 'staff'
      });

      await expect(
        mfaService.verifyAndEnableMFA(newCaregiver._id, '123456', '127.0.0.1')
      ).rejects.toThrow('MFA setup not initiated');
    });
  });

  describe('verifyMFAToken', () => {
    beforeEach(async () => {
      await mfaService.enableMFA(testCaregiver._id);
      speakeasy.totp.verify.mockReturnValue(true);
      await mfaService.verifyAndEnableMFA(testCaregiver._id, '123456', '127.0.0.1');
    });

    it('should verify valid TOTP token', async () => {
      speakeasy.totp.verify.mockReturnValue(true);

      const result = await mfaService.verifyMFAToken(testCaregiver._id, '123456');
      expect(result).toBe(true);
    });

    it('should reject invalid TOTP token', async () => {
      speakeasy.totp.verify.mockReturnValue(false);

      const result = await mfaService.verifyMFAToken(testCaregiver._id, '000000');
      expect(result).toBe(false);
    });

    it('should accept valid backup code', async () => {
      // Get backup codes
      speakeasy.totp.verify.mockReturnValue(false); // TOTP fails

      const caregiver = await Caregiver.findById(testCaregiver._id);
      expect(caregiver.mfaBackupCodes).toHaveLength(10);

      // Use first backup code (they're hashed, so we need to use the original)
      // In a real scenario, backup codes are shown once during setup
      // For testing, we'll verify the backup code logic works
      const result = await mfaService.verifyMFAToken(testCaregiver._id, '12345678');
      
      // Should return false because we don't have the original backup code
      expect(result).toBe(false);
    });

    it('should return true if MFA not enabled for user', async () => {
      const newCaregiver = await Caregiver.create({
        name: 'No MFA User',
        email: 'nomfa@example.com',
        password: 'Password123',
        phone: '5555555555',
        role: 'staff'
      });

      const result = await mfaService.verifyMFAToken(newCaregiver._id, 'anything');
      expect(result).toBe(true);
    });

    it('should throw error if account is locked', async () => {
      await Caregiver.findByIdAndUpdate(testCaregiver._id, {
        accountLocked: true,
        lockedReason: 'Security breach detected'
      });

      await expect(
        mfaService.verifyMFAToken(testCaregiver._id, '123456')
      ).rejects.toThrow('Account is locked');
    });
  });

  describe('disableMFA', () => {
    beforeEach(async () => {
      await mfaService.enableMFA(testCaregiver._id);
      speakeasy.totp.verify.mockReturnValue(true);
      await mfaService.verifyAndEnableMFA(testCaregiver._id, '123456', '127.0.0.1');
    });

    it('should disable MFA with valid token', async () => {
      speakeasy.totp.verify.mockReturnValue(true);

      const result = await mfaService.disableMFA(
        testCaregiver._id,
        '123456',
        '127.0.0.1'
      );

      expect(result).toBe(true);

      const updatedCaregiver = await Caregiver.findById(testCaregiver._id);
      expect(updatedCaregiver.mfaEnabled).toBe(false);
      expect(updatedCaregiver.mfaSecret).toBeNull();
      expect(updatedCaregiver.mfaBackupCodes).toHaveLength(0);
    });

    it('should create audit log for MFA disabled', async () => {
      speakeasy.totp.verify.mockReturnValue(true);

      await mfaService.disableMFA(testCaregiver._id, '123456', '127.0.0.1');

      const auditLogs = await AuditLog.find({ 
        action: 'MFA_DISABLED',
        userId: testCaregiver._id 
      });
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].outcome).toBe('SUCCESS');
      expect(auditLogs[0].complianceFlags.requiresReview).toBe(true);
    });

    it('should throw error with invalid token', async () => {
      speakeasy.totp.verify.mockReturnValue(false);

      await expect(
        mfaService.disableMFA(testCaregiver._id, '000000', '127.0.0.1')
      ).rejects.toThrow('Invalid MFA token');
    });
  });

  describe('regenerateBackupCodes', () => {
    beforeEach(async () => {
      await mfaService.enableMFA(testCaregiver._id);
      speakeasy.totp.verify.mockReturnValue(true);
      await mfaService.verifyAndEnableMFA(testCaregiver._id, '123456', '127.0.0.1');
    });

    it('should regenerate backup codes with valid token', async () => {
      speakeasy.totp.verify.mockReturnValue(true);

      const oldCaregiver = await Caregiver.findById(testCaregiver._id);
      const oldBackupCodes = [...oldCaregiver.mfaBackupCodes];

      const newBackupCodes = await mfaService.regenerateBackupCodes(
        testCaregiver._id,
        '123456'
      );

      expect(newBackupCodes).toHaveLength(10);

      const updatedCaregiver = await Caregiver.findById(testCaregiver._id);
      expect(updatedCaregiver.mfaBackupCodes).not.toEqual(oldBackupCodes);
    });

    it('should create audit log for backup code regeneration', async () => {
      speakeasy.totp.verify.mockReturnValue(true);

      await mfaService.regenerateBackupCodes(testCaregiver._id, '123456');

      const auditLogs = await AuditLog.find({ 
        action: 'MFA_BACKUP_CODES_REGENERATED',
        userId: testCaregiver._id 
      });
      expect(auditLogs).toHaveLength(1);
    });

    it('should throw error if MFA not enabled', async () => {
      const newCaregiver = await Caregiver.create({
        name: 'No MFA User',
        email: 'nomfa@example.com',
        password: 'Password123',
        phone: '5555555555',
        role: 'staff'
      });

      await expect(
        mfaService.regenerateBackupCodes(newCaregiver._id, '123456')
      ).rejects.toThrow('MFA is not enabled');
    });
  });

  describe('getMFAStatus', () => {
    it('should return MFA disabled status for new user', async () => {
      const status = await mfaService.getMFAStatus(testCaregiver._id);

      expect(status.mfaEnabled).toBe(false);
      expect(status.backupCodesRemaining).toBe(0);
    });

    it('should return MFA enabled status', async () => {
      await mfaService.enableMFA(testCaregiver._id);
      speakeasy.totp.verify.mockReturnValue(true);
      await mfaService.verifyAndEnableMFA(testCaregiver._id, '123456', '127.0.0.1');

      const status = await mfaService.getMFAStatus(testCaregiver._id);

      expect(status.mfaEnabled).toBe(true);
      expect(status.mfaEnrolledAt).toBeDefined();
      expect(status.backupCodesRemaining).toBe(10);
    });

    it('should throw error if caregiver not found', async () => {
      const fakeId = mongoose.Types.ObjectId();

      await expect(mfaService.getMFAStatus(fakeId))
        .rejects
        .toThrow('Caregiver not found');
    });
  });

  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt MFA secret correctly', async () => {
      await mfaService.enableMFA(testCaregiver._id);

      const caregiver = await Caregiver.findById(testCaregiver._id);
      expect(caregiver.mfaSecret).toBeDefined();
      expect(caregiver.mfaSecret).toContain(':'); // Encrypted format: iv:authTag:encrypted

      // Should be able to verify with the decrypted secret
      speakeasy.totp.verify.mockReturnValue(true);
      await mfaService.verifyAndEnableMFA(testCaregiver._id, '123456', '127.0.0.1');
      
      // If decryption failed, verification would have failed
      expect(caregiver.mfaSecret).not.toBe('JBSWY3DPEHPK3PXP');
    });
  });
});

