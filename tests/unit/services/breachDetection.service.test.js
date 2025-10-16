/**
 * Unit Tests for Breach Detection Service
 * Tests security breach detection and response
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const breachDetectionService = require('../../../src/services/breachDetection.service');
const { AuditLog, BreachLog, Caregiver } = require('../../../src/models');

let mongoServer;

// Mock AWS SNS
jest.mock('@aws-sdk/client-sns');

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
  await AuditLog.deleteMany();
  await BreachLog.deleteMany();
  await Caregiver.deleteMany();
  jest.clearAllMocks();
});

describe('Breach Detection Service', () => {
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
    });

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
    });

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
          resource: 'patient',
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
    });

    it('should lock account for unusual data access', async () => {
      const now = new Date();
      for (let i = 0; i < 101; i++) {
        await AuditLog.create({
          timestamp: new Date(now.getTime() - i * 30000),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'patient',
          resourceId: `patient-${i}`,
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.100'
        });
      }

      await breachDetectionService.detectDataAccessVolume();

      const updatedCaregiver = await Caregiver.findById(testCaregiver._id);
      expect(updatedCaregiver.accountLocked).toBe(true);
    });

    it('should not detect normal data access volume', async () => {
      // Only 50 accesses (threshold is 100)
      for (let i = 0; i < 50; i++) {
        await AuditLog.create({
          timestamp: new Date(),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'patient',
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
      // Create 21 accesses in the last minute
      const now = new Date();
      for (let i = 0; i < 21; i++) {
        await AuditLog.create({
          timestamp: new Date(now.getTime() - i * 2000), // 2 seconds apart
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'patient',
          resourceId: `patient-${i}`,
          outcome: 'SUCCESS',
          ipAddress: '192.168.1.100'
        });
      }

      const result = await breachDetectionService.detectRapidDataAccess();

      expect(result).toBeGreaterThan(0);

      const breaches = await BreachLog.find({ type: 'data_exfiltration_attempt' });
      expect(breaches.length).toBeGreaterThan(0);
      expect(breaches[0].severity).toBe('CRITICAL');
    });

    it('should lock account for rapid data access', async () => {
      const now = new Date();
      for (let i = 0; i < 21; i++) {
        await AuditLog.create({
          timestamp: new Date(now.getTime() - i * 2000),
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
    });
  });

  describe('detectOffHoursAccess', () => {
    it('should detect off-hours PHI access', async () => {
      // Note: This detection only runs during actual off-hours (10 PM - 6 AM)
      // Create an audit log with recent timestamp
      const recentTime = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      
      await AuditLog.create({
        timestamp: recentTime,
        userId: testCaregiver._id,
        userRole: 'staff',
        action: 'READ',
        resource: 'patient',
        resourceId: 'patient-123',
        outcome: 'SUCCESS',
        ipAddress: '192.168.1.100',
        complianceFlags: {
          phiAccessed: true
        }
      });

      const result = await breachDetectionService.detectOffHoursAccess();

      // Result depends on current time - if it's off-hours, it should detect
      // Otherwise it returns 0 (detection only runs during off-hours as a cron job)
      const currentHour = new Date().getHours();
      const isOffHours = currentHour >= 22 || currentHour < 7;
      
      if (isOffHours) {
        expect(result).toBeGreaterThan(0);
      } else {
        expect(result).toBe(0);
      }
    });

    it('should not detect during normal hours', async () => {
      // Create an audit log with normal hours timestamp (2 PM)
      const normalHoursTime = new Date();
      normalHoursTime.setHours(14, 30, 0, 0); // 2:30 PM
      
      await AuditLog.create({
        timestamp: normalHoursTime,
        userId: testCaregiver._id,
        userRole: 'staff',
        action: 'READ',
        resource: 'patient',
        resourceId: 'patient-123',
        outcome: 'SUCCESS',
        ipAddress: '192.168.1.100',
        complianceFlags: {
          phiAccessed: true
        }
      });

      const result = await breachDetectionService.detectOffHoursAccess();

      expect(result).toBe(0);
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
    });

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
      for (let i = 0; i < 21; i++) {
        await AuditLog.create({
          timestamp: new Date(Date.now() - i * 2000),
          userId: testCaregiver._id,
          userRole: 'staff',
          action: 'READ',
          resource: 'patient',
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

