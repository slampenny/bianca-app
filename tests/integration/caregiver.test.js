const request = require('supertest');
const faker = require('faker');
const httpStatus = require('http-status');
const app = require('../../src/app');
const setupTestDB = require('../utils/setupTestDB');
const { Caregiver } = require('../../src/models');
const { caregiverOne, caregiverTwo, admin, insertCaregivers } = require('../fixtures/caregiver.fixture');
const { caregiverOneAccessToken, adminAccessToken } = require('../fixtures/token.fixture');

setupTestDB();

describe('Caregiver routes', () => {
  describe('POST /v1/caregivers', () => {
    beforeEach(async () => {
    });

    afterEach(async () => {
      await Caregiver.deleteMany();
    });

    test('should return 201 and successfully create new caregiver if data is ok', async () => {
      await insertCaregivers([admin]);
      const res = await request(app)
        .post('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(caregiverTwo)
        .expect(httpStatus.CREATED);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: expect.anything(),
        name: caregiverTwo.name,
        email: caregiverTwo.email,
        phone: caregiverTwo.phone,
        role: caregiverTwo.role,
        patients: null,
        isEmailVerified: false,
      });

      const dbCaregiver = await Caregiver.findById(res.body.id);
      expect(dbCaregiver).toBeDefined();
      expect(dbCaregiver.password).not.toBe(caregiverTwo.password);
      expect(dbCaregiver).toMatchObject({ name: caregiverTwo.name, email: caregiverTwo.email, role: caregiverTwo.role, isEmailVerified: false });
    });

    test('should be able to create an admin as well', async () => {
      await insertCaregivers([admin]);
      const res = await request(app)
        .post('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(admin)
        .expect(httpStatus.CREATED);

      expect(res.body.role).toBe('admin');

      const dbCaregiver = await Caregiver.findById(res.body.id);
      expect(dbCaregiver.role).toBe('admin');
    });

    test('should return 401 error if access token is missing', async () => {
      await request(app).post('/v1/caregivers').send(caregiverTwo).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if logged in caregiver is not admin', async () => {
      await insertCaregivers([caregiverOne]);
      await request(app)
        .post('/v1/caregivers')
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send(caregiverTwo)
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 400 error if email is invalid', async () => {
      await insertCaregivers([admin]);
      caregiverOne.email = 'invalidEmail';

      await request(app)
        .post('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(caregiverOne)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if email is already used', async () => {
      await insertCaregivers([admin, caregiverOne]);
      caregiverTwo.email = caregiverOne.email;

      await request(app)
        .post('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(caregiverTwo)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password length is less than 8 characters', async () => {
      await insertCaregivers([admin]);
      caregiverTwo.password = 'passwo1';

      await request(app)
        .post('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(caregiverTwo)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if password does not contain both letters and numbers', async () => {
      await insertCaregivers([admin]);
      caregiverTwo.password = 'password';

      await request(app)
        .post('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(caregiverTwo)
        .expect(httpStatus.BAD_REQUEST);

        caregiverTwo.password = '1111111';

      await request(app)
        .post('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(caregiverTwo)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 error if role is neither caregiver nor admin', async () => {
      await insertCaregivers([admin]);
      caregiverTwo.role = 'invalid';

      await request(app)
        .post('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(caregiverTwo)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('GET /v1/caregivers', () => {
    afterEach(async () => {
      await Caregiver.deleteMany();
    });

    test('should return 200 and apply the default query options', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo, admin]);

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
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
        id: caregiverOne._id.toHexString(),
        name: caregiverOne.name,
        email: caregiverOne.email,
        phone: caregiverOne.phone,
        role: caregiverOne.role,
        patients: caregiverOne.patients,
        schedules: caregiverOne.schedules,
        isEmailVerified: false,
      });
    });

    test('should return 401 if access token is missing', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo, admin]);

      await request(app).get('/v1/caregivers').send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 if a non-admin is trying to access all caregivers', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo, admin]);

      await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should correctly apply filter on name field', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo, admin]);

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
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
      expect(res.body.results[0].id).toBe(caregiverOne._id.toHexString());
    });

    test('should correctly apply filter on role field', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo, admin]);

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .query({ role: 'caregiver' })
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
      expect(res.body.results[0].id).toBe(caregiverOne._id.toHexString());
      expect(res.body.results[1].id).toBe(caregiverTwo._id.toHexString());
    });

    test('should correctly sort the returned array if descending sort param is specified', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo, admin]);

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
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
      expect(res.body.results[0].id).toBe(caregiverOne._id.toHexString());
      expect(res.body.results[1].id).toBe(caregiverTwo._id.toHexString());
      expect(res.body.results[2].id).toBe(admin._id.toHexString());
    });

    test('should correctly sort the returned array if ascending sort param is specified', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo, admin]);

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
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
      expect(res.body.results[0].id).toBe(admin._id.toHexString());
      expect(res.body.results[1].id).toBe(caregiverOne._id.toHexString());
      expect(res.body.results[2].id).toBe(caregiverTwo._id.toHexString());
    });

    test('should correctly sort the returned array if multiple sorting criteria are specified', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo, admin]);

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
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

      const expectedOrder = [caregiverOne, caregiverTwo, admin].sort((a, b) => {
        if (a.role < b.role) {
          return 1;
        }
        if (a.role > b.role) {
          return -1;
        }
        return a.name < b.name ? -1 : 1;
      });

      expectedOrder.forEach((caregiver, index) => {
        expect(res.body.results[index].id).toBe(caregiver._id.toHexString());
      });
    });

    test('should limit returned array if limit param is specified', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo, admin]);

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
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
      expect(res.body.results[0].id).toBe(caregiverOne._id.toHexString());
      expect(res.body.results[1].id).toBe(caregiverTwo._id.toHexString());
    });

    test('should return the correct page if page and limit params are specified', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo, admin]);

      const res = await request(app)
        .get('/v1/caregivers')
        .set('Authorization', `Bearer ${adminAccessToken}`)
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
      expect(res.body.results[0].id).toBe(admin._id.toHexString());
    });
  });

  describe('GET /v1/caregivers/:caregiverId', () => {
    afterEach(async () => {
      await Caregiver.deleteMany();
    });
    
    test('should return 200 and the caregiver object if data is ok', async () => {
      await insertCaregivers([caregiverOne]);

      const res = await request(app)
        .get(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: caregiverOne._id.toHexString(),
        email: caregiverOne.email,
        name: caregiverOne.name,
        phone: caregiverOne.phone,
        role: caregiverOne.role,
        caregiver: caregiverOne.caregiver,
        schedules: caregiverOne.schedules,
        isEmailVerified: false,
      });
    });

    test('should return 401 error if access token is missing', async () => {
      await insertCaregivers([caregiverOne]);

      await request(app).get(`/v1/caregivers/${caregiverOne._id}`).send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if caregiver is trying to get another caregiver', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo]);

      await request(app)
        .get(`/v1/caregivers/${caregiverTwo._id}`)
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 200 and the caregiver object if admin is trying to get another caregiver', async () => {
      await insertCaregivers([caregiverOne, admin]);

      await request(app)
        .get(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.OK);
    });

    test('should return 400 error if caregiverId is not a valid mongo id', async () => {
      await insertCaregivers([admin]);

      await request(app)
        .get('/v1/caregivers/invalidId')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error if caregiver is not found', async () => {
      await insertCaregivers([admin]);

      await request(app)
        .get(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('DELETE /v1/caregivers/:caregiverId', () => {
    test('should return 204 if data is ok', async () => {
      await insertCaregivers([caregiverOne]);

      await request(app)
        .delete(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);

      const dbCaregiver = await Caregiver.findById(caregiverOne._id);
      expect(dbCaregiver).toBeNull();
    });

    test('should return 401 error if access token is missing', async () => {
      await insertCaregivers([caregiverOne]);

      await request(app).delete(`/v1/caregivers/${caregiverOne._id}`).send().expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 error if caregiver is trying to delete another caregiver', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo]);

      await request(app)
        .delete(`/v1/caregivers/${caregiverTwo._id}`)
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send()
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 204 if admin is trying to delete another caregiver', async () => {
      await insertCaregivers([caregiverOne, admin]);

      await request(app)
        .delete(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);
    });

    test('should return 400 error if caregiverId is not a valid mongo id', async () => {
      await insertCaregivers([admin]);

      await request(app)
        .delete('/v1/caregivers/invalidId')
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 404 error if caregiver already is not found', async () => {
      await insertCaregivers([admin]);

      await request(app)
        .delete(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send()
        .expect(httpStatus.NOT_FOUND);
    });
  });

  describe('PATCH /v1/caregivers/:caregiverId', () => {
    test('should return 200 and successfully update caregiver if data is ok', async () => {
      await insertCaregivers([caregiverOne]);
      const updateBody = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'newPassword1',
      };

      const res = await request(app)
        .patch(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);

      expect(res.body).not.toHaveProperty('password');
      expect(res.body).toEqual({
        id: caregiverOne._id.toHexString(),
        name: updateBody.name,
        email: updateBody.email,
        phone: caregiverOne.phone,
        role: 'staff',
        patients: caregiverOne.patients,
        schedules: caregiverOne.schedules,
        isEmailVerified: false,
      });

      const dbCaregiver = await Caregiver.findById(caregiverOne._id);
      expect(dbCaregiver).toBeDefined();
      expect(dbCaregiver.password).not.toBe(updateBody.password);
      expect(dbCaregiver).toMatchObject({ name: updateBody.name, email: updateBody.email, role: 'staff' });
    });

    test('should return 401 error if access token is missing', async () => {
      await insertCaregivers([caregiverOne]);
      const updateBody = { name: faker.name.findName() };

      await request(app).patch(`/v1/caregivers/${caregiverOne._id}`).send(updateBody).expect(httpStatus.UNAUTHORIZED);
    });

    test('should return 403 if caregiver is updating another caregiver', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo]);
      const updateBody = { name: faker.name.findName() };

      await request(app)
        .patch(`/v1/caregivers/${caregiverTwo._id}`)
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 200 and successfully update caregiver if admin is updating another caregiver', async () => {
      await insertCaregivers([caregiverOne, admin]);
      const updateBody = { name: faker.name.findName() };

      await request(app)
        .patch(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);
    });

    test('should return 404 if admin is updating another caregiver that is not found', async () => {
      await insertCaregivers([admin]);
      const updateBody = { name: faker.name.findName() };

      await request(app)
        .patch(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.NOT_FOUND);
    });

    test('should return 400 error if caregiverId is not a valid mongo id', async () => {
      await insertCaregivers([admin]);
      const updateBody = { name: faker.name.findName() };

      await request(app)
        .patch(`/v1/caregivers/invalidId`)
        .set('Authorization', `Bearer ${adminAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if email is invalid', async () => {
      await insertCaregivers([caregiverOne]);
      const updateBody = { email: 'invalidEmail' };

      await request(app)
        .patch(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if email is already taken', async () => {
      await insertCaregivers([caregiverOne, caregiverTwo]);
      const updateBody = { email: caregiverTwo.email };

      await request(app)
        .patch(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should not return 400 if email is my email', async () => {
      await insertCaregivers([caregiverOne]);
      const updateBody = { email: caregiverOne.email };

      await request(app)
        .patch(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);
    });

    test('should return 400 if password length is less than 8 characters', async () => {
      await insertCaregivers([caregiverOne]);
      const updateBody = { password: 'passwo1' };

      await request(app)
        .patch(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should return 400 if password does not contain both letters and numbers', async () => {
      await insertCaregivers([caregiverOne]);
      const updateBody = { password: 'password' };

      await request(app)
        .patch(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);

      updateBody.password = '11111111';

      await request(app)
        .patch(`/v1/caregivers/${caregiverOne._id}`)
        .set('Authorization', `Bearer ${caregiverOneAccessToken}`)
        .send(updateBody)
        .expect(httpStatus.BAD_REQUEST);
    });
  });
});
