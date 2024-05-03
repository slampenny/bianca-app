const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../../src/app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Caregiver, Token } = require('../../src/models');
const { caregiverOne, caregiverTwo, admin, insertCaregivers, superAdmin } = require('../fixtures/caregiver.fixture');
const { orgOne, orgTwo, insertOrgs } = require('../fixtures/org.fixture');
const { tokenService, orgService } = require('../../src/services');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start(); // Fix: Use start() function instead of new keyword
  const mongoUri = await mongoServer.getUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
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
      .send({ org: orgTwo, caregiver: {...caregiverTwo, password: "password1"} });
  
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
    const res = await request(app)
      .get('/v1/orgs')
      .set('Authorization', `Bearer ${superAdminAccessToken}`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it('should get a specific org', async () => {
    const superAdminAccessToken = tokenService.generateToken(superAdminId);
    const res = await request(app)
      .get(`/v1/orgs/${orgId}`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
    expect(res.statusCode).toEqual(200);
    expect(res.body.id).toEqual(orgId);
  });

  it('should update a specific org', async () => {
    const superAdminAccessToken = tokenService.generateToken(superAdminId);
    const res = await request(app)
      .patch(`/v1/orgs/${orgId}`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`)
      .send({
        name: 'Updated Org',
        email: 'updatedorg@example.com',
      });
    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.name).toEqual('Updated Org');
    expect(res.body.email).toEqual('updatedorg@example.com');

    // Check that the org has been updated in the database
    let org = await Org.findById(orgId);
    expect(org.name).toEqual('Updated Org');
    expect(org.email).toEqual('updatedorg@example.com');
  });

  it('should delete a specific org', async () => {
    const superAdminAccessToken = tokenService.generateToken(superAdminId);
    const res = await request(app)
      .delete(`/v1/orgs/${orgId}`)
      .set('Authorization', `Bearer ${superAdminAccessToken}`);
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

  it('should change a caregiver\'s role', async () => {
    const adminAccessToken = tokenService.generateToken(adminId);
    const org = await orgService.getOrgById(orgId);
    const caregiver = await Caregiver.findById(caregiverId);
    org.caregivers.push(caregiver);
    await org.save();

    const res = await request(app)
      .patch(`/v1/orgs/${orgId}/caregiver/${caregiverId}/role`)
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({
        role: 'orgAdmin'
      });
    expect(res.statusCode).toEqual(200);
  });
});