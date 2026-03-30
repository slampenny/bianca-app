require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');

const app = require('../utils/integration-app');
const { Caregiver, Token, AuditLog } = require('../../src/models');
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

describe('Admin impersonation', () => {
  let staffId;
  let orgAdminId;
  let superAdminId;

  beforeEach(async () => {
    await clearDatabase();
    const caregivers = await insertCaregivers([caregiverOne, admin, superAdmin]);
    staffId = caregivers[0].id;
    orgAdminId = caregivers[1].id;
    superAdminId = caregivers[2].id;
    await insertOrgs([orgOne]);
  });

  afterEach(async () => {
    await AuditLog.deleteMany();
    await Token.deleteMany();
    await Caregiver.deleteMany();
  });

  it('allows super admin to search caregivers', async () => {
    const accessToken = tokenService.generateToken(superAdminId);
    const res = await request(app)
      .get('/v1/admin/caregivers')
      .query({ q: 'fake' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.some((r) => r.email === caregiverOne.email)).toBe(true);
  });

  it('forbids org admin from admin caregiver search', async () => {
    const accessToken = tokenService.generateToken(orgAdminId);
    const res = await request(app)
      .get('/v1/admin/caregivers')
      .query({ q: 'fake' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toEqual(httpStatus.FORBIDDEN);
  });

  it('allows super admin to impersonate a staff caregiver and writes audit log', async () => {
    const accessToken = tokenService.generateToken(superAdminId);
    const res = await request(app)
      .post('/v1/admin/impersonate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ caregiverId: String(staffId) });

    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.impersonation).toBe(true);
    expect(res.body.tokens).toBeDefined();
    expect(res.body.tokens.access).toBeDefined();
    expect(res.body.caregiver.email).toEqual(caregiverOne.email);

    const audit = await AuditLog.findOne({ action: 'IMPERSONATION' });
    expect(audit).not.toBeNull();
    expect(String(audit.resourceId)).toEqual(String(staffId));
  });

  it('forbids impersonating another super admin', async () => {
    const accessToken = tokenService.generateToken(superAdminId);
    const res = await request(app)
      .post('/v1/admin/impersonate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ caregiverId: String(superAdminId) });

    expect(res.statusCode).toEqual(httpStatus.FORBIDDEN);
  });
});
