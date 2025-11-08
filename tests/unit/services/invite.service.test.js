// Set test environment variables before importing config
process.env.NODE_ENV = 'test';
process.env.API_BASE_URL = 'http://localhost:3000';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.PORT = '3000';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('../../../src/config/config');
const { emailService, orgService } = require('../../../src/services');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { caregiverOne, password } = require('../../fixtures/caregiver.fixture');
const { Caregiver, Org, Token } = require('../../../src/models');

// Mock i18n
jest.mock('i18n', () => ({
  configure: jest.fn(),
  setLocale: jest.fn(),
  getLocale: jest.fn(() => 'en'),
  __: jest.fn((key, value) => (key === 'inviteEmail.text' ? `Invite link: ${value}` : key)),
  __mf: jest.fn((key) => key),
  __l: jest.fn((key) => key),
  __h: jest.fn((key) => key),
  __n: jest.fn((key) => key),
  getCatalog: jest.fn(() => ({})),
  getLocales: jest.fn(() => ['en']),
  addLocale: jest.fn(),
  removeLocale: jest.fn(),
  init: jest.fn(),
  I18n: jest.fn()
}));

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start(); // Fix: Use start() function instead of new keyword
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('inviteService', () => {
  describe('generateInviteToken', () => {
    afterEach(() => {
      Org.deleteMany();
      Caregiver.deleteMany();
      Token.deleteMany();
    });

    it('should generate an invite token and store it in the database', async () => {
      const [org] = await insertOrgs([orgOne]);

      jest.spyOn(emailService, 'sendInviteEmail').mockImplementation(() => {});

      const { inviteToken } = await orgService.sendInvite(org.id, caregiverOne.name, caregiverOne.email, caregiverOne.phone);

      const caregiver = await Caregiver.findOne({ email: caregiverOne.email });

      expect(caregiver).not.toBeNull();
      expect(caregiver.org.toString()).toEqual(org.id);
      expect(caregiver.name).toEqual(caregiverOne.name);
      expect(caregiver.email).toEqual(caregiverOne.email);
      expect(caregiver.phone).toEqual(caregiverOne.phone);
      expect(caregiver.role).toEqual('invited');

      console.log('Config apiUrl:', config.apiUrl);
      console.log('Config frontendUrl:', config.frontendUrl);
      console.log('Config baseUrl:', config.baseUrl);
      console.log('Environment API_BASE_URL:', process.env.API_BASE_URL);
      console.log('Environment FRONTEND_URL:', process.env.FRONTEND_URL);
      console.log('Environment NODE_ENV:', process.env.NODE_ENV);
      
      const inviteLink = `${config.frontendUrl}/signup?token=${inviteToken}`;
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
