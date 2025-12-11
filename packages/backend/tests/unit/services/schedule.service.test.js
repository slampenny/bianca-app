const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const faker = require('faker');
const httpStatus = require('http-status');
const app = require('../../../src/app');
const { Schedule, Patient, Caregiver, Org } = require('../../../src/models');
const { scheduleService } = require('../../../src/services');
const { scheduleOne, scheduleTwo, insertSchedules } = require('../../fixtures/schedule.fixture');
const { patientOne, insertPatients } = require('../../fixtures/patient.fixture');
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

describe('Schedule Service', () => {
  afterEach(async () => {
    await Caregiver.deleteMany();
    await Patient.deleteMany();
    await Schedule.deleteMany();
    await Org.deleteMany();
  });

  describe('createSchedule', () => {
    test("should create a new schedule and add it to the patient's schedules", async () => {
      const [patient] = await insertPatients([patientOne]);

      const schedule = await scheduleService.createSchedule(patient.id, scheduleOne);

      expect(schedule).toHaveProperty('id');
      // schedule.patient is now populated, so check the ID from the populated object
      const patientId = typeof schedule.patient === 'object' ? schedule.patient._id.toString() : schedule.patient.toString();
      expect(patientId).toEqual(patient.id.toString());

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
      const invalidId = new mongoose.Types.ObjectId();

      await expect(scheduleService.getScheduleById(invalidId)).rejects.toThrow('Schedule not found');
    });
  });

  describe('Timezone conversion', () => {
    test('should convert org time to UTC when creating schedule', async () => {
      // Create org with Eastern timezone
      const [org] = await insertOrgs([{ ...orgOne, timezone: 'America/New_York' }]);
      const [patient] = await insertPatients([{ ...patientOne, org: org.id }]);
      
      // Create schedule with 9:00 AM Eastern time
      const scheduleData = {
        frequency: 'daily',
        intervals: [],
        time: '09:00',
        isActive: true,
      };

      const schedule = await scheduleService.createSchedule(patient.id, scheduleData);

      // Time should be stored in UTC (9:00 AM EST = 14:00 UTC or 9:00 AM EDT = 13:00 UTC)
      expect(['13:00', '14:00']).toContain(schedule.time);
    });

    test('should convert org time to UTC when updating schedule', async () => {
      // Create org with Pacific timezone
      const [org] = await insertOrgs([{ ...orgOne, timezone: 'America/Los_Angeles' }]);
      const [patient] = await insertPatients([{ ...patientOne, org: org.id }]);
      
      // Create initial schedule
      const schedule = await scheduleService.createSchedule(patient.id, {
        frequency: 'daily',
        intervals: [],
        time: '09:00',
        isActive: true,
      });

      // Update with new time in org timezone
      const updatedSchedule = await scheduleService.updateSchedule(schedule.id, {
        time: '12:00', // Noon Pacific
      });

      // Should be converted to UTC (12:00 PM PST = 20:00 UTC or 12:00 PM PDT = 19:00 UTC)
      expect(['19:00', '20:00']).toContain(updatedSchedule.time);
    });

    test('should use default timezone (America/New_York) if org has no timezone', async () => {
      // Create org without timezone (should default to America/New_York)
      const [org] = await insertOrgs([orgOne]);
      const [patient] = await insertPatients([{ ...patientOne, org: org.id }]);
      
      const scheduleData = {
        frequency: 'daily',
        intervals: [],
        time: '09:00',
        isActive: true,
      };

      const schedule = await scheduleService.createSchedule(patient.id, scheduleData);

      // Should still convert using default timezone
      expect(['13:00', '14:00']).toContain(schedule.time);
    });

    test('should handle different timezones correctly', async () => {
      const timezones = [
        { tz: 'America/New_York', orgTime: '09:00', expectedUTC: ['13:00', '14:00'] },
        { tz: 'America/Los_Angeles', orgTime: '09:00', expectedUTC: ['16:00', '17:00'] },
        { tz: 'Europe/London', orgTime: '09:00', expectedUTC: ['08:00', '09:00'] },
        { tz: 'Asia/Tokyo', orgTime: '09:00', expectedUTC: ['00:00'] },
      ];

      for (const { tz, orgTime, expectedUTC } of timezones) {
        const [org] = await insertOrgs([{ ...orgOne, timezone: tz }]);
        const [patient] = await insertPatients([{ ...patientOne, org: org.id }]);
        
        const schedule = await scheduleService.createSchedule(patient.id, {
          frequency: 'daily',
          intervals: [],
          time: orgTime,
          isActive: true,
        });

        expect(expectedUTC).toContain(schedule.time);
        
        // Cleanup
        await Schedule.deleteMany();
        await Patient.deleteMany();
        await Org.deleteMany();
      }
    });

    test('should populate patient.org when creating schedule', async () => {
      const [org] = await insertOrgs([{ ...orgOne, timezone: 'America/New_York' }]);
      const [patient] = await insertPatients([{ ...patientOne, org: org.id }]);
      
      const schedule = await scheduleService.createSchedule(patient.id, {
        frequency: 'daily',
        intervals: [],
        time: '09:00',
        isActive: true,
      });

      // Schedule should have patient populated with org
      expect(schedule.patient).toBeDefined();
      expect(schedule.patient.org).toBeDefined();
      expect(schedule.patient.org.timezone).toBe('America/New_York');
    });

    test('should populate patient.org when getting schedule by ID', async () => {
      const [org] = await insertOrgs([{ ...orgOne, timezone: 'America/Chicago' }]);
      const [patient] = await insertPatients([{ ...patientOne, org: org.id }]);
      
      const schedule = await scheduleService.createSchedule(patient.id, {
        frequency: 'daily',
        intervals: [],
        time: '09:00',
        isActive: true,
      });

      const foundSchedule = await scheduleService.getScheduleById(schedule.id);

      expect(foundSchedule.patient).toBeDefined();
      expect(foundSchedule.patient.org).toBeDefined();
      expect(foundSchedule.patient.org.timezone).toBe('America/Chicago');
    });
  });
});
