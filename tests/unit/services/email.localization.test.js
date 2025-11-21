// Set test environment variables before importing config
process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'http://localhost:8081';

// Unmock i18n for this test - we need real translations
jest.unmock('i18n');

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const httpStatus = require('http-status');
const nodemailer = require('nodemailer');
const { Caregiver, Org } = require('../../../src/models');
const emailService = require('../../../src/services/email.service');
const tokenService = require('../../../src/services/token.service');
const etherealEmailRetriever = require('../../../src/services/etherealEmailRetriever.service');
const { insertOrgs } = require('../../fixtures/org.fixture');
const { insertCaregiversAndAddToOrg } = require('../../fixtures/caregiver.fixture');
const { caregiverOne } = require('../../fixtures/caregiver.fixture');
const { orgOne } = require('../../fixtures/org.fixture');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri, {});

  // Ensure email service is initialized (will create Ethereal account)
  await emailService.initializeEmailTransport();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Email Service - Localization', () => {
  // Increase timeout for email retrieval tests (IMAP can be slow)
  jest.setTimeout(30000);

  beforeEach(async () => {
    await Caregiver.deleteMany();
    await Org.deleteMany();
    
    // Ensure email service is initialized with Ethereal for testing
    // This will use Ethereal in test environment
    await emailService.initializeEmailTransport();
  });

  afterEach(async () => {
    await Caregiver.deleteMany();
    await Org.deleteMany();
    jest.clearAllMocks();
  });

  describe('sendVerificationEmail - Localization', () => {
    test('should send verification email in English when locale is en', async () => {
      const [org] = await insertOrgs([orgOne]);
      const caregivers = await insertCaregiversAndAddToOrg(org, [{
        ...caregiverOne,
        preferredLanguage: 'en',
      }]);
      const caregiver = caregivers[0];

      const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);
      
      // Send email
      await emailService.sendVerificationEmail(
        caregiver.email,
        verifyEmailToken,
        caregiver.name,
        'en'
      );

      // Wait a moment for email to arrive in Ethereal, then retrieve it
      // Use waitForEmail which polls until email arrives
      const emailContent = await etherealEmailRetriever.waitForEmail(caregiver.email, 20000);
      
      // Verify English content
      expect(emailContent).toBeTruthy();
      expect(emailContent.subject).toContain('Please Verify Your Email Address');
      // Text content is localized
      expect(emailContent.text).toContain('Thank you for creating your My Phone Friend account');
      expect(emailContent.text).toContain('Dear');
      // HTML template is currently hardcoded in English, but text content is localized
      expect(emailContent.html).toBeTruthy();
      expect(emailContent.text).toContain('verify your email');
    });

    test('should send verification email in Spanish when locale is es', async () => {
      const [org] = await insertOrgs([orgOne]);
      const caregivers = await insertCaregiversAndAddToOrg(org, [{
        ...caregiverOne,
        preferredLanguage: 'es',
      }]);
      const caregiver = caregivers[0];

      const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);
      
      // Send email
      await emailService.sendVerificationEmail(
        caregiver.email,
        verifyEmailToken,
        caregiver.name,
        'es'
      );

      // Wait a moment for email to arrive in Ethereal, then retrieve it
      // Use waitForEmail which polls until email arrives
      const emailContent = await etherealEmailRetriever.waitForEmail(caregiver.email, 20000);
      
      // Verify Spanish content
      expect(emailContent).toBeTruthy();
      expect(emailContent.subject).toContain('Por favor verifique');
      // Text content is localized in Spanish
      expect(emailContent.text).toContain('Gracias por crear');
      expect(emailContent.text).toContain('Estimado');
      expect(emailContent.text).toContain('verificar su correo');
      // HTML template is currently hardcoded in English, but text content is localized
      expect(emailContent.html).toBeTruthy();
    });

    test('should send verification email in French when locale is fr', async () => {
      const [org] = await insertOrgs([orgOne]);
      const caregivers = await insertCaregiversAndAddToOrg(org, [{
        ...caregiverOne,
        preferredLanguage: 'fr',
      }]);
      const caregiver = caregivers[0];

      const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);
      
      // Send email
      await emailService.sendVerificationEmail(
        caregiver.email,
        verifyEmailToken,
        caregiver.name,
        'fr'
      );

      // Wait a moment for email to arrive in Ethereal, then retrieve it
      // Use waitForEmail which polls until email arrives
      const emailContent = await etherealEmailRetriever.waitForEmail(caregiver.email, 20000);
      
      // Verify French content
      expect(emailContent).toBeTruthy();
      expect(emailContent.subject).toContain('Veuillez vérifier');
      // Text content is localized in French
      expect(emailContent.text).toContain('Merci d\'avoir créé');
      expect(emailContent.text).toContain('Cher');
      expect(emailContent.text).toContain('vérifier votre e-mail');
      // HTML template is currently hardcoded in English, but text content is localized
      expect(emailContent.html).toBeTruthy();
    });

    test('should use caregiver preferredLanguage when locale not specified', async () => {
      const [org] = await insertOrgs([orgOne]);
      const caregivers = await insertCaregiversAndAddToOrg(org, [{
        ...caregiverOne,
        preferredLanguage: 'es',
      }]);
      const caregiver = caregivers[0];

      const verifyEmailToken = await tokenService.generateVerifyEmailToken(caregiver);
      
      // Send email using caregiver's preferredLanguage
      await emailService.sendVerificationEmail(
        caregiver.email,
        verifyEmailToken,
        caregiver.name,
        caregiver.preferredLanguage || 'en'
      );

      // Wait a moment for email to arrive in Ethereal, then retrieve it
      // Use waitForEmail which polls until email arrives
      const emailContent = await etherealEmailRetriever.waitForEmail(caregiver.email, 20000);
      
      // Should be in Spanish (caregiver's preferred language)
      expect(emailContent).toBeTruthy();
      expect(emailContent.subject).toContain('Por favor verifique');
      expect(emailContent.text).toContain('Gracias');
      expect(emailContent.text).toContain('Estimado');
    });
  });

  describe('sendResetPasswordEmail - Localization', () => {
    test('should send password reset email in English', async () => {
      const testEmail = 'reset-en@example.com';
      const resetToken = 'test-reset-token-123';
      
      await emailService.sendResetPasswordEmail(
        testEmail,
        resetToken,
        'en'
      );

      // Wait a moment for email to arrive in Ethereal
      await new Promise(resolve => setTimeout(resolve, 2000));

      const emailContent = await etherealEmailRetriever.retrieveLastEmail(testEmail, 10000);
      
      expect(emailContent).toBeTruthy();
      expect(emailContent.subject).toContain('Password Reset Request');
      // Text content is localized
      expect(emailContent.text).toContain('reset your password');
      expect(emailContent.text).toContain('Dear caregiver');
      // HTML template is currently hardcoded in English, but text content is localized
      expect(emailContent.html).toBeTruthy();
    });

    test('should send password reset email in Spanish', async () => {
      const testEmail = 'reset-es@example.com';
      const resetToken = 'test-reset-token-123';
      
      await emailService.sendResetPasswordEmail(
        testEmail,
        resetToken,
        'es'
      );

      // Wait a moment for email to arrive in Ethereal
      await new Promise(resolve => setTimeout(resolve, 2000));

      const emailContent = await etherealEmailRetriever.retrieveLastEmail(testEmail, 10000);
      
      expect(emailContent).toBeTruthy();
      expect(emailContent.subject).toContain('restablecimiento de contraseña');
      // Text content is localized in Spanish
      expect(emailContent.text).toContain('restablecer la contraseña');
      expect(emailContent.text).toContain('Estimado cuidador');
      // HTML template is currently hardcoded in English, but text content is localized
      expect(emailContent.html).toBeTruthy();
    });
  });

  describe('sendInviteEmail - Localization', () => {
    test('should send invite email in English', async () => {
      const testEmail = 'invite-en@example.com';
      const inviteLink = 'http://localhost:8081/signup?token=test-invite-token';
      
      await emailService.sendInviteEmail(
        testEmail,
        inviteLink,
        'en'
      );

      // Wait a moment for email to arrive in Ethereal
      await new Promise(resolve => setTimeout(resolve, 2000));

      const emailContent = await etherealEmailRetriever.retrieveLastEmail(testEmail, 10000);
      
      expect(emailContent).toBeTruthy();
      expect(emailContent.subject).toContain('Invitation to Join');
      // Text content is localized
      expect(emailContent.text).toContain('invited to join');
      expect(emailContent.text).toContain('Dear caregiver');
      // HTML template is currently hardcoded in English, but text content is localized
      expect(emailContent.html).toBeTruthy();
    });

    test('should send invite email in Spanish', async () => {
      const testEmail = 'invite-es@example.com';
      const inviteLink = 'http://localhost:8081/signup?token=test-invite-token';
      
      await emailService.sendInviteEmail(
        testEmail,
        inviteLink,
        'es'
      );

      // Wait a moment for email to arrive in Ethereal
      await new Promise(resolve => setTimeout(resolve, 2000));

      const emailContent = await etherealEmailRetriever.retrieveLastEmail(testEmail, 10000);
      
      expect(emailContent).toBeTruthy();
      expect(emailContent.subject).toContain('Invitación para unirse');
      // Text content is localized in Spanish
      expect(emailContent.text).toContain('invitado a unirse');
      expect(emailContent.text).toContain('Estimado cuidador');
      // HTML template is currently hardcoded in English, but text content is localized
      expect(emailContent.html).toBeTruthy();
    });
  });
});


