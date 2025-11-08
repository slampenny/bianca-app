const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const faker = require('faker');
const { Org } = require('../../../src/models');

describe('Org Model', () => {
  let newOrg;
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

  beforeEach(() => {
    newOrg = {
      name: faker.company.companyName(),
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.phoneNumberFormat(1),
      isEmailVerified: false,
      caregivers: [new mongoose.Types.ObjectId()],
      admins: [new mongoose.Types.ObjectId()],
    };
  });

  test('should correctly validate a valid org', async () => {
    await expect(new Org(newOrg).validate()).resolves.toBeUndefined();
  });

  test('should throw a validation error if email is invalid', async () => {
    newOrg.email = 'invalidEmail';
    await expect(new Org(newOrg).validate()).rejects.toThrow();
  });

  test('should throw a validation error if phone is invalid', async () => {
    newOrg.phone = 'invalidPhone';
    await expect(new Org(newOrg).validate()).rejects.toThrow();
  });

  test('should correctly check if email is taken', async () => {
    await new Org(newOrg).save();
    const isEmailTaken = await Org.isEmailTaken(newOrg.email, new mongoose.Types.ObjectId());
    expect(isEmailTaken).toBe(true);
    const isEmailTaken2 = await Org.isEmailTaken(faker.internet.email().toLowerCase());
    expect(isEmailTaken2).toBe(false);
  });
});
