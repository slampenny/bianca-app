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
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
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
    const org = await orgService.createOrg(orgOne, caregiverOneWithPassword);
    expect(org).toHaveProperty('id');
    expect(org).toHaveProperty('name', orgOne.name);
    expect(org).toHaveProperty('email', orgOne.email);

    const caregiver = await Caregiver.findOne({ email: caregiverOne.email });
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
