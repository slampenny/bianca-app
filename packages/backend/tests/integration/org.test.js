// Import integration setup FIRST to ensure proper mocking
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');

// Import integration test app AFTER all mocks are set up
const app = require('../utils/integration-app');
const { Org, Caregiver, Token } = require('../../src/models');
const {
  caregiverOne,
  caregiverTwo,
  admin,
  insertCaregivers,
  superAdmin,
} = require('../fixtures/caregiver.fixture');
const { orgOne, orgTwo, insertOrgs } = require('../fixtures/org.fixture');
const { tokenService, orgService } = require('../../src/services');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Org routes', () => {
  let orgId;
  let caregiverId;
  let adminId;
  let superAdminId;

  beforeEach(async () => {
    // Insert caregivers before each test
    const caregivers = await insertCaregivers([caregiverOne, admin, superAdmin]);
    caregiverId = caregivers[0].id;
    adminId = caregivers[1].id;
    superAdminId = caregivers[2].id;

    // Create a new org before each test
    const orgs = await insertOrgs([orgOne]);
    orgId = orgs[0].id;
  });

  afterEach(async () => {
    // Delete the org after each test
    await Org.deleteMany();
    // Delete the caregiver after each test
    await Caregiver.deleteMany();
    await Token.deleteMany();
  });

  it('should create a new org and a caregiver', async () => {
    const res = await request(app)
      .post('/v1/orgs')
      .send({ org: orgTwo, caregiver: { ...caregiverTwo, password: 'password1', patients: [] } });

    expect(res.statusCode).toEqual(httpStatus.CREATED);
    expect(res.body.name).toEqual(orgTwo.name);
    expect(res.body.email).toEqual(orgTwo.email);

    // Check that the org has been created in the database
    const org = await Org.findById(res.body.id);
    expect(org).not.toBeNull();
    expect(org.name).toEqual(orgTwo.name);
    expect(org.email).toEqual(orgTwo.email);

    // Check that the caregiver has been created in the database
    const caregiver = await Caregiver.findOne({ email: caregiverTwo.email });
    expect(caregiver).not.toBeNull();
    expect(caregiver.name).toEqual(caregiverTwo.name);
    expect(caregiver.email).toEqual(caregiverTwo.email);
  });

  it('should get all orgs', async () => {
    const superAdminAccessToken = tokenService.generateToken(superAdminId);
    const res = await request(app).get('/v1/orgs').set('Authorization', `Bearer ${superAdminAccessToken}`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it('should get a specific org', async () => {
    const superAdminAccessToken = tokenService.generateToken(superAdminId);
    const res = await request(app).get(`/v1/orgs/${orgId}`).set('Authorization', `Bearer ${superAdminAccessToken}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.id).toEqual(orgId);
  });

  it('should update a specific org', async () => {
    const superAdminAccessToken = tokenService.generateToken(superAdminId);
    const res = await request(app).patch(`/v1/orgs/${orgId}`).set('Authorization', `Bearer ${superAdminAccessToken}`).send({
      name: 'Updated Org',
      email: 'updatedorg@example.com',
    });
    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.name).toEqual('Updated Org');
    expect(res.body.email).toEqual('updatedorg@example.com');

    // Check that the org has been updated in the database
    const org = await Org.findById(orgId);
    expect(org.name).toEqual('Updated Org');
    expect(org.email).toEqual('updatedorg@example.com');
  });

  it('should update org timezone', async () => {
    const superAdminAccessToken = tokenService.generateToken(superAdminId);
    const res = await request(app).patch(`/v1/orgs/${orgId}`).set('Authorization', `Bearer ${superAdminAccessToken}`).send({
      timezone: 'America/Los_Angeles',
    });
    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.timezone).toEqual('America/Los_Angeles');

    // Check that the org timezone has been updated in the database
    const org = await Org.findById(orgId);
    expect(org.timezone).toEqual('America/Los_Angeles');
  });

  it('should delete a specific org', async () => {
    const superAdminAccessToken = tokenService.generateToken(superAdminId);
    const res = await request(app).delete(`/v1/orgs/${orgId}`).set('Authorization', `Bearer ${superAdminAccessToken}`);
    expect(res.statusCode).toEqual(httpStatus.NO_CONTENT);
  });

  it('should assign a caregiver to a org', async () => {
    const adminAccessToken = tokenService.generateToken(adminId);
    const res = await request(app)
      .post(`/v1/orgs/${orgId}/caregiver/${caregiverId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(res.statusCode).toEqual(200);
  });

  it('should remove a caregiver from a org', async () => {
    const adminAccessToken = tokenService.generateToken(adminId);
    const org = await orgService.getOrgById(orgId);
    const caregiver = await Caregiver.findById(caregiverId);
    org.caregivers.push(caregiver);
    await org.save();

    const res = await request(app)
      .delete(`/v1/orgs/${orgId}/caregiver/${caregiverId}`)
      .set('Authorization', `Bearer ${adminAccessToken}`);
    expect(res.statusCode).toEqual(200);
  });

  describe('org settings: voice onboarding and required call questions', () => {
    let orgAdminAccessToken;

    beforeEach(async () => {
      const org = await Org.findById(orgId);
      await Caregiver.findByIdAndUpdate(adminId, { org: orgId });
      if (!org.caregivers.some((c) => String(c) === String(adminId))) {
        org.caregivers.push(adminId);
        await org.save();
      }
      orgAdminAccessToken = tokenService.generateToken(adminId);
    });

    it('should return default voice onboarding plan for org admin', async () => {
      const res = await request(app)
        .get('/v1/orgs/onboarding/default-plan')
        .set('Authorization', `Bearer ${orgAdminAccessToken}`);

      expect(res.statusCode).toEqual(httpStatus.OK);
      expect(res.body.plan).toBeDefined();
      expect(res.body.plan.totalDays).toBe(5);
      expect(res.body.plan.days.every((d) => d.questions.length > 0)).toBe(true);
    });

    it('should allow org admin to save custom voice onboarding', async () => {
      const res = await request(app)
        .patch(`/v1/orgs/${orgId}`)
        .set('Authorization', `Bearer ${orgAdminAccessToken}`)
        .send({
          voiceOnboarding: {
            useDefault: false,
            days: [
              {
                dayNumber: 1,
                theme: 'Custom day',
                opening: 'Hello from our team',
                questions: [{ id: 'day1_topic_1', prompt: 'Did you eat breakfast?' }],
              },
            ],
          },
        });

      expect(res.statusCode).toEqual(httpStatus.OK);
      expect(res.body.voiceOnboarding.useDefault).toBe(false);
      expect(res.body.voiceOnboarding.days[0].questions[0].prompt).toContain('breakfast');

      const reloaded = await Org.findById(orgId);
      expect(reloaded.voiceOnboarding.useDefault).toBe(false);
      expect(reloaded.voiceOnboarding.days[0].questions[0].id).toBe('day1_topic_1');
    });

    it('should reject privacy-conflicting voice onboarding for org admin', async () => {
      const res = await request(app)
        .patch(`/v1/orgs/${orgId}`)
        .set('Authorization', `Bearer ${orgAdminAccessToken}`)
        .send({
          voiceOnboarding: {
            useDefault: false,
            days: [
              {
                dayNumber: 1,
                theme: 'Custom day',
                opening: "Hi — we'll tell your family about this.",
                questions: [{ id: 'day1_topic_1', prompt: 'Did you eat breakfast?' }],
              },
            ],
          },
        });

      expect(res.statusCode).toEqual(httpStatus.BAD_REQUEST);
      expect(res.body.message).toMatch(/privacy rules/i);
      expect(res.body.message).toMatch(/tell your family/i);
    });

    it('should warn but allow privacy-conflicting voice onboarding for super admin', async () => {
      const superAdminAccessToken = tokenService.generateToken(superAdminId);
      const res = await request(app)
        .patch(`/v1/orgs/${orgId}`)
        .set('Authorization', `Bearer ${superAdminAccessToken}`)
        .send({
          voiceOnboarding: {
            useDefault: false,
            days: [
              {
                dayNumber: 1,
                theme: 'Custom day',
                opening: "Hi — we'll tell your family about this.",
                questions: [{ id: 'day1_topic_1', prompt: 'Did you eat breakfast?' }],
              },
            ],
          },
        });

      expect(res.statusCode).toEqual(httpStatus.OK);
      expect(res.body.voiceOnboarding.useDefault).toBe(false);
      expect(res.body.voiceOnboardingPrivacyWarnings?.length).toBeGreaterThan(0);
      expect(res.body.voiceOnboardingPrivacyWarnings.some((w) => /tell your family/i.test(w.phrase))).toBe(true);
    });

    it('should allow org admin to configure required call questions', async () => {
      const res = await request(app)
        .patch(`/v1/orgs/${orgId}`)
        .set('Authorization', `Bearer ${orgAdminAccessToken}`)
        .send({
          requiredCallQuestions: {
            enabled: true,
            questions: [{ id: 'med', prompt: 'Have you taken your medication today?' }],
          },
        });

      expect(res.statusCode).toEqual(httpStatus.OK);
      expect(res.body.requiredCallQuestions.enabled).toBe(true);
      expect(res.body.requiredCallQuestions.questions).toHaveLength(1);

      const reloaded = await Org.findById(orgId);
      expect(reloaded.requiredCallQuestions.enabled).toBe(true);
      expect(reloaded.requiredCallQuestions.questions[0].prompt).toContain('medication');
    });

    it('should reject enabled required questions without prompts', async () => {
      const res = await request(app)
        .patch(`/v1/orgs/${orgId}`)
        .set('Authorization', `Bearer ${orgAdminAccessToken}`)
        .send({
          requiredCallQuestions: { enabled: true, questions: [] },
        });

      expect(res.statusCode).toEqual(httpStatus.BAD_REQUEST);
    });
  });

  it("should change a caregiver's role", async () => {
    const adminAccessToken = tokenService.generateToken(adminId);
    const org = await orgService.getOrgById(orgId);
    const caregiver = await Caregiver.findById(caregiverId);
    org.caregivers.push(caregiver);
    await org.save();

    const res = await request(app)
      .patch(`/v1/orgs/${orgId}/caregiver/${caregiverId}/role`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        role: 'orgAdmin',
      });
    expect(res.statusCode).toEqual(200);
  });
});
