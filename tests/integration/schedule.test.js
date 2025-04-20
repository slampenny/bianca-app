const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../src/app');
const httpStatus = require('http-status');
const { Patient, Token, Caregiver, Schedule, Org } = require('../../src/models');
const { insertOrgs } = require('../fixtures/org.fixture');
const { patientOne, insertPatients } = require('../fixtures/patient.fixture');
const {
  caregiverOne,
  admin,
  insertCaregivertoOrgAndReturnToken,
  insertCaregivertoOrgAndReturnTokenByRole,
} = require('../fixtures/caregiver.fixture');
const { scheduleOne, scheduleTwo, insertScheduleAndAddToPatient } = require('../fixtures/schedule.fixture');

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

describe('Schedule routes', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Caregiver.deleteMany();
    await Patient.deleteMany();
    await Schedule.deleteMany();
    await Token.deleteMany();
  });

  describe('POST /v1/schedules', () => {
    test('should create a new schedule and return 201', async () => {
      const [org] = await insertOrgs([admin]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const [patient] = await insertPatients([patientOne]);

      const res = await request(app)
        .post(`/v1/schedules/patients/${patient.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(scheduleOne)
        .expect(httpStatus.CREATED);

      expect(res.body).toEqual({
        id: expect.any(String),
        caregivers: expect.arrayContaining([]),
        frequency: scheduleOne.frequency,
        intervals: expect.arrayContaining([
          expect.objectContaining({
            day: expect.any(Number),
            weeks: expect.any(Number),
          }),
        ]),
        isActive: true,
        nextCallDate: expect.any(String),
        patient: expect.any(String),
        time: scheduleOne.time,
      });
    });
  });

  describe('GET /v1/schedules/:scheduleId', () => {
    test('should return 200 and a schedule if data is ok', async () => {
      const [org] = await insertOrgs([admin]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [patient] = await insertPatients([patientOne]);
      const schedule = await insertScheduleAndAddToPatient(patient, scheduleOne);

      const res = await request(app)
        .get(`/v1/schedules/${schedule.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: schedule.id,
        caregivers: expect.arrayContaining([]),
        frequency: schedule.frequency,
        intervals: expect.arrayContaining([
          expect.objectContaining({
            day: expect.any(Number),
            weeks: expect.any(Number),
          }),
        ]),
        isActive: schedule.isActive,
        nextCallDate: expect.any(String),
        patient: expect.any(String),
        time: schedule.time,
      });
    });
  });

  describe('PATCH /v1/schedules/:scheduleId', () => {
    test('should update a schedule and return 200', async () => {
      const [org] = await insertOrgs([admin]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [patient] = await insertPatients([patientOne]);
      const schedule = await insertScheduleAndAddToPatient(patient, scheduleOne);

      const updateBody = {
        frequency: scheduleTwo.frequency,
        intervals: scheduleTwo.intervals,
        time: scheduleTwo.time,
      };

      const res = await request(app)
        .patch(`/v1/schedules/${schedule.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateBody)
        .expect(httpStatus.OK);

      expect(res.body).toEqual({
        id: schedule.id,
        caregivers: expect.arrayContaining([]),
        frequency: scheduleTwo.frequency,
        intervals: expect.arrayContaining(scheduleTwo.intervals.map((interval) => expect.objectContaining(interval))),
        isActive: schedule.isActive,
        nextCallDate: expect.any(String),
        patient: expect.any(String),
        time: scheduleTwo.time,
      });
    });
  });

  describe('DELETE /v1/schedules/:scheduleId', () => {
    test('should delete a schedule and return 204', async () => {
      const [org] = await insertOrgs([admin]);
      const { accessToken } = await insertCaregivertoOrgAndReturnToken(org, caregiverOne);
      const [patient] = await insertPatients([patientOne]);
      const schedule = await insertScheduleAndAddToPatient(patient, scheduleOne);

      await request(app)
        .delete(`/v1/schedules/${schedule.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send()
        .expect(httpStatus.NO_CONTENT);
    });
  });
});
