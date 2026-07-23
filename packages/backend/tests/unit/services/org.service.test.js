const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const orgService = require('../../../src/services/org.service');
const { Org, Caregiver } = require('../../../src/models');
const {
  caregiverOne,
  caregiverTwo,
  caregiverOneWithPassword,
  insertCaregivers,
} = require('../../fixtures/caregiver.fixture');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('orgService', () => {
  afterEach(async () => {
    // Delete all orgs after each test
    await Org.deleteMany({});

    // Delete all caregivers after each test
    await Caregiver.deleteMany({});
  });

  it('should create a new org and a caregiver', async () => {
    const { org, caregiver } = await orgService.createOrg(orgOne, caregiverOneWithPassword);
    expect(org).toHaveProperty('id');
    expect(org).toHaveProperty('name', orgOne.name);
    expect(org).toHaveProperty('email', orgOne.email);

    expect(caregiver).toHaveProperty('id');
    expect(caregiver).toHaveProperty('name', caregiverOne.name);
    expect(caregiver).toHaveProperty('email', caregiverOne.email);
  });

  it('should get an org by id', async () => {
    const [org] = await insertOrgs([orgOne]);
    const fetchedOrg = await orgService.getOrgById(org.id);
    expect(fetchedOrg).toHaveProperty('id', org.id);
  });

  it('should get an org by email', async () => {
    const [org] = await insertOrgs([orgOne]);
    const fetchedOrg = await orgService.getOrgByEmail(org.email);
    expect(fetchedOrg).toHaveProperty('email', org.email);
  });

  it('should update an org', async () => {
    const [org] = await insertOrgs([orgOne]);
    const updatedOrg = await orgService.updateOrgById(org.id, { name: 'Updated Org' });
    expect(updatedOrg).toHaveProperty('id', org.id);
    expect(updatedOrg).toHaveProperty('name', 'Updated Org');
  });

  it('should update an org country', async () => {
    const [org] = await insertOrgs([orgOne]);
    const updatedOrg = await orgService.updateOrgById(org.id, { country: 'CA' });
    expect(updatedOrg).toHaveProperty('id', org.id);
    expect(updatedOrg).toHaveProperty('country', 'CA');
  });

  it('should update dailyDigestSettings', async () => {
    const [org] = await insertOrgs([orgOne]);
    const enabled = await orgService.updateOrgById(org.id, {
      dailyDigestSettings: { enabled: true, sendTime: '17:30' },
    });
    expect(enabled.dailyDigestSettings.enabled).toBe(true);
    expect(enabled.dailyDigestSettings.sendTime).toBe('17:30');

    const disabled = await orgService.updateOrgById(org.id, {
      dailyDigestSettings: { enabled: false },
    });
    expect(disabled.dailyDigestSettings.enabled).toBe(false);
  });

  it('should delete an org', async () => {
    const [org] = await insertOrgs([orgOne]);
    await orgService.deleteOrgById(org.id);
    const fetchedOrg = await orgService.getOrgById(org.id);
    expect(fetchedOrg).toBeNull();
  });

  it('should add a caregiver to an org', async () => {
    const [org] = await insertOrgs([orgOne]);
    const [cg] = await insertCaregivers([caregiverTwo]);

    const updatedOrg = await orgService.addCaregiver(org.id, cg.id);
    expect(updatedOrg.caregivers.map(String)).toEqual(expect.arrayContaining([cg.id.toString()]));
  });

  it('should not allow adding the same caregiver twice', async () => {
    const [org] = await insertOrgs([orgOne]);
    const [cg] = await insertCaregivers([caregiverTwo]);

    // Add the caregiver to the org for the first time
    const updatedOrg = await orgService.addCaregiver(org.id, cg.id);
    expect(updatedOrg.caregivers.map(String)).toEqual(expect.arrayContaining([cg.id.toString()]));

    // Try to add the same caregiver to the org again
    await expect(orgService.addCaregiver(org.id, cg.id)).rejects.toThrow();

    // Check that the org's caregivers array has not changed
    const orgAfterSecondAdd = await orgService.getOrgById(org.id);
    expect(orgAfterSecondAdd.caregivers.map(String)).toEqual(updatedOrg.caregivers.map(String));
  });

  it('should remove a caregiver from an org', async () => {
    const [org] = await insertOrgs([orgOne]);
    const [cg] = await insertCaregivers([
      {
        org: org.id,
        ...caregiverTwo,
      },
    ]);

    // Add the caregiver to the organization
    org.caregivers.push(cg.id);

    // Fetch the organization document from the database before saving it
    const orgFromDb = await Org.findById(org.id);
    if (!orgFromDb) {
      throw new Error(`No matching document found for id "${org.id}"`);
    }

    try {
      await org.save();
    } catch (err) {
      console.error(err);
      throw err; // re-throw the error so the test fails
    }

    const updatedOrg = await orgService.removeCaregiver(org.id, cg.id);
    expect(updatedOrg.caregivers).not.toContainEqual(cg.id);
  });

  it('should update requiredCallQuestions', async () => {
    const [org] = await insertOrgs([orgOne]);
    const updated = await orgService.updateOrgById(org.id, {
      requiredCallQuestions: {
        enabled: true,
        questions: [{ id: 'med', prompt: 'Have you taken your medication today?' }],
      },
    });
    expect(updated.requiredCallQuestions.enabled).toBe(true);
    expect(updated.requiredCallQuestions.questions).toHaveLength(1);
    expect(updated.requiredCallQuestions.questions[0].id).toBe('med');
  });

  it('should reject invalid requiredCallQuestions config', async () => {
    const [org] = await insertOrgs([orgOne]);
    await expect(
      orgService.updateOrgById(org.id, {
        requiredCallQuestions: { enabled: true, questions: [] },
      })
    ).rejects.toThrow();
  });

  it('should update custom voiceOnboarding plan', async () => {
    const [org] = await insertOrgs([orgOne]);
    const updated = await orgService.updateOrgById(org.id, {
      voiceOnboarding: {
        useDefault: false,
        days: [
          {
            dayNumber: 1,
            theme: 'Welcome',
            opening: 'Hi from Bianca',
            questions: [{ id: 'day1_topic_1', prompt: 'How are you settling in?' }],
          },
        ],
      },
    });
    expect(updated.voiceOnboarding.useDefault).toBe(false);
    expect(updated.voiceOnboarding.days).toHaveLength(1);
    expect(updated.voiceOnboarding.days[0].questions[0].prompt).toContain('settling');
  });

  it('should reset voiceOnboarding to default plan', async () => {
    const [org] = await insertOrgs([orgOne]);
    await orgService.updateOrgById(org.id, {
      voiceOnboarding: {
        useDefault: false,
        days: [
          {
            questions: [{ id: 'custom_q', prompt: 'Custom question?' }],
          },
        ],
      },
    });
    const reset = await orgService.updateOrgById(org.id, {
      voiceOnboarding: { useDefault: true, days: [] },
    });
    expect(reset.voiceOnboarding.useDefault).toBe(true);
    expect(reset.voiceOnboarding.days).toEqual([]);
  });

  it('should block privacy-conflicting voiceOnboarding for orgAdmin role', async () => {
    const [org] = await insertOrgs([orgOne]);
    await expect(
      orgService.updateOrgById(
        org.id,
        {
          voiceOnboarding: {
            useDefault: false,
            days: [
              {
                dayNumber: 1,
                opening: "Hi — we'll tell your family about this.",
                questions: [{ id: 'q1', prompt: 'How are you?' }],
              },
            ],
          },
        },
        { role: 'orgAdmin' }
      )
    ).rejects.toThrow(/privacy rules/);
  });

  it('should warn but save privacy-conflicting voiceOnboarding for superAdmin role', async () => {
    const [org] = await insertOrgs([orgOne]);
    const updated = await orgService.updateOrgById(
      org.id,
      {
        voiceOnboarding: {
          useDefault: false,
          days: [
            {
              dayNumber: 1,
              opening: "Hi — we'll tell your family about this.",
              questions: [{ id: 'q1', prompt: 'How are you?' }],
            },
          ],
        },
      },
      { role: 'superAdmin' }
    );
    expect(updated.voiceOnboarding.useDefault).toBe(false);
    expect(updated.$locals.voiceOnboardingPrivacyWarnings.length).toBeGreaterThan(0);
  });

  it('should set the role of a caregiver in an org', async () => {
    const [org] = await insertOrgs([orgOne]);
    const [cg] = await insertCaregivers([
      {
        orgId: org.id,
        ...caregiverTwo,
      },
    ]);

    // Add the caregiver to the organization
    org.caregivers.push(cg.id);
    await org.save();

    const newRole = 'orgAdmin';
    await orgService.setRole(org.id, cg.id, newRole);

    const updatedCg = await Caregiver.findById(cg.id);
    expect(updatedCg.role).toBe(newRole);
  });
});
