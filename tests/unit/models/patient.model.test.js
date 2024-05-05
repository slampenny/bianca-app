const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const faker = require('faker');
const { Patient } = require('../../../src/models');

describe('Patient model', () => {

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

  describe('Patient validation', () => {
    let newPatient;
    beforeEach(() => {
      newPatient = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        isEmailVerified: false,
        caregiver: null,
        schedules: [],
      };
    });

    test('should correctly validate a valid patient', async () => {
      await expect(new Patient(newPatient).validate()).resolves.toBeUndefined();
    });

    test('should throw a validation error if email is invalid', async () => {
      newPatient.email = 'invalidEmail';
      await expect(new Patient(newPatient).validate()).rejects.toThrow();
    });

    test('should throw a validation error if phone is invalid', async () => {
      newPatient.phone = 'invalidPhone';
      await expect(new Patient(newPatient).validate()).rejects.toThrow();
    });
  });

  describe('Patient toJSON()', () => {
    test('should not return patient password when toJSON is called', () => {
      const newPatient = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        isEmailVerified: false,
        caregiver: null,
        schedules: [],
      };
      expect(new Patient(newPatient).toJSON()).not.toHaveProperty('password');
    });
  });
});