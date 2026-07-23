/**
 * Unit Tests for Breach Detection Service
 * Tests security breach detection and response
 */

const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { MongoMemoryServer } = require('mongodb-memory-server');
const breachDetectionService = require('../../../src/services/breachDetection.service');
const { AuditLog, BreachLog, Caregiver, Org } = require('../../../src/models');

let mongoServer;

// Mock AWS SNS
jest.mock('@aws-sdk/client-sns');

beforeAll(async () => {
  jest.setTimeout(60000);
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, { 
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await AuditLog.deleteMany();
  await BreachLog.deleteMany();
  await Caregiver.deleteMany();
  await Org.deleteMany();
  jest.clearAllMocks();
});

describe('Breach Detection Service', () => {
  let testCaregiver;
  let testOrg;

  beforeEach(async () => {
    // Create org first (required for caregiver)
    testOrg = await Org.create({
      name: 'Test Org',
      email: 'testorg@example.com',
      country: 'US',
    });
    
    testCaregiver = await Caregiver.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password123',
      phone: '1234567890',
      role: 'staff',
      isEmailVerified: true,
      org: testOrg._id,
    });
  });

  describe('detectFailedLogins', () => {
    it('should detect excessive failed login attempts', async () => {
      // Create 6 failed login attempts in the last 5 minutes
      const now = new Date();
      for (let i = 0; i < 6; i++) {
        await AuditLog.create({
          timestamp: new Date(now.getTime() - i * 30000), // Spread over 3 minutes
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'LOGIN_FAILED',
          resource: 'session',
          resourceId: testCaregiver._id.toString(),
          outcome: 'FAILURE',
          ipAddress: '192.168.1.100',
          userAgent: 'Test Browser'
        });
      }

      const result = await breachDetectionService.detectFailedLogins();

      expect(result).toBeGreaterThan(0);

      const breaches = await BreachLog.find({ type: 'excessive_failed_logins' });
      expect(breaches.length).toBeGreaterThan(0);
      expect(breaches[0].severity).toBe('HIGH');
      expect(breaches[0].userId.toString()).toBe(testCaregiver._id.toString());
    }, 60000);

    it('should lock account after excessive failed logins', async () => {
      const now = new Date();
      for (let i = 0; i < 6; i++) {
        await AuditLog.create({
          timestamp: new Date(now.getTime() - i * 30000),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'LOGIN_FAILED',
          resource: 'session',
          resourceId: testCaregiver._id.toString(),
          outcome: 'FAILURE',
          ipAddress: '192.168.1.100',
          userAgent: 'Test Browser'
        });
      }

      await breachDetectionService.detectFailedLogins();

      const updatedCaregiver = await Caregiver.findById(testCaregiver._id);
      expect(updatedCaregiver.accountLocked).toBe(true);
      expect(updatedCaregiver.lockedReason).toContain('excessive_failed_logins');
    }, 60000);

    it('should not detect if failed logins below threshold', async () => {
      // Only 3 failed logins (threshold is 5)
      for (let i = 0; i < 3; i++) {
        await AuditLog.create({
          timestamp: new Date(),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'LOGIN_FAILED',
          resource: 'session',
          resourceId: testCaregiver._id.toString(),
          outcome: 'FAILURE',
          ipAddress: '192.168.1.100',
          userAgent: 'Test Browser'
        });
      }

      const result = await breachDetectionService.detectFailedLogins();

      expect(result).toBe(0);
    });

    it('should not detect old failed logins', async () => {
      // Failed logins from 10 minutes ago (window is 5 minutes)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      for (let i = 0; i < 6; i++) {
        await AuditLog.create({
          timestamp: tenMinutesAgo,
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'LOGIN_FAILED',
          resource: 'session',
          resourceId: testCaregiver._id.toString(),
          outcome: 'FAILURE',
          ipAddress: '192.168.1.100',
          userAgent: 'Test Browser'
        });
      }

      const result = await breachDetectionService.detectFailedLogins();

      expect(result).toBe(0);
    });
  });

  describe('detectDataAccessVolume', () => {
    it('should detect unusual data access volume', async () => {
      // Create 101 patient record accesses in the last hour
      const now = new Date();
      for (let i = 0; i < 101; i++) {
        await AuditLog.create({
          timestamp: new Date(now.getTime() - i * 30000),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'client',
          resourceId: `patient-${i}`,
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.100',
          userAgent: 'Test Browser',
          complianceFlags: {
            phiAccessed: true
          }
        });
      }

      const result = await breachDetectionService.detectDataAccessVolume();

      expect(result).toBeGreaterThan(0);

      const breaches = await BreachLog.find({ type: 'unusual_data_access_volume' });
      expect(breaches.length).toBeGreaterThan(0);
      expect(breaches[0].severity).toBe('CRITICAL');
      expect(breaches[0].affectedCount).toBeGreaterThan(100);
    }, 60000);

    it('should lock account for unusual data access across many unique resources', async () => {
      const now = new Date();
      for (let i = 0; i < 101; i++) {
        await AuditLog.create({
          timestamp: new Date(now.getTime() - i * 30000),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'client',
          resourceId: `patient-${i}`,
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.100'
        });
      }

      await breachDetectionService.detectDataAccessVolume();

      const updatedCaregiver = await Caregiver.findById(testCaregiver._id);
      expect(updatedCaregiver.accountLocked).toBe(true);
    });

    it('should not auto-lock unusual volume when unique resources are low', async () => {
      const now = new Date();
      // 101 READs but only a handful of distinct patients (admin refresh / list churn)
      for (let i = 0; i < 101; i++) {
        await AuditLog.create({
          timestamp: new Date(now.getTime() - i * 30000),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'client',
          resourceId: `patient-${i % 5}`,
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.100'
        });
      }

      const result = await breachDetectionService.detectDataAccessVolume();
      expect(result).toBeGreaterThan(0);

      const updatedCaregiver = await Caregiver.findById(testCaregiver._id);
      expect(updatedCaregiver.accountLocked).toBe(false);
    });

    it('should not detect normal data access volume', async () => {
      // Only 50 accesses (threshold is 100)
      for (let i = 0; i < 50; i++) {
        await AuditLog.create({
          timestamp: new Date(),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'client',
          resourceId: `patient-${i}`,
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.100'
        });
      }

      const result = await breachDetectionService.detectDataAccessVolume();

      expect(result).toBe(0);
    });
  });

  describe('detectRapidDataAccess', () => {
    it('should detect rapid data access (potential exfiltration)', async () => {
      // Create 51 accesses in the last minute (above count threshold)
      const now = new Date();
      for (let i = 0; i < 51; i++) {
        await AuditLog.create({
          timestamp: new Date(now.getTime() - i * 1000), // 1 second apart
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'client',
          resourceId: `patient-${i % 5}`, // few unique IDs — alert only, no auto-lock
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.100'
        });
      }

      const result = await breachDetectionService.detectRapidDataAccess();

      expect(result).toBeGreaterThan(0);

      const breaches = await BreachLog.find({ type: 'data_exfiltration_attempt' });
      expect(breaches.length).toBeGreaterThan(0);
      expect(breaches[0].severity).toBe('CRITICAL');

      const updatedCaregiver = await Caregiver.findById(testCaregiver._id);
      expect(updatedCaregiver.accountLocked).toBe(false);
    }, 60000);

    it('should lock account for rapid data access across many unique resources', async () => {
      const now = new Date();
      for (let i = 0; i < 51; i++) {
        await AuditLog.create({
          timestamp: new Date(now.getTime() - i * 1000),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'conversation',
          resourceId: `conv-${i}`,
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.100'
        });
      }

      await breachDetectionService.detectRapidDataAccess();

      const updatedCaregiver = await Caregiver.findById(testCaregiver._id);
      expect(updatedCaregiver.accountLocked).toBe(true);
      expect(updatedCaregiver.lockedReason).toContain('data_exfiltration_attempt');
    }, 60000);
  });

  describe('detectOffHoursAccess', () => {
    const mockNow = (isoString) => {
      const mockTimestamp = new Date(isoString).getTime();
      const OriginalDate = global.Date;
      const MockDate = function (...args) {
        if (args.length === 0) {
          return new OriginalDate(mockTimestamp);
        }
        return new OriginalDate(...args);
      };
      MockDate.now = () => mockTimestamp;
      MockDate.UTC = OriginalDate.UTC.bind(OriginalDate);
      MockDate.parse = OriginalDate.parse.bind(OriginalDate);
      MockDate.prototype = OriginalDate.prototype;
      Object.setPrototypeOf(MockDate, OriginalDate);
      global.Date = MockDate;
      return () => {
        global.Date = OriginalDate;
      };
    };

    it('should detect off-hours PHI access using org timezone', async () => {
      await Org.findByIdAndUpdate(testOrg._id, { timezone: 'America/Los_Angeles' });
      const restoreDate = mockNow('2026-06-02T09:05:00.000Z'); // 2:05 AM PDT

      try {
        await AuditLog.create({
          timestamp: new Date('2026-06-02T09:02:00.000Z'), // 2:02 AM PDT
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'client',
          resourceId: 'client-123',
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.100',
          complianceFlags: {
            phiAccessed: true
          }
        });

        const result = await breachDetectionService.detectOffHoursAccess();
        expect(result).toBe(1);

        const breaches = await BreachLog.find({ type: 'off_hours_access' });
        expect(breaches).toHaveLength(1);
        expect(breaches[0].details).toContain('Test Org');
        expect(breaches[0].details).toContain('02:02');
      } finally {
        restoreDate();
      }
    });

    it('should not detect access during org business hours even when server time is UTC off-hours', async () => {
      await Org.findByIdAndUpdate(testOrg._id, { timezone: 'America/Los_Angeles' });
      const restoreDate = mockNow('2026-06-01T22:55:00.000Z'); // 3:55 PM PDT

      try {
        await AuditLog.create({
          timestamp: new Date('2026-06-01T22:50:00.000Z'), // 3:50 PM PDT
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'client',
          resourceId: 'patient-123',
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.100',
          complianceFlags: {
            phiAccessed: true
          }
        });

        const result = await breachDetectionService.detectOffHoursAccess();
        expect(result).toBe(0);
        expect(await BreachLog.countDocuments({ type: 'off_hours_access' })).toBe(0);
      } finally {
        restoreDate();
      }
    });

    it('should not detect during normal org-local hours', async () => {
      await Org.findByIdAndUpdate(testOrg._id, { timezone: 'America/Los_Angeles' });
      const restoreDate = mockNow('2026-06-01T21:35:00.000Z'); // 2:35 PM PDT

      try {
        await AuditLog.create({
          timestamp: new Date('2026-06-01T21:30:00.000Z'),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'client',
          resourceId: 'patient-123',
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.100',
          complianceFlags: {
            phiAccessed: true
          }
        });

        const result = await breachDetectionService.detectOffHoursAccess();
        expect(result).toBe(0);
      } finally {
        restoreDate();
      }
    });
  });

  describe('notifySecurityTeam', () => {
    it('should use potential security event wording for investigating alerts', async () => {
      const emailService = require('../../../src/services/email.service');
      const sendEmailSpy = jest.spyOn(emailService, 'sendEmail').mockResolvedValue(undefined);

      await breachDetectionService.createBreachAlert({
        type: 'off_hours_access',
        severity: 'MEDIUM',
        userId: testCaregiver._id,
        details: 'Off-hours PHI access to client at 2026-06-02 02:02 PDT (Test Org)',
        autoLock: false
      });

      expect(sendEmailSpy).toHaveBeenCalled();
      const [recipient, subject, text, html] = sendEmailSpy.mock.calls[0];
      expect(recipient).toBeTruthy();
      expect(subject).toBe('Potential security event: off_hours_access');
      expect(text).toContain('Potential Security Event');
      expect(text).not.toContain('Security Breach Detected');
      expect(text).toContain('requiring triage');
      expect(text).toContain('Test User');
      expect(text).toContain('Test Org');
      expect(html).toContain('Potential Security Event');

      sendEmailSpy.mockRestore();
    });
  });

  describe('createBreachAlert', () => {
    it('should create breach log entry', async () => {
      await breachDetectionService.createBreachAlert({
        type: 'unauthorized_access',
        severity: 'CRITICAL',
        userId: testCaregiver._id,
        ipAddress: '192.168.1.100',
        details: 'Suspicious activity detected',
        evidence: { test: 'data' },
        autoLock: false
      });

      const breaches = await BreachLog.find({ type: 'unauthorized_access' });
      expect(breaches.length).toBe(1);
      expect(breaches[0].details).toBe('Suspicious activity detected');
      expect(breaches[0].status).toBe('INVESTIGATING');
    }, 60000);

    it('should set 60-day notification deadline', async () => {
      const before = Date.now();
      
      await breachDetectionService.createBreachAlert({
        type: 'unauthorized_access',
        severity: 'HIGH',
        userId: testCaregiver._id,
        details: 'Test breach',
        autoLock: false
      });

      const breach = await BreachLog.findOne({ type: 'unauthorized_access' });
      const deadline = breach.notificationDeadline.getTime();
      const expected = before + (60 * 24 * 60 * 60 * 1000); // 60 days
      
      // Allow 1 second tolerance
      expect(deadline).toBeGreaterThan(expected - 1000);
      expect(deadline).toBeLessThan(expected + 1000);
    });

    it('should not create duplicate breach within 1 hour', async () => {
      await breachDetectionService.createBreachAlert({
        type: 'excessive_failed_logins',
        severity: 'HIGH',
        userId: testCaregiver._id,
        details: 'First alert',
        autoLock: false
      });

      await breachDetectionService.createBreachAlert({
        type: 'excessive_failed_logins',
        severity: 'HIGH',
        userId: testCaregiver._id,
        details: 'Second alert',
        autoLock: false
      });

      const breaches = await BreachLog.find({ type: 'excessive_failed_logins' });
      expect(breaches.length).toBe(1);
    });

    it('should auto-lock account if specified', async () => {
      await breachDetectionService.createBreachAlert({
        type: 'data_exfiltration_attempt',
        severity: 'CRITICAL',
        userId: testCaregiver._id,
        details: 'Rapid data access detected',
        autoLock: true
      });

      const updatedCaregiver = await Caregiver.findById(testCaregiver._id);
      expect(updatedCaregiver.accountLocked).toBe(true);
    });
  });

  describe('lockAccount', () => {
    it('should lock user account', async () => {
      await breachDetectionService.lockAccount(
        testCaregiver._id,
        'Security breach detected'
      );

      const updatedCaregiver = await Caregiver.findById(testCaregiver._id);
      expect(updatedCaregiver.accountLocked).toBe(true);
      expect(updatedCaregiver.lockedReason).toBe('Security breach detected');
      expect(updatedCaregiver.lockedAt).toBeDefined();
    });

    it('should create audit log for account lock', async () => {
      await breachDetectionService.lockAccount(
        testCaregiver._id,
        'Suspicious activity'
      );

      const auditLogs = await AuditLog.find({
        action: 'ACCOUNT_LOCKED',
        userId: testCaregiver._id
      });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].outcome).toBe('SUCCESS');
      expect(auditLogs[0].complianceFlags.highRiskAction).toBe(true);
    });
  });

  describe('runAllDetections', () => {
    // Increase timeout for this describe block
    jest.setTimeout(20000);

    it('should run all detection checks', async () => {
      const results = await breachDetectionService.runAllDetections();

      expect(results).toHaveProperty('failedLogins');
      expect(results).toHaveProperty('dataAccessVolume');
      expect(results).toHaveProperty('offHoursAccess');
      expect(results).toHaveProperty('rapidDataAccess');
      expect(results).toHaveProperty('timestamp');
      expect(results.timestamp).toBeInstanceOf(Date);
    });

    it('should detect multiple breach types simultaneously', async () => {
      // Create failed logins
      for (let i = 0; i < 6; i++) {
        await AuditLog.create({
          timestamp: new Date(),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'LOGIN_FAILED',
          resource: 'session',
          resourceId: testCaregiver._id.toString(),
          outcome: 'FAILURE',
          ipAddress: '192.168.1.100'
        });
      }

      // Create rapid data access
      for (let i = 0; i < 51; i++) {
        await AuditLog.create({
          timestamp: new Date(Date.now() - i * 1000),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'client',
          resourceId: `patient-${i}`,
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.100'
        });
      }

      const results = await breachDetectionService.runAllDetections();

      expect(results.failedLogins).toBeGreaterThan(0);
      expect(results.rapidDataAccess).toBeGreaterThan(0);
    });
  });

  describe('getBreachStatistics', () => {
    beforeEach(async () => {
      // Create sample breach logs
      await BreachLog.create({
        type: 'excessive_failed_logins',
        severity: 'HIGH',
        status: 'INVESTIGATING',
        userId: testCaregiver._id,
        detectedAt: new Date(),
        details: 'Test breach 1'
      });

      await BreachLog.create({
        type: 'unusual_data_access_volume',
        severity: 'CRITICAL',
        status: 'CONFIRMED',
        userId: testCaregiver._id,
        detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        details: 'Test breach 2'
      });
    });

    it('should return breach statistics', async () => {
      const stats = await breachDetectionService.getBreachStatistics(30);

      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('critical');
      expect(stats).toHaveProperty('high');
      expect(stats).toHaveProperty('investigating');
      expect(stats).toHaveProperty('confirmed');
    });
  });
});

