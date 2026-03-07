const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Patient, Token } = require('../../../src/models');
const patientService = require('../../../src/services/patient.service');
const tokenService = require('../../../src/services/token.service');
const emailService = require('../../../src/services/email.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { patientOne } = require('../../fixtures/patient.fixture');
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
    await Patient.deleteMany();
    await Token.deleteMany();
  });

  describe('sendConsentEmailIfRequired', () => {
    it('should send consent email when org requires patient consent and patient has not consented', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requirePatientConsent: true }]);
      const patientData = { ...patientOne, org: org._id, consented: false };
      const patient = await Patient.create(patientData);

      // Mock email service
      const sendEmailSpy = jest.spyOn(emailService, 'sendPatientConsentRequestEmail').mockResolvedValue();

      await patientService.sendConsentEmailIfRequired(patient);

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      expect(sendEmailSpy).toHaveBeenCalledWith(
        patient.email,
        patient.name,
        org.name,
        expect.stringContaining('/patient/consent?token='),
        patient.preferredLanguage || 'en',
        '1.0'
      );

      // Verify token was created
      const token = await Token.findOne({ client: patient._id, type: tokenTypes.PATIENT_CONSENT });
      expect(token).toBeTruthy();
      expect(token.expires).toBeTruthy();

      sendEmailSpy.mockRestore();
    });

    it('should not send consent email when org does not require patient consent', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requirePatientConsent: false }]);
      const patientData = { ...patientOne, org: org._id, consented: false };
      const patient = await Patient.create(patientData);

      const sendEmailSpy = jest.spyOn(emailService, 'sendPatientConsentRequestEmail').mockResolvedValue();

      await patientService.sendConsentEmailIfRequired(patient);

      expect(sendEmailSpy).not.toHaveBeenCalled();

      sendEmailSpy.mockRestore();
    });

    it('should not send consent email when patient has already consented', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requirePatientConsent: true }]);
      const patientData = { ...patientOne, org: org._id, consented: true };
      const patient = await Patient.create(patientData);

      const sendEmailSpy = jest.spyOn(emailService, 'sendPatientConsentRequestEmail').mockResolvedValue();

      await patientService.sendConsentEmailIfRequired(patient);

      expect(sendEmailSpy).not.toHaveBeenCalled();

      sendEmailSpy.mockRestore();
    });

    it('should handle email sending errors gracefully', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requirePatientConsent: true }]);
      const patientData = { ...patientOne, org: org._id, consented: false };
      const patient = await Patient.create(patientData);

      const sendEmailSpy = jest.spyOn(emailService, 'sendPatientConsentRequestEmail').mockRejectedValue(new Error('Email service error'));

      // Should not throw error
      await expect(patientService.sendConsentEmailIfRequired(patient)).resolves.not.toThrow();

      sendEmailSpy.mockRestore();
    });
  });

  describe('checkPatientConsent', () => {
    it('should return true when org does not require consent', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requirePatientConsent: false }]);
      const patientData = { ...patientOne, org: org._id, consented: false };
      const patient = await Patient.create(patientData);

      const hasConsent = await patientService.checkPatientConsent(patient._id);
      expect(hasConsent).toBe(true);
    });

    it('should return true when org requires consent and patient has consented', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requirePatientConsent: true }]);
      const patientData = { ...patientOne, org: org._id, consented: true };
      const patient = await Patient.create(patientData);

      const hasConsent = await patientService.checkPatientConsent(patient._id);
      expect(hasConsent).toBe(true);
    });

    it('should return false when org requires consent and patient has not consented', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requirePatientConsent: true }]);
      const patientData = { ...patientOne, org: org._id, consented: false };
      const patient = await Patient.create(patientData);

      const hasConsent = await patientService.checkPatientConsent(patient._id);
      expect(hasConsent).toBe(false);
    });

    it('should return false when patient does not exist', async () => {
      const fakePatientId = new mongoose.Types.ObjectId();
      const hasConsent = await patientService.checkPatientConsent(fakePatientId);
      expect(hasConsent).toBe(false);
    });
  });

  describe('verifyConsentToken', () => {
    it('should verify consent token and update patient consent status', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requirePatientConsent: true }]);
      const patientData = { ...patientOne, org: org._id, consented: false };
      const patient = await Patient.create(patientData);

      // Generate consent token
      const consentToken = await tokenService.generatePatientConsentToken(patient);

      // Verify consent
      const result = await patientService.verifyConsentToken(consentToken);

      expect(result.success).toBe(true);
      expect(result.alreadyConsented).toBe(false);
      expect(result.patient).toBeTruthy();

      // Verify patient was updated
      const updatedPatient = await Patient.findById(patient._id);
      expect(updatedPatient.consented).toBe(true);
      expect(updatedPatient.consentedAt).toBeTruthy();
      expect(updatedPatient.consentEmailVersion).toBe('1.0');

      // Verify token was deleted
      const token = await Token.findOne({ client: patient._id, type: tokenTypes.PATIENT_CONSENT });
      expect(token).toBeNull();
    });

    it('should handle already consented patients gracefully', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requirePatientConsent: true }]);
      const patientData = { 
        ...patientOne, 
        org: org._id, 
        consented: true,
        consentedAt: new Date(),
        consentEmailVersion: '1.0'
      };
      const patient = await Patient.create(patientData);

      // Generate consent token (even though already consented)
      const consentToken = await tokenService.generatePatientConsentToken(patient);

      // Verify consent
      const result = await patientService.verifyConsentToken(consentToken);

      expect(result.success).toBe(true);
      expect(result.alreadyConsented).toBe(true);
      expect(result.message).toContain('already provided consent');

      // Verify patient was not changed
      const updatedPatient = await Patient.findById(patient._id);
      expect(updatedPatient.consented).toBe(true);
    });

    it('should throw error for invalid token', async () => {
      await expect(patientService.verifyConsentToken('invalid-token')).rejects.toThrow(ApiError);
    });

    it('should throw error for expired token', async () => {
      const [org] = await insertOrgs([{ ...orgOne, requirePatientConsent: true }]);
      const patientData = { ...patientOne, org: org._id, consented: false };
      const patient = await Patient.create(patientData);

      // Create expired token manually
      const moment = require('moment');
      const expires = moment().subtract(1, 'day'); // Expired yesterday
      const expiredToken = tokenService.generateToken(patient._id, expires, tokenTypes.PATIENT_CONSENT);
      await tokenService.saveToken(expiredToken, null, expires, tokenTypes.PATIENT_CONSENT, false, patient._id);

      await expect(patientService.verifyConsentToken(expiredToken)).rejects.toThrow(ApiError);
    });

    it('should throw error for non-existent patient', async () => {
      const fakePatientId = new mongoose.Types.ObjectId();
      const expires = require('moment')().add(30, 'days');
      const fakeToken = tokenService.generateToken(fakePatientId, expires, tokenTypes.PATIENT_CONSENT);
      await tokenService.saveToken(fakeToken, null, expires, tokenTypes.PATIENT_CONSENT, false, fakePatientId);

      await expect(patientService.verifyConsentToken(fakeToken)).rejects.toThrow(ApiError);
    });
  });
});

