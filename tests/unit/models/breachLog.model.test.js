/**
 * Unit Tests for BreachLog Model
 * Tests breach tracking and notification management
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { BreachLog, Caregiver } = require('../../../src/models');

let mongoServer;

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
  await BreachLog.deleteMany();
  await Caregiver.deleteMany();
});

describe('BreachLog Model', () => {
  let testCaregiver;

  beforeEach(async () => {
    testCaregiver = await Caregiver.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123',
      phone: '1234567890',
      role: 'staff',
      isEmailVerified: true
    });
  });

  describe('BreachLog validation', () => {
    it('should create a valid breach log', async () => {
      const breach = new BreachLog({
        type: 'excessive_failed_logins',
        severity: 'HIGH',
        status: 'INVESTIGATING',
        userId: testCaregiver._id,
        ipAddress: '192.168.1.100',
        detectedAt: new Date(),
        details: 'Test breach detection'
      });

      await expect(breach.validate()).resolves.toBeUndefined();
      await breach.save();

      const found = await BreachLog.findById(breach._id);
      expect(found).toBeDefined();
      expect(found.type).toBe('excessive_failed_logins');
    });

    it('should require type field', async () => {
      const breach = new BreachLog({
        severity: 'HIGH',
        status: 'INVESTIGATING',
        details: 'Test breach'
      });

      await expect(breach.validate()).rejects.toThrow();
    });

    it('should require severity field', async () => {
      const breach = new BreachLog({
        type: 'excessive_failed_logins',
        status: 'INVESTIGATING',
        details: 'Test breach'
      });

      await expect(breach.validate()).rejects.toThrow();
    });

    it('should validate type enum', async () => {
      const breach = new BreachLog({
        type: 'invalid_type',
        severity: 'HIGH',
        status: 'INVESTIGATING',
        details: 'Test breach'
      });

      await expect(breach.validate()).rejects.toThrow();
    });

    it('should validate severity enum', async () => {
      const breach = new BreachLog({
        type: 'excessive_failed_logins',
        severity: 'INVALID',
        status: 'INVESTIGATING',
        details: 'Test breach'
      });

      await expect(breach.validate()).rejects.toThrow();
    });

    it('should validate status enum', async () => {
      const breach = new BreachLog({
        type: 'excessive_failed_logins',
        severity: 'HIGH',
        status: 'INVALID_STATUS',
        details: 'Test breach'
      });

      await expect(breach.validate()).rejects.toThrow();
    });

    it('should set default status to INVESTIGATING', async () => {
      const breach = new BreachLog({
        type: 'excessive_failed_logins',
        severity: 'HIGH',
        details: 'Test breach'
      });

      await breach.save();
      expect(breach.status).toBe('INVESTIGATING');
    });

    it('should set default detectedAt to current time', async () => {
      const before = Date.now();
      const breach = new BreachLog({
        type: 'excessive_failed_logins',
        severity: 'HIGH',
        status: 'INVESTIGATING',
        details: 'Test breach'
      });

      await breach.save();
      const after = Date.now();

      expect(breach.detectedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(breach.detectedAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('Breach types', () => {
    it('should accept all valid breach types', async () => {
      const types = [
        'excessive_failed_logins',
        'unusual_data_access_volume',
        'off_hours_access',
        'unauthorized_export_attempt',
        'suspicious_ip_address',
        'brute_force_attempt',
        'privilege_escalation_attempt',
        'data_exfiltration_attempt',
        'unauthorized_access',
        'other'
      ];

      for (const type of types) {
        const breach = new BreachLog({
          type,
          severity: 'HIGH',
          status: 'INVESTIGATING',
          details: `Test ${type}`
        });

        await expect(breach.validate()).resolves.toBeUndefined();
      }
    });
  });

  describe('Severity levels', () => {
    it('should accept all valid severity levels', async () => {
      const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

      for (const severity of severities) {
        const breach = new BreachLog({
          type: 'excessive_failed_logins',
          severity,
          status: 'INVESTIGATING',
          details: `Test ${severity} severity`
        });

        await expect(breach.validate()).resolves.toBeUndefined();
      }
    });
  });

  describe('Status transitions', () => {
    it('should accept all valid status values', async () => {
      const statuses = ['INVESTIGATING', 'CONFIRMED', 'FALSE_POSITIVE', 'MITIGATED', 'RESOLVED'];

      for (const status of statuses) {
        const breach = new BreachLog({
          type: 'excessive_failed_logins',
          severity: 'HIGH',
          status,
          details: `Test ${status} status`
        });

        await expect(breach.validate()).resolves.toBeUndefined();
      }
    });
  });

  describe('HIPAA notification fields', () => {
    it('should store notification deadline', async () => {
      const deadline = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
      const breach = await BreachLog.create({
        type: 'data_exfiltration_attempt',
        severity: 'CRITICAL',
        status: 'CONFIRMED',
        details: 'Large-scale data breach',
        affectedCount: 500,
        requiresHHSNotification: true,
        notificationDeadline: deadline
      });

      expect(breach.notificationDeadline).toEqual(deadline);
      expect(breach.requiresHHSNotification).toBe(true);
    });

    it('should default requiresHHSNotification to false', async () => {
      const breach = await BreachLog.create({
        type: 'excessive_failed_logins',
        severity: 'HIGH',
        details: 'Test breach'
      });

      expect(breach.requiresHHSNotification).toBe(false);
      expect(breach.requiresMediaNotification).toBe(false);
    });

    it('should track notification status', async () => {
      const breach = await BreachLog.create({
        type: 'data_exfiltration_attempt',
        severity: 'CRITICAL',
        details: 'Test breach',
        affectedCount: 600,
        requiresHHSNotification: true,
        individualsNotified: true,
        individualsNotifiedAt: new Date(),
        hhsNotified: true,
        hhsNotifiedAt: new Date()
      });

      expect(breach.individualsNotified).toBe(true);
      expect(breach.hhsNotified).toBe(true);
      expect(breach.individualsNotifiedAt).toBeDefined();
      expect(breach.hhsNotifiedAt).toBeDefined();
    });
  });

  describe('Mitigation tracking', () => {
    it('should store mitigation steps', async () => {
      const breach = await BreachLog.create({
        type: 'unauthorized_access',
        severity: 'CRITICAL',
        details: 'Security breach detected',
        mitigationSteps: [
          {
            action: 'Locked affected accounts',
            takenAt: new Date(),
            takenBy: testCaregiver._id,
            result: 'Successfully locked 5 accounts'
          },
          {
            action: 'Reset passwords',
            takenAt: new Date(),
            result: 'Password reset emails sent'
          }
        ]
      });

      expect(breach.mitigationSteps).toHaveLength(2);
      expect(breach.mitigationSteps[0].action).toBe('Locked affected accounts');
    });

    it('should track resolution', async () => {
      const resolvedAt = new Date();
      const breach = await BreachLog.create({
        type: 'excessive_failed_logins',
        severity: 'HIGH',
        status: 'RESOLVED',
        details: 'Test breach',
        resolvedAt,
        resolvedBy: testCaregiver._id,
        resolutionNotes: 'False alarm - automated testing'
      });

      expect(breach.resolvedAt).toEqual(resolvedAt);
      expect(breach.resolvedBy.toString()).toBe(testCaregiver._id.toString());
      expect(breach.resolutionNotes).toBe('False alarm - automated testing');
    });
  });

  describe('Static methods', () => {
    describe('getNotificationRequired', () => {
      it('should return breaches requiring notification', async () => {
        // Create breach requiring notification
        await BreachLog.create({
          type: 'data_exfiltration_attempt',
          severity: 'CRITICAL',
          status: 'CONFIRMED',
          details: 'Data breach',
          affectedCount: 500,
          requiresHHSNotification: true,
          hhsNotified: false
        });

        // Create breach already notified
        await BreachLog.create({
          type: 'data_exfiltration_attempt',
          severity: 'CRITICAL',
          status: 'CONFIRMED',
          details: 'Data breach 2',
          affectedCount: 500,
          requiresHHSNotification: true,
          hhsNotified: true
        });

        const breaches = await BreachLog.getNotificationRequired();
        expect(breaches.length).toBeGreaterThan(0);
        expect(breaches[0].hhsNotified).toBe(false);
      });
    });

    describe('getRecentBreaches', () => {
      it('should return breaches from last N days', async () => {
        // Recent breach
        await BreachLog.create({
          type: 'excessive_failed_logins',
          severity: 'HIGH',
          details: 'Recent breach',
          detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
        });

        // Old breach
        await BreachLog.create({
          type: 'excessive_failed_logins',
          severity: 'HIGH',
          details: 'Old breach',
          detectedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) // 40 days ago
        });

        const breaches = await BreachLog.getRecentBreaches(30);
        expect(breaches.length).toBe(1);
        expect(breaches[0].details).toBe('Recent breach');
      });
    });

    describe('getStatistics', () => {
      beforeEach(async () => {
        await BreachLog.create({
          type: 'excessive_failed_logins',
          severity: 'CRITICAL',
          status: 'INVESTIGATING',
          details: 'Breach 1'
        });

        await BreachLog.create({
          type: 'data_exfiltration_attempt',
          severity: 'HIGH',
          status: 'CONFIRMED',
          details: 'Breach 2'
        });

        await BreachLog.create({
          type: 'off_hours_access',
          severity: 'MEDIUM',
          status: 'FALSE_POSITIVE',
          details: 'Breach 3'
        });

        await BreachLog.create({
          type: 'unauthorized_access',
          severity: 'LOW',
          status: 'RESOLVED',
          details: 'Breach 4'
        });
      });

      it('should return statistics for all breaches', async () => {
        const stats = await BreachLog.getStatistics();

        expect(stats.total).toBe(4);
        expect(stats.critical).toBe(1);
        expect(stats.high).toBe(1);
        expect(stats.medium).toBe(1);
        expect(stats.low).toBe(1);
        expect(stats.investigating).toBe(1);
        expect(stats.confirmed).toBe(1);
        expect(stats.resolved).toBe(1);
        expect(stats.falsePositives).toBe(1);
      });

      it('should filter statistics by date range', async () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const stats = await BreachLog.getStatistics(yesterday, tomorrow);

        expect(stats.total).toBe(4);
      });
    });
  });

  describe('Indexes', () => {
    it('should have indexes on key fields', async () => {
      const indexes = await BreachLog.collection.getIndexes();

      expect(indexes).toBeDefined();
      // Check that indexes exist (exact structure may vary)
      expect(Object.keys(indexes).length).toBeGreaterThan(1); // More than just _id
    });
  });

  describe('Evidence storage', () => {
    it('should store evidence as JSON string', async () => {
      const timestamp1 = new Date();
      const timestamp2 = new Date();
      const evidence = {
        attempts: [
          { timestamp: timestamp1.toISOString(), ip: '192.168.1.100' },
          { timestamp: timestamp2.toISOString(), ip: '192.168.1.101' }
        ],
        count: 2
      };

      const breach = await BreachLog.create({
        type: 'excessive_failed_logins',
        severity: 'HIGH',
        details: 'Test breach',
        evidence: JSON.stringify(evidence)
      });

      expect(typeof breach.evidence).toBe('string');
      expect(JSON.parse(breach.evidence)).toEqual(evidence);
    });
  });

  describe('Affected resources tracking', () => {
    it('should track affected resources', async () => {
      const breach = await BreachLog.create({
        type: 'data_exfiltration_attempt',
        severity: 'CRITICAL',
        details: 'Data breach',
        affectedResourceType: 'patient',
        affectedResourceIds: ['patient-1', 'patient-2', 'patient-3'],
        affectedCount: 3
      });

      expect(breach.affectedResourceType).toBe('patient');
      expect(breach.affectedResourceIds).toHaveLength(3);
      expect(breach.affectedCount).toBe(3);
    });
  });
});

