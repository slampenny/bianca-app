const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('../../../src/config/config');
const { emailService, orgService } = require('../../../src/services');
const {
  orgOne,
  insertOrgs,
} = require('../../fixtures/org.fixture');
const {
  caregiverOne,
  password
} = require('../../fixtures/caregiver.fixture');
const { Caregiver, Org, Token } = require('../../../src/models');

// Mock i18n
jest.mock('i18n', () => ({
  __: jest.fn((key, value) => key === 'inviteEmail.text' ? `Invite link: ${value}` : key),
}));

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start(); // Fix: Use start() function instead of new keyword
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe ('inviteService', () => {
  describe('generateInviteToken', () => {
    afterEach(() => {
      Org.deleteMany();
      Caregiver.deleteMany();
      Token.deleteMany();
    });

    it('should generate an invite token and store it in the database', async () => {
      const [org] = await insertOrgs([orgOne]);

      jest.spyOn(emailService, 'sendInviteEmail').mockImplementation(() => {});

      const {inviteToken} = await orgService.sendInvite(org.id, caregiverOne.name, caregiverOne.email, caregiverOne.phone);

      const caregiver = await Caregiver.findOne({ email: caregiverOne.email });

      expect(caregiver).not.toBeNull();
      expect(caregiver.org.toString()).toEqual(org.id);
      expect(caregiver.name).toEqual(caregiverOne.name);
      expect(caregiver.email).toEqual(caregiverOne.email);
      expect(caregiver.phone).toEqual(caregiverOne.phone);
      expect(caregiver.role).toEqual('invited');
      
      const inviteLink = `${config.apiUrl}/signup?token=${inviteToken}`;
      expect(emailService.sendInviteEmail).toHaveBeenCalledWith(caregiverOne.email, inviteLink);
    });
  });

  describe('verifyInviteToken', () => {
    // it('should verify the token and return the payload if valid and exists in the database', async () => {
    //   const [org] = await insertOrgs([orgOne]);

    //   const inviteToken = await orgService.sendInvite(org.id, caregiverOne.name, caregiverOne.email, caregiverOne.phone);

    //   const caregiver = await orgService.verifyInvite(inviteToken, {password});

    //   expect(caregiver).not.toBeNull();
    //   expect(caregiver.org.toString()).toEqual(org.id);
    //   expect(caregiver.name).toEqual(caregiverOne.name);
    //   expect(caregiver.email).toEqual(caregiverOne.email);
    //   expect(caregiver.phone).toEqual(caregiverOne.phone);
    //   expect(caregiver.role).toEqual('staff');
    // });

    it('should throw an error if the token is invalid', async () => {
      const invalidToken = 'invalidToken123';
      await expect(orgService.verifyInvite(invalidToken)).rejects.toThrow('Invalid or expired invite token');
    });

    it('should throw an error if the token is not found in the database', async () => {
      const notFoundToken = 'notFoundToken123';

      await expect(orgService.verifyInvite(notFoundToken)).rejects.toThrow('Invalid or expired invite token');
    });
  });
});
