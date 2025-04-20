const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const faker = require('faker');
const httpStatus = require('http-status');
const app = require('../../../src/app');
const { Schedule, Patient, Caregiver } = require('../../../src/models');
const { scheduleService } = require('../../../src/services');
const { scheduleOne, scheduleTwo, insertSchedules } = require('../../fixtures/schedule.fixture');
const { patientOne, insertPatients } = require('../../fixtures/patient.fixture');

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

describe('Schedule Service', () => {
  afterEach(async () => {
    await Caregiver.deleteMany();
    await Patient.deleteMany();
    await Schedule.deleteMany();
  });

  describe('createSchedule', () => {
    test("should create a new schedule and add it to the patient's schedules", async () => {
      const [patient] = await insertPatients([patientOne]);

      const schedule = await scheduleService.createSchedule(patient.id, scheduleOne);

      expect(schedule).toHaveProperty('id');
      expect(schedule.patient.toString()).toEqual(patient.id.toString());

      const updatedPatient = await Patient.findById(patient.id);
      expect(updatedPatient.schedules.map((id) => id.toString())).toContainEqual(schedule.id.toString());
    });
  });

  describe('updateSchedule', () => {
    test('should update schedule details', async () => {
      const [patient] = await insertPatients([patientOne]);
      const schedule = await scheduleService.createSchedule(patient.id, scheduleOne);

      const updateBody = {
        frequency: 'monthly',
        intervals: [{ day: 2, weeks: 2 }],
      };

      const updatedSchedule = await scheduleService.updateSchedule(schedule.id, updateBody);

      expect(updatedSchedule.frequency).toBe('monthly');
      expect(Array.from(updatedSchedule.intervals).map(({ day, weeks }) => ({ day, weeks }))).toEqual([
        { day: 2, weeks: 2 },
      ]);
    });
  });

  describe('deleteSchedule', () => {
    test("should delete a schedule and update the patient's schedule list", async () => {
      const [patient] = await insertPatients([patientOne]);
      const schedule = await scheduleService.createSchedule(patient.id, scheduleOne);

      await scheduleService.deleteSchedule(schedule.id);

      const deletedSchedule = await Schedule.findById(schedule.id);
      const updatedPatient = await Patient.findById(patient.id);

      expect(deletedSchedule).toBeNull();
      expect(updatedPatient.schedules).not.toContainEqual(schedule.id);
    });
  });

  describe('getScheduleById', () => {
    test('should retrieve a schedule by its ID', async () => {
      const [patient] = await insertPatients([patientOne]);
      const schedule = await scheduleService.createSchedule(patient.id, scheduleOne);

      const foundSchedule = await scheduleService.getScheduleById(schedule.id);

      expect(foundSchedule).not.toBeNull();
      expect(foundSchedule.id).toEqual(schedule.id);
    });

    test('should throw an error if schedule is not found', async () => {
      const invalidId = mongoose.Types.ObjectId();

      await expect(scheduleService.getScheduleById(invalidId)).rejects.toThrow('Schedule not found');
    });
  });
});
