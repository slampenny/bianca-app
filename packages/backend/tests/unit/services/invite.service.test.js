// Set test environment variables before importing config
process.env.NODE_ENV = 'test';
process.env.API_BASE_URL = 'http://localhost:3000';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.PORT = '3000';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock agenda before importing services to prevent connection attempts in tests
jest.mock('../../../src/config/agenda', () => {
  const mockAgenda = {
    on: jest.fn(),
    every: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    define: jest.fn(),
    now: jest.fn(),
    schedule: jest.fn(),
    cancel: jest.fn(),
  };
  return { agenda: mockAgenda };
});
const config = require('../../../src/config/config');
const { emailService, orgService, tokenService } = require('../../../src/services');
const { tokenTypes } = require('../../../src/config/tokens');
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

// Must be set at load time — beforeAll cannot rely on setTimeout inside the hook (default hook timeout is 5s).
jest.setTimeout(60000);

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {});

  // Initialize email service with Ethereal for tests
  if (!emailService.isReady()) {
    await emailService.initializeEmailTransport();
  }
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}, 60000);

describe('inviteService', () => {
  describe('generateInviteToken', () => {
    afterEach(async () => {
      await Org.deleteMany();
      await Caregiver.deleteMany();
      await Token.deleteMany();
    });

    it('should generate an invite token and store it in the database', async () => {
      const [org] = await insertOrgs([orgOne]);

      // Don't mock email - use Ethereal Mail in tests
      // Email service is initialized in beforeAll hook
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
      
      // Don't check mock calls - email is sent via Ethereal Mail
      // Just verify the invite token was generated and caregiver was created
      expect(inviteToken).toBeDefined();
      expect(caregiver).not.toBeNull();
    });

    it('sendSuperAdminInvite creates invited caregiver and super-admin invite token', async () => {
      const [org] = await insertOrgs([orgOne]);
      const email = 'super-invite-test@example.com';
      const { inviteToken, caregiver } = await orgService.sendSuperAdminInvite(
        'Super Invite',
        email,
        caregiverOne.phone,
        null
      );
      expect(inviteToken).toBeDefined();
      expect(caregiver.role).toEqual('invited');
      expect(caregiver.email).toEqual(email);
      expect(caregiver.org.toString()).toEqual(org.id);

      const { inviteKind } = await tokenService.verifyStaffOrSuperAdminInviteToken(inviteToken);
      expect(inviteKind).toEqual('superAdmin');
      const row = await Token.findOne({ token: inviteToken });
      expect(row.type).toEqual(tokenTypes.SUPERADMIN_INVITE);
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
      await expect(orgService.verifyInvite(invalidToken)).rejects.toThrow('Invalid or expired token');
    });

    it('should throw an error if the token is not found in the database', async () => {
      const notFoundToken = 'notFoundToken123';

      await expect(orgService.verifyInvite(notFoundToken)).rejects.toThrow('Invalid or expired token');
    });
  });
});
