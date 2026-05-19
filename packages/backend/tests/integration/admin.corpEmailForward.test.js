require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');

const app = require('../utils/integration-app');
const { Caregiver, CorpEmailForward } = require('../../src/models');
const { caregiverOne, admin, superAdmin, insertCaregivers } = require('../fixtures/caregiver.fixture');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { tokenService, emailService } = require('../../src/services');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Admin corp email forwards', () => {
  let orgAdminId;
  let superAdminId;

  beforeEach(async () => {
    await clearDatabase();
    const caregivers = await insertCaregivers([caregiverOne, admin, superAdmin]);
    orgAdminId = caregivers[1].id;
    superAdminId = caregivers[2].id;
    await insertOrgs([orgOne]);

    await Caregiver.findByIdAndUpdate(superAdminId, {
      email: 'kirk@biancatechnologies.com',
      name: 'Kirk',
    });
  });

  afterEach(async () => {
    await CorpEmailForward.deleteMany();
    await Caregiver.deleteMany();
  });

  it('lists super admins with corp mailbox suggestions', async () => {
    const accessToken = tokenService.generateToken(superAdminId);
    const res = await request(app)
      .get('/v1/admin/corp-email-forwards')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.domain).toBe('biancatechnologies.com');
    expect(Array.isArray(res.body.staff)).toBe(true);
    const kirk = res.body.staff.find((s) => s.loginEmail === 'kirk@biancatechnologies.com');
    expect(kirk).toBeDefined();
    expect(kirk.corpEmail).toBe('kirk@biancatechnologies.com');
  });

  it('forbids org admin from corp email forward routes', async () => {
    const accessToken = tokenService.generateToken(orgAdminId);
    const res = await request(app)
      .get('/v1/admin/corp-email-forwards')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.statusCode).toEqual(httpStatus.FORBIDDEN);
  });

  it('saves forwarding and sends setup email to corp mailbox when changed', async () => {
    const sendSpy = jest.spyOn(emailService, 'sendEmail').mockResolvedValue({ messageId: 'test-id' });

    const accessToken = tokenService.generateToken(superAdminId);
    const res = await request(app)
      .put('/v1/admin/corp-email-forwards')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        forwards: [
          {
            caregiverId: String(superAdminId),
            corpEmail: 'kirk@biancatechnologies.com',
            forwardToEmail: 'kirk.hasley@gmail.com',
          },
        ],
      });

    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].forwardChanged).toBe(true);
    expect(res.body.results[0].notificationSent).toBe(true);

    const stored = await CorpEmailForward.findOne({ corpEmail: 'kirk@biancatechnologies.com' });
    expect(stored.forwardToEmail).toBe('kirk.hasley@gmail.com');

    expect(sendSpy).toHaveBeenCalledWith(
      'kirk@biancatechnologies.com',
      expect.stringContaining('kirk@biancatechnologies.com'),
      expect.any(String),
      expect.any(String),
    );

    sendSpy.mockRestore();
  });

  it('does not resend notification when forwarding unchanged', async () => {
    await CorpEmailForward.create({
      corpEmail: 'kirk@biancatechnologies.com',
      forwardToEmail: 'kirk.hasley@gmail.com',
      caregiverId: superAdminId,
    });

    const sendSpy = jest.spyOn(emailService, 'sendEmail').mockResolvedValue({ messageId: 'test-id' });
    const accessToken = tokenService.generateToken(superAdminId);

    const res = await request(app)
      .put('/v1/admin/corp-email-forwards')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        forwards: [
          {
            caregiverId: String(superAdminId),
            corpEmail: 'kirk@biancatechnologies.com',
            forwardToEmail: 'kirk.hasley@gmail.com',
          },
        ],
      });

    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.results[0].forwardChanged).toBe(false);
    expect(res.body.results[0].notificationSent).toBe(false);
    expect(sendSpy).not.toHaveBeenCalled();
    sendSpy.mockRestore();
  });
});
