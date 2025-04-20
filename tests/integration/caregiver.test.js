const request = require('supertest');
const faker = require('faker');
const httpStatus = require('http-status');
const app = require('../../src/app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Caregiver, Token, Org } = require('../../src/models');
const {
  caregiverOne,
  caregiverTwo,
  admin,
  insertCaregivers,
  insertCaregivertoOrgAndReturnToken,
  insertCaregivertoOrgAndReturnTokenByRole,
  insertCaregiversAndAddToOrg,
} = require('../fixtures/caregiver.fixture');

const {
  orgOne,
  insertOrgs,
} = require('../fixtures/org.fixture');

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

describe('Caregiver routes', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Caregiver.deleteMany();
    await Token.deleteMany();
  });
  describe('GET /v1/caregivers', () => {
    test('should return 200 and apply the default query options', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [caregiver] = await insertCaregiversAndAddToOrg(org, [caregiverOne, caregiverTwo]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 3,
      });
      expect(res.body.results).toHaveLength(3);
      expect(res.body.results[0]).toEqual({
        id: caregiver.id,
        name: caregiver.name,
        email: caregiver.email,
        phone: caregiver.phone,
        role: caregiver.role,
        org: caregiver.org.toHexString()  ,
        patients: expect.any(Array),
        isEmailVerified: false,
      });
    });

    test('should return 401 if access token is missing', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo, admin]);

      await request(app).get('/v1/caregivers').send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 if a non-admin is trying to access all caregivers', async () => {
      const [org] = await insertOrgs([orgOne]);
      await insertCaregiversAndAddToOrg(org, [caregiverTwo, admin]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'staff');
      await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should correctly apply filter on name field', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [caregiver] = await insertCaregiversAndAddToOrg(org, [caregiverOne, caregiverTwo]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ name: caregiverOne.name })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 1,
      });
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].id).toBe(caregiver.id);
    });

    test('should correctly apply filter on role field', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [caregiver1, caregiver2] = await insertCaregiversAndAddToOrg(org, [caregiverOne, caregiverTwo]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          role: 'staff', // filter by role
        })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 2,
      });
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0].id).toBe(caregiver1.id);
      expect(res.body.results[1].id).toBe(caregiver2.id);
    });

    test('should correctly sort the returned array if descending sort param is specified', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [caregiver1, caregiver2] = await insertCaregiversAndAddToOrg(org, [caregiverOne, caregiverTwo]);
      const { caregiver: admin1, accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ sortBy: 'role:desc' })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 3,
      });
      expect(res.body.results).toHaveLength(3);
      expect(res.body.results[0].id).toBe(caregiver1.id);
      expect(res.body.results[1].id).toBe(caregiver2.id);
      expect(res.body.results[2].id).toBe(admin1.id);
    });

    test('should correctly sort the returned array if ascending sort param is specified', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [caregiver1, caregiver2] = await insertCaregiversAndAddToOrg(org, [caregiverOne, caregiverTwo]);
      const { caregiver: admin1, accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ sortBy: 'role:asc' })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 3,
      });
      expect(res.body.results).toHaveLength(3);
      expect(res.body.results[0].id).toBe(admin1.id);
      expect(res.body.results[1].id).toBe(caregiver1.id);
      expect(res.body.results[2].id).toBe(caregiver2.id);
    });

    test('should correctly sort the returned array if multiple sorting criteria are specified', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [caregiver1, caregiver2] = await insertCaregiversAndAddToOrg(org, [caregiverOne, caregiverTwo]);
      const { caregiver: admin1, accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ sortBy: 'role:desc,name:asc' })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 10,
        totalPages: 1,
        totalResults: 3,
      });
      expect(res.body.results).toHaveLength(3);

      const expectedOrder = [caregiver1, caregiver2, admin1].sort((a, b) => {
        if (a.role < b.role) {
          return 1;
        }
        if (a.role > b.role) {
          return -1;
        }
        return a.name < b.name ? -1 : 1;
      });

      expectedOrder.forEach((caregiver, index) => {
        expect(res.body.results[index].id).toBe(caregiver.id);
      });
    });

    test('should limit returned array if limit param is specified', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [caregiver1, caregiver2] = await insertCaregiversAndAddToOrg(org, [caregiverOne, caregiverTwo]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ limit: 2 })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 1,
        limit: 2,
        totalPages: 2,
        totalResults: 3,
      });
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0].id).toBe(caregiver1.id);
      expect(res.body.results[1].id).toBe(caregiver2.id);
    });

    test('should return the correct page if page and limit params are specified', async () => {
      const [org] = await insertOrgs([orgOne]);
      await insertCaregiversAndAddToOrg(org, [caregiverOne, caregiverTwo]);
      const { caregiver: admin1, accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      
      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 2, limit: 2 })
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        results: expect.any(Array),
        page: 2,
        limit: 2,
        totalPages: 2,
        totalResults: 3,
      });
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].id).toBe(admin1.id);
    });
  });

  describe('GET /v1/caregivers/:caregiverId', () => {
    test('should return 200 and the caregiver object if data is ok', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver, accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'staff');
      const res = await request(app)
        .get(`/v1/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: caregiver.id,
        email: caregiver.email,
        name: caregiver.name,
        phone: caregiver.phone,
        role: caregiver.role,
        org: caregiver.org.toHexString(),
        patients: expect.any(Array),
        isEmailVerified: false,
      });
    });

    test('should return 401 error if access token is missing', async () => {
      const [caregiver1] = await insertCaregivers([caregiverOne]);

      await request(app).get(`/v1/caregivers/${caregiver1.id}`).send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if caregiver is trying to get another caregiver', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [caregiver2] = await insertCaregiversAndAddToOrg(org, [caregiverTwo]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      await request(app)
        .get(`/v1/caregivers/${caregiver2.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 200 and the caregiver object if admin is trying to get another caregiver', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [caregiver1] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');

      await request(app)
        .get(`/v1/caregivers/${caregiver1.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);
    });

    test('should return 400 error if caregiverId is not a valid mongo id', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);

      await request(app)
        .get('/v1/caregivers/invalidId')
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error if caregiver is not found', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, admin);

      await request(app)
        .get(`/v1/caregivers/${mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /v1/caregivers/:caregiverId', () => {
    test('should return 204 if data is ok', async () => {
      const [org] = await insertOrgs([orgOne]);
      const {caregiver, accessToken} = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);

      caregiver.patients = [];
      await caregiver.save();

      org.caregivers.push(caregiver);
      await org.save();

      await request(app)
        .delete(`/v1/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbCaregiver = await Caregiver.findById(caregiver.id);
      expect(dbCaregiver).toBeNull();
    });

    test('should return 401 error if access token is missing', async () => {
      const [caregiver1] = await insertCaregivers([caregiverOne]);

      await request(app).delete(`/v1/caregivers/${caregiver1.id}`).send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if caregiver is trying to delete another caregiver', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [caregiver2] = await insertCaregiversAndAddToOrg(org, [caregiverTwo]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      await request(app)
        .delete(`/v1/caregivers/${caregiver2.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 204 if admin is trying to delete another caregiver', async () => {
      const [org] = await insertOrgs([orgOne]);
      const {caregiver, accessToken} = await insertCaregivertoOrgAndReturnToken(org, admin);

      caregiver.patients = [];
      await caregiver.save();

      org.caregivers.push(caregiver);
      await org.save();

      await request(app)
        .delete(`/v1/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);
    });

    test('should return 400 error if caregiverId is not a valid mongo id', async () => {
      const [org] = await insertOrgs([orgOne]);
      const {accessToken} = await insertCaregivertoOrgAndReturnToken(org, admin);

      await request(app)
        .delete('/v1/caregivers/invalidId')
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error if caregiver already is not found', async () => {
      const [org] = await insertOrgs([orgOne]);
      const {accessToken} = await insertCaregivertoOrgAndReturnToken(org, admin);

      await request(app)
        .delete(`/v1/caregivers/${mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('PATCH /v1/caregivers/:caregiverId', () => {
    test('should return 200 and successfully update caregiver if data is ok', async () => {
      const [org] = await insertOrgs([orgOne]);
      const {caregiver, accessToken} = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const updateBody = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'newPassword1',
      };

      const res = await request(app)
        .patch(`/v1/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: caregiver.id,
        name: updateBody.name,
        email: updateBody.email,
        phone: caregiver.phone,
        role: 'staff',
        org: caregiver.org.toHexString(),
        patients: caregiver.patients.toObject(),
        isEmailVerified: false,
      });

      const dbCaregiver = await Caregiver.findById(caregiver.id);
      expect(dbCaregiver).toBeDefined();
      expect(dbCaregiver.password).not.toBe(updateBody.password);
      expect(dbCaregiver).toMatchObject({ name: updateBody.name, email: updateBody.email, role: 'staff' });
    });

    test('should return 401 error if access token is missing', async () => {
      const [caregiver] = await insertCaregivers([caregiverOne]);
      const updateBody = { name: faker.name.findName() };

      await request(app).patch(`/v1/caregivers/${caregiver.id}`).send(updateBody).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 if caregiver is updating another caregiver', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [caregiver2] = await insertCaregiversAndAddToOrg(org, [caregiverTwo]);
      const {accessToken} = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const updateBody = { name: faker.name.findName() };

      await request(app)
        .patch(`/v1/caregivers/${caregiver2.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 200 and successfully update caregiver if admin is updating another caregiver', async () => {
      const [org] = await insertOrgs([orgOne]);
      const [caregiver1] = await insertCaregiversAndAddToOrg(org, [caregiverOne]);
      const {accessToken} = await insertCaregivertoOrgAndReturnToken(org, admin);
      const updateBody = { name: faker.name.findName() };

      await request(app)
        .patch(`/v1/caregivers/${caregiver1.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);
    });

    test('should return 404 if admin is updating another caregiver that is not found', async () => {
      const [org] = await insertOrgs([orgOne]);
      const {accessToken} = await insertCaregivertoOrgAndReturnToken(org, admin);
      const updateBody = { name: faker.name.findName() };

      await request(app)
        .patch(`/v1/caregivers/${mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 400 error if caregiverId is not a valid mongo id', async () => {
      const [org] = await insertOrgs([orgOne]);
      const {accessToken} = await insertCaregivertoOrgAndReturnToken(org, admin);
      const updateBody = { name: faker.name.findName() };

      await request(app)
        .patch(`/v1/caregivers/invalidId`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if email is invalid', async () => {
      const [org] = await insertOrgs([orgOne]);
      const {caregiver, accessToken} = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const updateBody = { email: 'invalidEmail' };

      await request(app)
        .patch(`/v1/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if email is already taken', async () => {
      const [org] = await insertOrgs([orgOne]);
      const {caregiver, accessToken} = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [caregiver2] = await insertCaregivers([caregiverTwo]);
      const updateBody = { email: caregiver2.email };

      await request(app)
        .patch(`/v1/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should not return 400 if email is my email', async () => {
      const [org] = await insertOrgs([orgOne]);
      const {caregiver, accessToken} = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const updateBody = { email: caregiver.email };

      await request(app)
        .patch(`/v1/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);
    });

    test('should return 400 if password length is less than 8 characters', async () => {
      const [org] = await insertOrgs([orgOne]);
      const {caregiver, accessToken} = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const updateBody = { password: 'passwo1' };

      await request(app)
        .patch(`/v1/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if password does not contain both letters and numbers', async () => {
      const [org] = await insertOrgs([orgOne]);
      const {caregiver, accessToken} = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const updateBody = { password: 'password' };

      await request(app)
        .patch(`/v1/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);

      updateBody.password = '11111111';

      await request(app)
        .patch(`/v1/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });
  });
});
