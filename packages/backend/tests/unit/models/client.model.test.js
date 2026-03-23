const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const faker = require('faker');
const { Client, Org } = require('../../../src/models');

describe('Client model', () => {
  let mongoServer;
  let testOrg;

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri, {});

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

  describe('validation', () => {
    let newClient;
    beforeEach(() => {
      newClient = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        isEmailVerified: false,
        org: testOrg._id,
        caregiver: null,
        schedules: [],
      };
    });

    test('should correctly validate a valid client', async () => {
      await expect(new Client(newClient).validate()).resolves.toBeUndefined();
    });

    test('should throw a validation error if email is invalid', async () => {
      newClient.email = 'invalidEmail';
      await expect(new Client(newClient).validate()).rejects.toThrow();
    });

    test('should throw a validation error if phone is invalid', async () => {
      newClient.phone = 'invalidPhone';
      await expect(new Client(newClient).validate()).rejects.toThrow();
    });
  });

  describe('toJSON()', () => {
    test('should not return password when toJSON is called', () => {
      const newClient = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        phone: faker.phone.phoneNumberFormat(1),
        isEmailVerified: false,
        org: testOrg._id,
        caregiver: null,
        schedules: [],
      };
      expect(new Client(newClient).toJSON()).not.toHaveProperty('password');
    });
  });

  describe('org requirement', () => {
    test('should require org field', async () => {
      const clientWithoutOrg = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        phone: faker.phone.phoneNumberFormat(1),
      };

      const client = new Client(clientWithoutOrg);
      await expect(client.validate()).rejects.toThrow();
    });

    test('should accept valid org', async () => {
      const clientWithOrg = {
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        phone: faker.phone.phoneNumberFormat(1),
        org: testOrg._id,
      };

      const client = new Client(clientWithOrg);
      await expect(client.validate()).resolves.toBeUndefined();
    });
  });
});
