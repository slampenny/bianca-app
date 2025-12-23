const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const faker = require('faker');
const { Patient, Org } = require('../../../src/models');

describe('Patient model', () => {
  let mongoServer;
  let testOrg;

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri, {});
    
    // Create a test org for patient tests
    testOrg = await Org.create({
      name: 'Test Org',
      email: 'test@example.com',
      country: 'US',
    });
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
        org: testOrg._id, // Required field
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
        org: testOrg._id, // Required field
        caregiver: null,
        schedules: [],
      };
      expect(new Patient(newPatient).toJSON()).not.toHaveProperty('password');
    });
  });

  describe('Patient org requirement', () => {
    test('should require org field', async () => {
      const patientWithoutOrg = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        phone: faker.phone.phoneNumberFormat(1),
        // org is missing
      };
      
      const patient = new Patient(patientWithoutOrg);
      await expect(patient.validate()).rejects.toThrow();
    });

    test('should accept valid org', async () => {
      const patientWithOrg = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        phone: faker.phone.phoneNumberFormat(1),
        org: testOrg._id,
      };
      
      const patient = new Patient(patientWithOrg);
      await expect(patient.validate()).resolves.toBeUndefined();
    });
  });
});
