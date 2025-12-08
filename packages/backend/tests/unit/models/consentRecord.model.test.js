const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { ConsentRecord } = require('../../../src/models');

describe('ConsentRecord Model', () => {
  let mongoServer;
  let caregiverId;
  let patientId;

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri, {});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await ConsentRecord.deleteMany({});
    caregiverId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();
  });

  describe('Schema Validation', () => {
    it('should create a valid consent record with explicit consent', async () => {
      const consent = await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        method: 'explicit',
        explicitConsent: {
          provided: true,
          providedAt: new Date(),
          providedVia: 'checkbox',
          consentText: 'I consent to data collection',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        },
        informationTypes: ['name', 'email', 'phone'],
        collectionNoticeProvided: true,
        collectionNoticeVersion: '1.0',
      });

      expect(consent).toBeDefined();
      expect(consent.consentType).toBe('collection');
      expect(consent.granted).toBe(true);
      expect(consent.method).toBe('explicit');
      expect(consent.explicitConsent.provided).toBe(true);
    });

    it('should create a valid consent record with implied consent', async () => {
      const consent = await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'use',
        purpose: 'Service delivery',
        granted: true,
        method: 'implied',
        impliedConsent: {
          basis: 'Necessary for service provision',
          documented: true,
        },
      });

      expect(consent).toBeDefined();
      expect(consent.method).toBe('implied');
      expect(consent.impliedConsent.documented).toBe(true);
    });

    it('should reject invalid consentType', async () => {
      await expect(
        ConsentRecord.create({
          userType: 'caregiver',
          userId: caregiverId,
          userModel: 'Caregiver',
          consentType: 'invalid',
          purpose: 'Test',
          granted: true,
        })
      ).rejects.toThrow();
    });

    it('should reject invalid method', async () => {
      await expect(
        ConsentRecord.create({
          userType: 'caregiver',
          userId: caregiverId,
          userModel: 'Caregiver',
          consentType: 'collection',
          purpose: 'Test',
          granted: true,
          method: 'invalid',
        })
      ).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    it('should get active consent for a user', async () => {
      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        withdrawn: false,
      });

      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'Wellness calls',
        granted: true,
        withdrawn: false,
      });

      const activeConsent = await ConsentRecord.getActiveConsent(caregiverId, 'Caregiver');
      expect(activeConsent.length).toBe(2);
    });

    it('should filter by consentType when provided', async () => {
      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        withdrawn: false,
      });

      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'Wellness calls',
        granted: true,
        withdrawn: false,
      });

      const collectionConsent = await ConsentRecord.getActiveConsent(caregiverId, 'Caregiver', 'collection');
      expect(collectionConsent.length).toBe(1);
      expect(collectionConsent[0].consentType).toBe('collection');
    });

    it('should exclude withdrawn consent', async () => {
      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        withdrawn: false,
      });

      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'Wellness calls',
        granted: true,
        withdrawn: true,
        withdrawnAt: new Date(),
      });

      const activeConsent = await ConsentRecord.getActiveConsent(caregiverId, 'Caregiver');
      expect(activeConsent.length).toBe(1);
      expect(activeConsent[0].consentType).toBe('collection');
    });

    it('should exclude expired consent', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        withdrawn: false,
        expiresAt: expiredDate,
      });

      const activeConsent = await ConsentRecord.getActiveConsent(caregiverId, 'Caregiver');
      expect(activeConsent.length).toBe(0);
    });

    it('should check if user has consent', async () => {
      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'wellness_calls',
        granted: true,
        withdrawn: false,
      });

      const hasConsent = await ConsentRecord.hasConsent(
        caregiverId,
        'Caregiver',
        'recording',
        'wellness_calls'
      );

      expect(hasConsent).toBe(true);
    });

    it('should return false if consent does not exist', async () => {
      const hasConsent = await ConsentRecord.hasConsent(
        caregiverId,
        'Caregiver',
        'recording',
        'wellness_calls'
      );

      expect(hasConsent).toBe(false);
    });

    it('should get consent history', async () => {
      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        createdAt: new Date('2025-01-01'),
      });

      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'Wellness calls',
        granted: true,
        createdAt: new Date('2025-01-02'),
      });

      const history = await ConsentRecord.getConsentHistory(caregiverId, 'Caregiver');
      expect(history.length).toBe(2);
      // Should be sorted by createdAt descending (newest first)
      expect(new Date(history[0].createdAt).getTime()).toBeGreaterThan(
        new Date(history[1].createdAt).getTime()
      );
    });

    it('should get expired consents', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);

      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        withdrawn: false,
        expiresAt: expiredDate,
      });

      const expired = await ConsentRecord.getExpiredConsents();
      expect(expired.length).toBe(1);
    });

    it('should calculate statistics', async () => {
      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        method: 'explicit',
      });

      await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'recording',
        purpose: 'Wellness calls',
        granted: true,
        method: 'implied',
        withdrawn: true,
        withdrawnAt: new Date(),
      });

      const stats = await ConsentRecord.getStatistics();
      expect(stats.total).toBe(2);
      expect(stats.granted).toBe(2);
      expect(stats.withdrawn).toBe(1);
      expect(stats.explicit).toBe(1);
      expect(stats.implied).toBe(1);
    });
  });

  describe('Instance Methods', () => {
    it('should withdraw consent', async () => {
      const consent = await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        withdrawn: false,
      });

      await consent.withdraw(
        'app',
        'No longer want service',
        {
          impactDescription: 'Service will be limited',
          serviceImpact: 'service_limited',
        }
      );

      expect(consent.withdrawn).toBe(true);
      expect(consent.granted).toBe(false);
      expect(consent.withdrawnAt).toBeDefined();
      expect(consent.withdrawalMethod).toBe('app');
      expect(consent.withdrawalReason).toBe('No longer want service');
      expect(consent.withdrawalImpact.explained).toBe(true);
    });
  });

  describe('Expiration', () => {
    it('should handle consent with expiration date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const consent = await ConsentRecord.create({
        userType: 'caregiver',
        userId: caregiverId,
        userModel: 'Caregiver',
        consentType: 'collection',
        purpose: 'Account creation',
        granted: true,
        expiresAt: futureDate,
      });

      expect(consent.expiresAt).toBeDefined();
      
      // Should be included in active consent (not expired yet)
      const activeConsent = await ConsentRecord.getActiveConsent(caregiverId, 'Caregiver');
      expect(activeConsent.length).toBe(1);
    });
  });
});



