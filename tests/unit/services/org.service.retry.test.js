const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const orgService = require('../../../src/services/org.service');
const { Org } = require('../../../src/models');
const httpStatus = require('http-status');
const ApiError = require('../../../src/utils/ApiError');

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

describe('orgService - Call Retry Settings', () => {
  let org;

  beforeEach(async () => {
    await Org.deleteMany({});
    org = await Org.create({
      name: 'Test Org',
      email: 'test@example.com',
    });
  });

  describe('updateCallRetrySettings', () => {
    it('should update retry count', async () => {
      const retrySettings = { retryCount: 3 };
      const updatedOrg = await orgService.updateCallRetrySettings(org._id, retrySettings);

      expect(updatedOrg.callRetrySettings.retryCount).toBe(3);
    });

    it('should update retry interval minutes', async () => {
      const retrySettings = { retryIntervalMinutes: 30 };
      const updatedOrg = await orgService.updateCallRetrySettings(org._id, retrySettings);

      expect(updatedOrg.callRetrySettings.retryIntervalMinutes).toBe(30);
    });

    it('should update alertOnAllMissedCalls', async () => {
      const retrySettings = { alertOnAllMissedCalls: false };
      const updatedOrg = await orgService.updateCallRetrySettings(org._id, retrySettings);

      expect(updatedOrg.callRetrySettings.alertOnAllMissedCalls).toBe(false);
    });

    it('should update all settings at once', async () => {
      const retrySettings = {
        retryCount: 5,
        retryIntervalMinutes: 60,
        alertOnAllMissedCalls: false,
      };
      const updatedOrg = await orgService.updateCallRetrySettings(org._id, retrySettings);

      expect(updatedOrg.callRetrySettings.retryCount).toBe(5);
      expect(updatedOrg.callRetrySettings.retryIntervalMinutes).toBe(60);
      expect(updatedOrg.callRetrySettings.alertOnAllMissedCalls).toBe(false);
    });

    it('should preserve existing settings when updating only one field', async () => {
      // Set initial settings
      org.callRetrySettings = {
        retryCount: 2,
        retryIntervalMinutes: 15,
        alertOnAllMissedCalls: true,
      };
      await org.save();

      // Update only retry count
      const retrySettings = { retryCount: 4 };
      const updatedOrg = await orgService.updateCallRetrySettings(org._id, retrySettings);

      expect(updatedOrg.callRetrySettings.retryCount).toBe(4);
      expect(updatedOrg.callRetrySettings.retryIntervalMinutes).toBe(15);
      expect(updatedOrg.callRetrySettings.alertOnAllMissedCalls).toBe(true);
    });

    it('should throw error for invalid retry count (negative)', async () => {
      const retrySettings = { retryCount: -1 };
      await expect(
        orgService.updateCallRetrySettings(org._id, retrySettings)
      ).rejects.toThrow(ApiError);
    });

    it('should throw error for invalid retry count (too high)', async () => {
      const retrySettings = { retryCount: 11 };
      await expect(
        orgService.updateCallRetrySettings(org._id, retrySettings)
      ).rejects.toThrow(ApiError);
    });

    it('should throw error for invalid retry count (non-integer)', async () => {
      const retrySettings = { retryCount: 2.5 };
      await expect(
        orgService.updateCallRetrySettings(org._id, retrySettings)
      ).rejects.toThrow(ApiError);
    });

    it('should throw error for invalid retry interval (too low)', async () => {
      const retrySettings = { retryIntervalMinutes: 0 };
      await expect(
        orgService.updateCallRetrySettings(org._id, retrySettings)
      ).rejects.toThrow(ApiError);
    });

    it('should throw error for invalid retry interval (too high)', async () => {
      const retrySettings = { retryIntervalMinutes: 1441 };
      await expect(
        orgService.updateCallRetrySettings(org._id, retrySettings)
      ).rejects.toThrow(ApiError);
    });

    it('should throw error for invalid retry interval (non-integer)', async () => {
      const retrySettings = { retryIntervalMinutes: 15.5 };
      await expect(
        orgService.updateCallRetrySettings(org._id, retrySettings)
      ).rejects.toThrow(ApiError);
    });

    it('should throw error if org not found', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const retrySettings = { retryCount: 2 };
      await expect(
        orgService.updateCallRetrySettings(fakeId, retrySettings)
      ).rejects.toThrow(ApiError);
    });

    it('should handle boolean conversion for alertOnAllMissedCalls', async () => {
      const retrySettings = { alertOnAllMissedCalls: 1 }; // Truthy value
      const updatedOrg = await orgService.updateCallRetrySettings(org._id, retrySettings);

      expect(updatedOrg.callRetrySettings.alertOnAllMissedCalls).toBe(true);
    });
  });
});




