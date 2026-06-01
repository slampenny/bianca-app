const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const httpStatus = require('http-status');
const breachLogService = require('../../../src/services/breachLog.service');
const { AuditLog, BreachLog, Caregiver, Org } = require('../../../src/models');

let mongoServer;

const mockReq = {
  ip: '127.0.0.1',
  method: 'PATCH',
  path: '/v1/admin/breach-logs/test/status',
  originalUrl: '/v1/admin/breach-logs/test/status',
  get: () => 'jest-test',
  connection: { remoteAddress: '127.0.0.1' },
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
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
});

describe('breachLog.service', () => {
  let adminUser;
  let staffUser;
  let org;
  let breach;

  beforeEach(async () => {
    org = await Org.create({
      name: 'Test Org',
      email: 'org@example.com',
      country: 'US',
      timezone: 'America/Los_Angeles',
    });
    staffUser = await Caregiver.create({
      name: 'Staff User',
      email: 'staff@example.com',
      password: 'Password123',
      phone: '1234567890',
      role: 'staff',
      isEmailVerified: true,
      org: org._id,
    });
    adminUser = await Caregiver.create({
      name: 'Super Admin',
      email: 'admin@example.com',
      password: 'Password123',
      phone: '1234567891',
      role: 'superAdmin',
      isEmailVerified: true,
      org: org._id,
    });
    breach = await BreachLog.create({
      type: 'off_hours_access',
      severity: 'MEDIUM',
      status: 'INVESTIGATING',
      userId: staffUser._id,
      orgId: org._id,
      detectedAt: new Date(),
      details: 'Test alert',
      organizationCountry: 'US',
      statusHistory: [{ status: 'INVESTIGATING', changedAt: new Date() }],
    });
  });

  it('lists breach logs with jurisdiction filter', async () => {
    const result = await breachLogService.listBreachLogs({ jurisdiction: 'HIPAA' });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].jurisdiction).toBe('HIPAA');
  });

  it('requires resolution notes for false positive', async () => {
    await expect(
      breachLogService.updateBreachLogStatus(
        breach._id,
        { status: 'FALSE_POSITIVE' },
        adminUser,
        mockReq,
      ),
    ).rejects.toMatchObject({ statusCode: httpStatus.BAD_REQUEST });
  });

  it('updates false positive with resolved metadata and audit log', async () => {
    const detail = await breachLogService.updateBreachLogStatus(
      breach._id,
      {
        status: 'FALSE_POSITIVE',
        resolutionReason: 'timezone_false_positive',
        resolutionNotes: 'Detector bug',
      },
      adminUser,
      mockReq,
    );

    expect(detail.status).toBe('FALSE_POSITIVE');
    expect(detail.resolutionNotes).toBe('Detector bug');
    expect(detail.resolvedAt).toBeTruthy();

    const audit = await AuditLog.findOne({ action: 'BREACH_FALSE_POSITIVE_MARKED' });
    expect(audit).not.toBeNull();
  });
});
