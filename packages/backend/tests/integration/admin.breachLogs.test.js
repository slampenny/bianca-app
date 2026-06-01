require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const mongoose = require('mongoose');

const app = require('../utils/integration-app');
const { AuditLog, BreachLog, Caregiver } = require('../../src/models');
const { caregiverOne, admin, superAdmin, insertCaregivers } = require('../fixtures/caregiver.fixture');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { tokenService } = require('../../src/services');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Admin breach logs', () => {
  let staffId;
  let orgAdminId;
  let superAdminId;
  let orgId;
  let breachId;

  beforeEach(async () => {
    await clearDatabase();
    const orgs = await insertOrgs([orgOne]);
    orgId = orgs[0]._id;
    const caregivers = await insertCaregivers([caregiverOne, admin, superAdmin]);
    staffId = caregivers[0].id;
    orgAdminId = caregivers[1].id;
    superAdminId = caregivers[2].id;

    const breach = await BreachLog.create({
      type: 'off_hours_access',
      severity: 'MEDIUM',
      status: 'INVESTIGATING',
      userId: staffId,
      orgId,
      ipAddress: '203.0.113.10',
      detectedAt: new Date('2026-06-01T22:55:00.000Z'),
      details: 'Off-hours PHI access to client at 22:00',
      organizationCountry: 'US',
      affectedResourceType: 'client',
      affectedResourceIds: ['client-abc'],
      statusHistory: [{
        status: 'INVESTIGATING',
        changedAt: new Date('2026-06-01T22:55:00.000Z'),
        notes: 'Automated detector alert — requires triage',
      }],
    });
    breachId = breach._id.toString();
  });

  afterEach(async () => {
    await AuditLog.deleteMany();
    await BreachLog.deleteMany();
    await Caregiver.deleteMany();
  });

  it('allows super admin to list breach logs with filters', async () => {
    const accessToken = tokenService.generateToken(superAdminId);
    const res = await request(app)
      .get('/v1/admin/breach-logs')
      .query({ status: 'INVESTIGATING', type: 'off_hours_access', jurisdiction: 'HIPAA' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].id).toEqual(breachId);
    expect(res.body.results[0].jurisdiction).toEqual('HIPAA');
  });

  it('forbids staff from listing breach logs', async () => {
    const accessToken = tokenService.generateToken(staffId);
    const res = await request(app)
      .get('/v1/admin/breach-logs')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toEqual(httpStatus.FORBIDDEN);
  });

  it('allows super admin to read breach log detail and writes audit log', async () => {
    const accessToken = tokenService.generateToken(superAdminId);
    const res = await request(app)
      .get(`/v1/admin/breach-logs/${breachId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.id).toEqual(breachId);
    expect(res.body.type).toEqual('off_hours_access');
    expect(Array.isArray(res.body.statusHistory)).toBe(true);

    const audit = await AuditLog.findOne({ action: 'BREACH_LOG_READ', resourceId: breachId });
    expect(audit).not.toBeNull();
  });

  it('requires resolution notes when marking false positive', async () => {
    const accessToken = tokenService.generateToken(superAdminId);
    const res = await request(app)
      .patch(`/v1/admin/breach-logs/${breachId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'FALSE_POSITIVE' });

    expect(res.statusCode).toEqual(httpStatus.BAD_REQUEST);
  });

  it('persists false-positive resolution with resolvedAt and audit log', async () => {
    const accessToken = tokenService.generateToken(superAdminId);
    const notes = 'Off-hours detector used server UTC instead of org timezone.';
    const res = await request(app)
      .patch(`/v1/admin/breach-logs/${breachId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: 'FALSE_POSITIVE',
        resolutionReason: 'timezone_false_positive',
        resolutionNotes: notes,
      });

    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.status).toEqual('FALSE_POSITIVE');
    expect(res.body.resolutionNotes).toEqual(notes);
    expect(res.body.resolutionReason).toEqual('timezone_false_positive');
    expect(res.body.resolvedAt).toBeTruthy();
    expect(res.body.resolvedBy?.id || res.body.resolvedBy).toBeTruthy();

    const stored = await BreachLog.findById(breachId);
    expect(stored.status).toEqual('FALSE_POSITIVE');
    expect(stored.resolvedAt).toBeInstanceOf(Date);
    expect(String(stored.resolvedBy)).toEqual(String(superAdminId));

    const audit = await AuditLog.findOne({ action: 'BREACH_FALSE_POSITIVE_MARKED', resourceId: breachId });
    expect(audit).not.toBeNull();
  });

  it('filters breach logs by orgId and userId', async () => {
    const accessToken = tokenService.generateToken(superAdminId);

    const byOrg = await request(app)
      .get('/v1/admin/breach-logs')
      .query({ orgId: String(orgId) })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(byOrg.statusCode).toEqual(httpStatus.OK);
    expect(byOrg.body.results).toHaveLength(1);

    const byUser = await request(app)
      .get('/v1/admin/breach-logs')
      .query({ userId: String(staffId) })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(byUser.statusCode).toEqual(httpStatus.OK);
    expect(byUser.body.results).toHaveLength(1);

    const miss = await request(app)
      .get('/v1/admin/breach-logs')
      .query({ orgId: new mongoose.Types.ObjectId().toString() })
      .set('Authorization', `Bearer ${accessToken}`);
    expect(miss.body.results).toHaveLength(0);
  });
});
