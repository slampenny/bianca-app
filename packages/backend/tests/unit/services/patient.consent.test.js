const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Client, Token } = require('../../../src/models');
const patientService = require('../../../src/services/patient.service');
const tokenService = require('../../../src/services/token.service');
const emailService = require('../../../src/services/email.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { clientOne } = require('../../fixtures/client.fixture');
const { tokenTypes } = require('../../../src/config/tokens');
const httpStatus = require('http-status');
const ApiError = require('../../../src/utils/ApiError');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('patientService - Consent Functionality', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Client.deleteMany();
    await Token.deleteMany();
  });

  describe('sendConsentEmailIfRequired', () => {
    it('should send consent email when org requires patient consent and patient has not consented', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      // Mock email service
      const sendEmailSpy = jest.spyOn(emailService, 'sendPatientConsentRequestEmail').mockResolvedValue();

      await patientService.sendConsentEmailIfRequired(client);

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy).toHaveBeenCalledWith(
        client.email,
        client.name,
        org.name,
        expect.stringContaining('/client/consent?token='),
        client.preferredLanguage || 'en',
        '1.0'
      );

      // Verify token was created
      const token = await Token.findOne({ client: client._id, type: tokenTypes.CLIENT_CONSENT });
      expect(token).toBeTruthy();
      expect(token.expires).toBeTruthy();

      sendEmailSpy.mockRestore();
    });

    it('should not send consent email when org does not require patient consent', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: false }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const sendEmailSpy = jest.spyOn(emailService, 'sendPatientConsentRequestEmail').mockResolvedValue();

      await patientService.sendConsentEmailIfRequired(client);

      expect(sendEmailSpy).not.toHaveBeenCalled();

      sendEmailSpy.mockRestore();
    });

    it('should not send consent email when patient has already consented', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: true };
      const client = await Client.create(clientData);

      const sendEmailSpy = jest.spyOn(emailService, 'sendPatientConsentRequestEmail').mockResolvedValue();

      await patientService.sendConsentEmailIfRequired(client);

      expect(sendEmailSpy).not.toHaveBeenCalled();

      sendEmailSpy.mockRestore();
    });

    it('should handle email sending errors gracefully', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const sendEmailSpy = jest.spyOn(emailService, 'sendPatientConsentRequestEmail').mockRejectedValue(new Error('Email service error'));

      // Should not throw error
      await expect(patientService.sendConsentEmailIfRequired(client)).resolves.not.toThrow();

      sendEmailSpy.mockRestore();
    });
  });

  describe('checkPatientConsent', () => {
    it('should return true when org does not require consent', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: false }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const hasConsent = await patientService.checkPatientConsent(client._id);
      expect(hasConsent).toBe(true);
    });

    it('should return true when org requires consent and patient has consented', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: true };
      const client = await Client.create(clientData);

      const hasConsent = await patientService.checkPatientConsent(client._id);
      expect(hasConsent).toBe(true);
    });

    it('should return false when org requires consent and patient has not consented', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      const hasConsent = await patientService.checkPatientConsent(client._id);
      expect(hasConsent).toBe(false);
    });

    it('should return false when patient does not exist', async () => {
      const fakeClientId = new mongoose.Types.ObjectId();
      const hasConsent = await patientService.checkPatientConsent(fakeClientId);
      expect(hasConsent).toBe(false);
    });
  });

  describe('verifyConsentToken', () => {
    it('should verify consent token and update patient consent status', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      // Generate consent token
      const consentToken = await tokenService.generateClientConsentToken(client);

      // Verify consent
      const result = await patientService.verifyConsentToken(consentToken);

      expect(result.success).toBe(true);
      expect(result.alreadyConsented).toBe(false);
      expect(result.client).toBeTruthy();

      // Verify client was updated
      const updatedClient = await Client.findById(client._id);
      expect(updatedClient.consented).toBe(true);
      expect(updatedClient.consentedAt).toBeTruthy();
      expect(updatedClient.consentEmailVersion).toBe('1.0');

      // Verify token was deleted
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

      // Generate consent token (even though already consented)
      const consentToken = await tokenService.generateClientConsentToken(client);

      // Verify consent
      const result = await patientService.verifyConsentToken(consentToken);

      expect(result.success).toBe(true);
      expect(result.alreadyConsented).toBe(true);
      expect(result.message).toContain('already provided consent');

      // Verify client was not changed
      const updatedClient = await Client.findById(client._id);
      expect(updatedClient.consented).toBe(true);
    });

    it('should throw error for invalid token', async () => {
      await expect(patientService.verifyConsentToken('invalid-token')).rejects.toThrow(ApiError);
    });

    it('should throw error for expired token', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true }]);
      const clientData = { ...clientOne, org: org._id, consented: false };
      const client = await Client.create(clientData);

      // Create expired token manually
      const moment = require('moment');
      const expires = moment().subtract(1, 'day'); // Expired yesterday
      const expiredToken = tokenService.generateToken(client._id, expires, tokenTypes.CLIENT_CONSENT);
      await tokenService.saveToken(expiredToken, null, expires, tokenTypes.CLIENT_CONSENT, false, client._id);

      await expect(patientService.verifyConsentToken(expiredToken)).rejects.toThrow(ApiError);
    });

    it('should throw error for non-existent patient', async () => {
      const fakeClientId = new mongoose.Types.ObjectId();
      const expires = require('moment')().add(30, 'days');
      const fakeToken = tokenService.generateToken(fakeClientId, expires, tokenTypes.CLIENT_CONSENT);
      await tokenService.saveToken(fakeToken, null, expires, tokenTypes.CLIENT_CONSENT, false, fakeClientId);

      await expect(patientService.verifyConsentToken(fakeToken)).rejects.toThrow(ApiError);
    });
  });
});

