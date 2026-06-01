const faker = require('faker');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Patient, Caregiver, Org } = require('../../../src/models');

describe('Caregiver model', () => {
  let mongoServer;
  let testOrg;
  
  beforeAll(async () => {
    // Setup MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {});
    
    // Create a test org for all caregiver tests
    testOrg = await Org.create({
      name: 'Test Org',
      email: 'testorg@example.com',
      country: 'US',
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
  
  describe('Caregiver validation', () => {
    let newCaregiver;
    beforeEach(() => {
      newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        isEmailVerified: false,
        org: testOrg._id,
      };
    });

    test('should correctly validate a valid patient', async () => {
      await expect(new Caregiver(newCaregiver).validate()).resolves.toBeUndefined();
    });

    test('should throw a validation error if email is invalid', async () => {
      newCaregiver.email = 'invalidEmail';
      await expect(new Caregiver(newCaregiver).validate()).rejects.toThrow();
    });

    test('should throw a validation error if phone is invalid', async () => {
      newCaregiver.phone = 'invalidPhone';
      await expect(new Caregiver(newCaregiver).validate()).rejects.toThrow();
    });

    test('should throw a validation error if password length is less than 8 characters', async () => {
      newCaregiver.password = 'passwo1';
      await expect(new Caregiver(newCaregiver).validate()).rejects.toThrow();
    });

    test('should throw a validation error if password does not contain numbers', async () => {
      newCaregiver.password = 'password';
      await expect(new Caregiver(newCaregiver).validate()).rejects.toThrow();
    });

    test('should throw a validation error if password does not contain letters', async () => {
      newCaregiver.password = '11111111';
      await expect(new Caregiver(newCaregiver).validate()).rejects.toThrow();
    });
  });

  describe('Caregiver toJSON()', () => {
    test('should not return caregiver password when toJSON is called', () => {
      const newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        isEmailVerified: false,
        caregiver: null,
        schedules: [],
        org: testOrg._id,
      };
      expect(new Caregiver(newCaregiver).toJSON()).not.toHaveProperty('password');
    });

    test('should not return MFA secret when toJSON is called', () => {
      const newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        mfaSecret: 'encrypted-secret-string',
        mfaBackupCodes: ['code1', 'code2'],
        org: testOrg._id,
      };
      const caregiverJSON = new Caregiver(newCaregiver).toJSON();
      expect(caregiverJSON).not.toHaveProperty('mfaSecret');
      expect(caregiverJSON).not.toHaveProperty('mfaBackupCodes');
    });
  });

  describe('MFA fields', () => {
    test('should have MFA enabled field with default false', () => {
      const newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        org: testOrg._id,
      };
      const caregiver = new Caregiver(newCaregiver);
      expect(caregiver.mfaEnabled).toBe(false);
    });

    test('should store MFA secret', async () => {
      const newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        mfaSecret: 'encrypted-mfa-secret',
        mfaEnabled: true,
        org: testOrg._id,
      };
      await expect(new Caregiver(newCaregiver).validate()).resolves.toBeUndefined();
    });

    test('should store MFA backup codes', async () => {
      const newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        mfaBackupCodes: ['code1', 'code2', 'code3'],
        org: testOrg._id,
      };
      await expect(new Caregiver(newCaregiver).validate()).resolves.toBeUndefined();
    });

    test('should store MFA enrolled date', async () => {
      const enrolledAt = new Date();
      const newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        mfaEnabled: true,
        mfaEnrolledAt: enrolledAt,
        org: testOrg._id,
      };
      const caregiver = new Caregiver(newCaregiver);
      expect(caregiver.mfaEnrolledAt).toEqual(enrolledAt);
    });
  });

  describe('Notification preferences', () => {
    test('should default dailyDigestEmail to false', () => {
      const caregiver = new Caregiver({
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        org: testOrg._id,
      });
      expect(caregiver.notificationPreferences.dailyDigestEmail).toBe(false);
    });

    test('should persist dailyDigestEmail opt-in', async () => {
      const caregiver = await Caregiver.create({
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        org: testOrg._id,
        notificationPreferences: { dailyDigestEmail: true },
      });
      const reloaded = await Caregiver.findById(caregiver._id);
      expect(reloaded.notificationPreferences.dailyDigestEmail).toBe(true);
    });
  });

  describe('Account security fields', () => {
    test('should have account locked field with default false', () => {
      const newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        org: testOrg._id,
      };
      const caregiver = new Caregiver(newCaregiver);
      expect(caregiver.accountLocked).toBe(false);
    });

    test('should store account lock information', async () => {
      const lockedAt = new Date();
      const newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        accountLocked: true,
        lockedReason: 'Security breach detected',
        lockedAt: lockedAt,
        org: testOrg._id,
      };
      const caregiver = new Caregiver(newCaregiver);
      expect(caregiver.accountLocked).toBe(true);
      expect(caregiver.lockedReason).toBe('Security breach detected');
      expect(caregiver.lockedAt).toEqual(lockedAt);
    });

    test('should store failed login attempts', async () => {
      const newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        failedLoginAttempts: 3,
        lastFailedLogin: new Date(),
        org: testOrg._id,
      };
      const caregiver = new Caregiver(newCaregiver);
      expect(caregiver.failedLoginAttempts).toBe(3);
      expect(caregiver.lastFailedLogin).toBeDefined();
    });

    test('should have default 0 failed login attempts', () => {
      const newCaregiver = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        org: testOrg._id,
      };
      const caregiver = new Caregiver(newCaregiver);
      expect(caregiver.failedLoginAttempts).toBe(0);
    });
  });
});
