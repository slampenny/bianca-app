const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Client, Token } = require('../../../src/models');
const clientService = require('../../../src/services/client.service');
const tokenService = require('../../../src/services/token.service');
const emailService = require('../../../src/services/email.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { clientOne } = require('../../fixtures/client.fixture');
const { tokenTypes } = require('../../../src/config/tokens');
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

describe('clientService - consent', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Client.deleteMany();
    await Token.deleteMany();
  });

  describe('sendConsentEmailIfRequired', () => {
    it('should send consent email when org requires client consent and client has not consented', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const sendEmailSpy = jest.spyOn(emailService, 'sendClientConsentRequestEmail').mockResolvedValue();

      await clientService.sendConsentEmailIfRequired(client);

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy).toHaveBeenCalledWith(
        client.email,
        client.name,
        org.name,
        expect.stringContaining('/client/consent?token='),
        client.preferredLanguage || 'en',
        '1.0'
      );

      const token = await Token.findOne({ client: client._id, type: tokenTypes.CLIENT_CONSENT });
      expect(token).toBeTruthy();
      expect(token.expires).toBeTruthy();

      sendEmailSpy.mockRestore();
    });

    it('should not send consent email when org does not require client consent', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: false }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const sendEmailSpy = jest.spyOn(emailService, 'sendClientConsentRequestEmail').mockResolvedValue();

      await clientService.sendConsentEmailIfRequired(client);

      expect(sendEmailSpy).not.toHaveBeenCalled();

      sendEmailSpy.mockRestore();
    });

    it('should not send consent email when client has already consented', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: true };
      const client = await Client.create(clientData);

      const sendEmailSpy = jest.spyOn(emailService, 'sendClientConsentRequestEmail').mockResolvedValue();

      await clientService.sendConsentEmailIfRequired(client);

      expect(sendEmailSpy).not.toHaveBeenCalled();

      sendEmailSpy.mockRestore();
    });

    it('should handle email sending errors gracefully', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const sendEmailSpy = jest.spyOn(emailService, 'sendClientConsentRequestEmail').mockRejectedValue(new Error('Email service error'));

      await expect(clientService.sendConsentEmailIfRequired(client)).resolves.not.toThrow();

      sendEmailSpy.mockRestore();
    });
  });

  describe('checkClientConsent', () => {
    it('should return true when org does not require consent', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: false }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const hasConsent = await clientService.checkClientConsent(client._id);
      expect(hasConsent).toBe(true);
    });

    it('should return true when org requires consent and client has consented', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: true };
      const client = await Client.create(clientData);

      const hasConsent = await clientService.checkClientConsent(client._id);
      expect(hasConsent).toBe(true);
    });

    it('should return false when org requires consent and client has not consented', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const hasConsent = await clientService.checkClientConsent(client._id);
      expect(hasConsent).toBe(false);
    });

    it('should return false when client does not exist', async () => {
      const fakeClientId = new mongoose.Types.ObjectId();
      const hasConsent = await clientService.checkClientConsent(fakeClientId);
      expect(hasConsent).toBe(false);
    });
  });

  describe('verifyConsentToken', () => {
    it('should verify consent token and update client consent status', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const consentToken = await tokenService.generateClientConsentToken(client);

      const result = await clientService.verifyConsentToken(consentToken);

      expect(result.success).toBe(true);
      expect(result.alreadyConsented).toBe(false);
      expect(result.client).toBeTruthy();

      const updatedClient = await Client.findById(client._id);
      expect(updatedClient.consented).toBe(true);
      expect(updatedClient.consentedAt).toBeTruthy();
      expect(updatedClient.consentEmailVersion).toBe('1.0');

      const token = await Token.findOne({ client: client._id, type: tokenTypes.CLIENT_CONSENT });
      expect(token).toBeNull();
    });

    it('should handle already consented clients gracefully', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = {
        ...clientOne,
        org: org._id,
        consented: true,
        consentedAt: new Date(),
        consentEmailVersion: '1.0'
      };
      const client = await Client.create(clientData);

      const consentToken = await tokenService.generateClientConsentToken(client);

      const result = await clientService.verifyConsentToken(consentToken);

      expect(result.success).toBe(true);
      expect(result.alreadyConsented).toBe(true);
      expect(result.message).toContain('already provided consent');

      const updatedClient = await Client.findById(client._id);
      expect(updatedClient.consented).toBe(true);
    });

    it('should throw error for invalid token', async () => {
      await expect(clientService.verifyConsentToken('invalid-token')).rejects.toThrow(ApiError);
    });

    it('should throw error for expired token', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const moment = require('moment');
      const expires = moment().subtract(1, 'day');
      const expiredToken = tokenService.generateToken(client._id, expires, tokenTypes.CLIENT_CONSENT);
      await tokenService.saveToken(expiredToken, null, expires, tokenTypes.CLIENT_CONSENT, false, client._id);

      await expect(clientService.verifyConsentToken(expiredToken)).rejects.toThrow(ApiError);
    });

    it('should throw error for non-existent client', async () => {
      const fakeClientId = new mongoose.Types.ObjectId();
      const expires = require('moment')().add(30, 'days');
      const fakeToken = tokenService.generateToken(fakeClientId, expires, tokenTypes.CLIENT_CONSENT);
      await tokenService.saveToken(fakeToken, null, expires, tokenTypes.CLIENT_CONSENT, false, fakeClientId);

      await expect(clientService.verifyConsentToken(fakeToken)).rejects.toThrow(ApiError);
    });
  });
});
