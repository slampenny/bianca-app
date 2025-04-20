const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Schedule } = require('../../../src/models');

describe('Schedule model', () => {
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

  describe('Schedule validation', () => {
    let newSchedule;
    beforeEach(() => {
      newSchedule = {
        patient: new mongoose.Types.ObjectId(),
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '12:00',
        nextCallDate: new Date(),
      };
    });

    test('should correctly validate a valid schedule', async () => {
      await expect(new Schedule(newSchedule).validate()).resolves.toBeUndefined();
    });

    test('should throw a validation error if frequency is invalid', async () => {
      newSchedule.frequency = 'invalidFrequency';
      await expect(new Schedule(newSchedule).validate()).rejects.toThrow();
    });

    test('should throw a validation error if time is invalid', async () => {
      newSchedule.time = 'invalidTime';
      await expect(new Schedule(newSchedule).validate()).rejects.toThrow();
    });
  });

  describe('Schedule calculateNextCallDate()', () => {
    test('should correctly calculate the next call date for a daily schedule', () => {
      const baseDate = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)); // January 1, 2024, 12:00 UTC
      const OriginalDate = Date;
      global.Date = class extends OriginalDate {
        constructor() {
          super();
          return baseDate;
        }
      };

      const newSchedule = {
        patientId: new mongoose.Types.ObjectId(),
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '12:00',
        nextCallDate: new Date(),
      };
      const schedule = new Schedule(newSchedule);
      schedule.calculateNextCallDate();

      const expectedNextCallDate = new Date(Date.UTC(2024, 0, 2, 12, 0, 0)); // January 2, 2024, 12:00 UTC
      expect(schedule.nextCallDate.toISOString()).toEqual(expectedNextCallDate.toISOString());

      global.Date = OriginalDate;
    });

    test('should correctly calculate the next call date for a weekly schedule', () => {
      const baseDate = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)); // January 1, 2024, 12:00 UTC
      const OriginalDate = Date;
      global.Date = class extends OriginalDate {
        constructor() {
          super();
          return baseDate;
        }
      };

      const newSchedule = {
        patientId: new mongoose.Types.ObjectId(),
        frequency: 'weekly',
        intervals: [],
        isActive: true,
        time: '4:00',
        nextCallDate: new Date(),
      };
      const schedule = new Schedule(newSchedule);
      schedule.calculateNextCallDate();

      const expectedNextCallDate = new Date(Date.UTC(2024, 0, 8, 4, 0, 0)); // January 8, 2024, 12:00 UTC
      expect(schedule.nextCallDate.toISOString()).toEqual(expectedNextCallDate.toISOString());

      global.Date = OriginalDate;
    });

    test('should correctly calculate the next call date for a monthly schedule', () => {
      const baseDate = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)); // January 1, 2024, 12:00 UTC
      const OriginalDate = Date;
      global.Date = class extends OriginalDate {
        constructor() {
          super();
          return baseDate;
        }
      };

      const newSchedule = {
        patientId: new mongoose.Types.ObjectId(),
        frequency: 'monthly',
        intervals: [],
        isActive: true,
        time: '8:00',
        nextCallDate: new Date(),
      };
      const schedule = new Schedule(newSchedule);
      schedule.calculateNextCallDate();

      const expectedNextCallDate = new Date(Date.UTC(2024, 1, 1, 12, 0, 0)); // February 1, 2024, 12:00 UTC
      expect(schedule.nextCallDate.toISOString()).toEqual(expectedNextCallDate.toISOString());

      global.Date = OriginalDate;
    });

    test('should correctly calculate the next call date for a weekly schedule with multiple intervals', () => {
      const baseDate = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)); // January 1, 2024, 12:00 UTC
      const OriginalDate = Date;
      global.Date = class extends OriginalDate {
        constructor() {
          super();
          return baseDate;
        }
      };

      const newSchedule = {
        patientId: new mongoose.Types.ObjectId(),
        frequency: 'weekly',
        intervals: [
          { day: 1, weeks: 1 }, // Monday every week
          { day: 3, weeks: 2 }, // Wednesday every two weeks
          { day: 5, weeks: 1 }, // Friday every week
        ],
        isActive: true,
        time: '12:00',
        nextCallDate: new Date(),
      };
      const schedule = new Schedule(newSchedule);
      schedule.calculateNextCallDate();

      const expectedNextCallDate = new Date(Date.UTC(2024, 0, 3, 12, 0, 0)); // January 3, 2024, 12:00 UTC
      expect(schedule.nextCallDate.toISOString()).toEqual(expectedNextCallDate.toISOString());

      global.Date = OriginalDate;
    });

    test('should correctly calculate the next call date for a weekly schedule with multiple intervals where the second interval is the next date', () => {
      const baseDate = new Date(Date.UTC(2024, 0, 1, 12, 0, 0)); // January 1, 2024, 12:00 UTC
      const OriginalDate = Date;
      global.Date = class extends OriginalDate {
        constructor() {
          super();
          return baseDate;
        }
      };

      const newSchedule = {
        patientId: new mongoose.Types.ObjectId(),
        frequency: 'weekly',
        intervals: [
          { day: 1, weeks: 2 }, // Monday every two weeks
          { day: 3, weeks: 1 }, // Wednesday every week
          { day: 5, weeks: 1 }, // Friday every week
        ],
        isActive: true,
        time: '12:00',
        nextCallDate: new Date(),
      };
      const schedule = new Schedule(newSchedule);
      schedule.calculateNextCallDate();

      const expectedNextCallDate = new Date(Date.UTC(2024, 0, 2, 12, 0, 0)); // January 2, 2024, 12:00 UTC
      expect(schedule.nextCallDate.toISOString()).toEqual(expectedNextCallDate.toISOString());

      global.Date = OriginalDate;
    });
  });
});
