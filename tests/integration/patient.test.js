const request = require('supertest');
const faker = require('faker');
const httpStatus = require('http-status');
const app = require('../../src/app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Patient, Token, Caregiver } = require('../../src/models');
const {
  patientOne,
  patientTwo,
  insertPatients,
  insertPatientsAndAddToCaregiver,
} = require('../fixtures/patient.fixture');

const {
  caregiverOne,
  admin,
  insertCaregiverAndReturnToken,
  insertCaregiverAndReturnTokenByRole,
  insertCaregivers,
} = require('../fixtures/caregiver.fixture');

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

describe('Patient routes', () => {
  afterEach(async () => {
    await Caregiver.deleteMany();
    await Patient.deleteMany();
    await Token.deleteMany();
  });

  describe('POST /v1/patients', () => {
    test('should create a new patient and return 201', async () => {
      const { accessToken } = await insertCaregiverAndReturnTokenByRole('orgAdmin');

      const res = await request(app)
        .post('/v1/patients')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(patientOne)
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.any(String),
        org: null,
        name: patientOne.name,
        email: patientOne.email,
        phone: patientOne.phone,
        isEmailVerified: false,
        caregivers: expect.arrayContaining([]),
        schedules: expect.arrayContaining([]),
      });
    });
  });

  describe('GET /v1/patients/:patientId', () => {
    test('should return 200 and a patient if data is ok', async () => {
      const { caregiver, accessToken } = await insertCaregiverAndReturnToken(caregiverOne);
      const [ patient ] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      const res = await request(app)
        .get(`/v1/patients/${patient.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: patient.id,
        org: null,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        org: patient.org.toString(),
        isEmailVerified: patient.isEmailVerified,
        caregivers: expect.arrayContaining([]),
        schedules: expect.arrayContaining([]),
      });
    });
  });

  describe('PATCH /v1/patients/:patientId', () => {
    test('should update a patient and return 200', async () => {
      const { caregiver, accessToken } = await insertCaregiverAndReturnToken(caregiverOne);
      const [ patient ] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      const updateBody = {
        name: 'Updated Name',
        email: faker.internet.email()
      };

      const res = await request(app)
        .patch(`/v1/patients/${patient.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: patient.id,
        org: null,
        name: updateBody.name,
        email: updateBody.email.toLowerCase(),
        phone: patient.phone,
        org: patient.org.toString(),
        isEmailVerified: patient.isEmailVerified,
        caregivers: expect.arrayContaining([]),
        schedules: expect.arrayContaining([]),
      });
    });
  });

  describe('DELETE /v1/patients/:patientId', () => {
    test('should delete a patient and return 204', async () => {
      const { caregiver, accessToken } = await insertCaregiverAndReturnToken(caregiverOne);
      const [ patient ] = await insertPatientsAndAddToCaregiver(caregiver, [patientOne]);

      await request(app)
        .delete(`/v1/patients/${patient.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);
    });
  });

  // Tests for caregiver assignment and removal
  describe('POST /v1/patients/:patientId/caregiver/:caregiverId', () => {
    test('should assign a caregiver to a patient and return 200', async () => {
      const { caregiver, accessToken } = await insertCaregiverAndReturnToken(admin);
      const [ caregiver1 ] = await insertCaregivers([caregiverOne]);
      const [ patient ] = await insertPatientsAndAddToCaregiver(caregiver1, [patientOne]);

      const res = await request(app)
        .post(`/v1/patients/${patient.id}/caregivers/${caregiver.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: patient.id,
        org: patient.org.toString(),
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        isEmailVerified: patient.isEmailVerified,
        caregivers: expect.arrayContaining([caregiver.id]),
        schedules: expect.arrayContaining([]),
      });
    });
  });

  describe('DELETE /v1/patients/:patientId/caregiver/:caregiverId', () => {
    test('should remove a caregiver from a patient and return 200', async () => {
      const { caregiver, accessToken } = await insertCaregiverAndReturnToken(admin);
      const [ caregiver1 ] = await insertCaregivers([caregiverOne]);
      const [ patient ] = await insertPatientsAndAddToCaregiver(caregiver1, [patientOne]);

      const res = await request(app)
        .delete(`/v1/patients/${patient.id}/caregivers/${caregiver1.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: patient.id,
        org: patient.org.toString(),
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        isEmailVerified: patient.isEmailVerified,
        caregivers: expect.arrayContaining([]),
        schedules: expect.arrayContaining([]),
      });
    });
  });
});
