const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org } = require('../../../src/models');

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

describe('Org Model - Call Retry Settings', () => {
  beforeEach(async () => {
    await Org.deleteMany({});
  });

  it('should create org with default retry settings', async () => {
    const org = await Org.create({
      name: 'Test Org',
      email: 'test@example.com',
    });

    expect(org.callRetrySettings).toBeDefined();
    expect(org.callRetrySettings.retryCount).toBe(2);
    expect(org.callRetrySettings.retryIntervalMinutes).toBe(15);
    expect(org.callRetrySettings.alertOnAllMissedCalls).toBe(true);
  });

  it('should allow custom retry settings', async () => {
    const org = await Org.create({
      name: 'Test Org',
      email: 'test@example.com',
      callRetrySettings: {
        retryCount: 5,
        retryIntervalMinutes: 30,
        alertOnAllMissedCalls: false,
      },
    });

    expect(org.callRetrySettings.retryCount).toBe(5);
    expect(org.callRetrySettings.retryIntervalMinutes).toBe(30);
    expect(org.callRetrySettings.alertOnAllMissedCalls).toBe(false);
  });

  it('should enforce retryCount minimum of 0', async () => {
    const org = new Org({
      name: 'Test Org',
      email: 'test@example.com',
      callRetrySettings: {
        retryCount: -1,
      },
    });

    await expect(org.save()).rejects.toThrow();
  });

  it('should enforce retryCount maximum of 10', async () => {
    const org = new Org({
      name: 'Test Org',
      email: 'test@example.com',
      callRetrySettings: {
        retryCount: 11,
      },
    });

    await expect(org.save()).rejects.toThrow();
  });

  it('should enforce retryIntervalMinutes minimum of 1', async () => {
    const org = new Org({
      name: 'Test Org',
      email: 'test@example.com',
      callRetrySettings: {
        retryIntervalMinutes: 0,
      },
    });

    await expect(org.save()).rejects.toThrow();
  });

  it('should enforce retryIntervalMinutes maximum of 1440', async () => {
    const org = new Org({
      name: 'Test Org',
      email: 'test@example.com',
      callRetrySettings: {
        retryIntervalMinutes: 1441,
      },
    });

    await expect(org.save()).rejects.toThrow();
  });

  it('should validate retryCount is an integer', async () => {
    const org = new Org({
      name: 'Test Org',
      email: 'test@example.com',
      callRetrySettings: {
        retryCount: 2.5,
      },
    });

    await expect(org.save()).rejects.toThrow();
  });

  it('should validate retryIntervalMinutes is an integer', async () => {
    const org = new Org({
      name: 'Test Org',
      email: 'test@example.com',
      callRetrySettings: {
        retryIntervalMinutes: 15.5,
      },
    });

    await expect(org.save()).rejects.toThrow();
  });

  it('should allow updating retry settings', async () => {
    const org = await Org.create({
      name: 'Test Org',
      email: 'test@example.com',
    });

    org.callRetrySettings.retryCount = 3;
    org.callRetrySettings.retryIntervalMinutes = 20;
    org.callRetrySettings.alertOnAllMissedCalls = false;
    await org.save();

    const updatedOrg = await Org.findById(org._id);
    expect(updatedOrg.callRetrySettings.retryCount).toBe(3);
    expect(updatedOrg.callRetrySettings.retryIntervalMinutes).toBe(20);
    expect(updatedOrg.callRetrySettings.alertOnAllMissedCalls).toBe(false);
  });
});




