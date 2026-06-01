const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const { MongoMemoryServer } = require('mongodb-memory-server');
const config = require('../../../src/config/config');
const { Org, Client, Token, Caregiver } = require('../../../src/models');
const clientService = require('../../../src/services/client.service');
const tokenService = require('../../../src/services/token.service');
const emailService = require('../../../src/services/email.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { clientOne } = require('../../fixtures/client.fixture');
const { admin, insertCaregivers } = require('../../fixtures/caregiver.fixture');
const { tokenTypes } = require('../../../src/config/tokens');
const { buildFamilyDigestEligibility } = require('../../../src/utils/familyDigestEligibility');
const ApiError = require('../../../src/utils/ApiError');
const httpStatus = require('http-status');

let mongoServer;

beforeAll(async () => {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  await mongoose.connect(await mongoServer.getUri(), {});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('clientService - family digest email verification', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Client.deleteMany();
    await Token.deleteMany();
    await Caregiver.deleteMany();
  });

  async function seedClient(overrides = {}) {
    const [org] = await insertOrgs([orgOne]);
    const [caregiver] = await insertCaregivers(
      [{ ...admin, email: `admin-${Date.now()}@example.org`, org: org._id }],
      org
    );
    const client = await Client.create({
      ...clientOne,
      org: org._id,
      consented: true,
      emergencyContact: {
        ...clientOne.emergencyContact,
        email: 'family@test.com',
        familyDigestEmail: { enabled: true, verifiedAt: null, verifiedEmail: null },
      },
      ...overrides,
    });
    return { org, caregiver, client };
  }

  it('requires orgAdmin or superAdmin to send verification email', async () => {
    const { org, client } = await seedClient();
    const [staff] = await insertCaregivers(
      [{ name: 'Staff', email: 'staff@test.com', phone: '+16045624299', role: 'staff', org: org._id }],
      org
    );

    await expect(clientService.sendFamilyDigestEmailVerification(staff, client.id)).rejects.toMatchObject({
      statusCode: httpStatus.FORBIDDEN,
    });
  });

  it('sends verification email and creates scoped token', async () => {
    const { caregiver, client } = await seedClient();
    const sendSpy = jest.spyOn(emailService, 'sendFamilyDigestEmailVerificationEmail').mockResolvedValue();

    const result = await clientService.sendFamilyDigestEmailVerification(caregiver, client.id);

    expect(result.success).toBe(true);
    expect(sendSpy).toHaveBeenCalledWith(
      'family@test.com',
      orgOne.name,
      expect.stringContaining('/family-digest-email/verify?token='),
      'en'
    );

    const tokenDoc = await Token.findOne({ client: client._id, type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY });
    expect(tokenDoc).toBeTruthy();

    sendSpy.mockRestore();
  });

  it('verifies token and sets verifiedAt/verifiedEmail', async () => {
    const { caregiver, client } = await seedClient();
    jest.spyOn(emailService, 'sendFamilyDigestEmailVerificationEmail').mockResolvedValue();
    await clientService.sendFamilyDigestEmailVerification(caregiver, client.id);
    const tokenDoc = await Token.findOne({ client: client._id, type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY });
    expect(tokenDoc).toBeTruthy();

    const result = await clientService.verifyFamilyDigestEmailToken(tokenDoc.token);
    expect(result.success).toBe(true);
    expect(result.alreadyVerified).toBe(false);

    const updated = await Client.findById(client._id);
    expect(updated.emergencyContact.familyDigestEmail.verifiedAt).toBeTruthy();
    expect(updated.emergencyContact.familyDigestEmail.verifiedEmail).toBe('family@test.com');

    const remaining = await Token.find({ client: client._id, type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY });
    expect(remaining).toHaveLength(0);
  });

  it('rejects expired token', async () => {
    const { client } = await seedClient();
    const clientId = client.id;
    const expires = moment().subtract(1, 'minute');
    const payload = {
      sub: clientId,
      email: 'family@test.com',
      iat: moment().unix(),
      exp: expires.unix(),
      type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY,
    };
    const token = jwt.sign(payload, config.jwt.secret);
    await tokenService.saveToken(token, null, expires, tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY, false, clientId);

    await expect(clientService.verifyFamilyDigestEmailToken(token)).rejects.toMatchObject({
      statusCode: httpStatus.UNAUTHORIZED,
    });
  });

  it('rejects token when emergency contact email changed', async () => {
    const { caregiver, client } = await seedClient();
    jest.spyOn(emailService, 'sendFamilyDigestEmailVerificationEmail').mockResolvedValue();
    await clientService.sendFamilyDigestEmailVerification(caregiver, client.id);
    const tokenDoc = await Token.findOne({ client: client._id, type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY });

    await clientService.updateClientById(client.id, {
      emergencyContact: { email: 'other@test.com' },
    });

    await expect(clientService.verifyFamilyDigestEmailToken(tokenDoc.token)).rejects.toMatchObject({
      statusCode: httpStatus.UNAUTHORIZED,
    });
  });

  it('rejects token when client is deleted', async () => {
    const { caregiver, client } = await seedClient();
    jest.spyOn(emailService, 'sendFamilyDigestEmailVerificationEmail').mockResolvedValue();
    await clientService.sendFamilyDigestEmailVerification(caregiver, client.id);
    const tokenDoc = await Token.findOne({ client: client._id, type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY });

    await Client.deleteOne({ _id: client._id });

    await expect(clientService.verifyFamilyDigestEmailToken(tokenDoc.token)).rejects.toMatchObject({
      statusCode: httpStatus.NOT_FOUND,
    });
  });

  it('rejects token when organization is deleted', async () => {
    const { org, caregiver, client } = await seedClient();
    jest.spyOn(emailService, 'sendFamilyDigestEmailVerificationEmail').mockResolvedValue();
    await clientService.sendFamilyDigestEmailVerification(caregiver, client.id);
    const tokenDoc = await Token.findOne({ client: client._id, type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY });

    await Org.deleteOne({ _id: org._id });

    await expect(clientService.verifyFamilyDigestEmailToken(tokenDoc.token)).rejects.toMatchObject({
      statusCode: httpStatus.NOT_FOUND,
    });
  });

  it('passes eligibility only after verification and opt-in', async () => {
    const { caregiver, client } = await seedClient();
    const recipient = {
      name: client.emergencyContact.name,
      relationship: client.emergencyContact.relationship,
      email: client.emergencyContact.email,
    };

    const before = buildFamilyDigestEligibility(client.toObject(), recipient);
    expect(before.ok).toBe(false);
    expect(before.reasons.some((r) => /verified/i.test(r))).toBe(true);

    jest.spyOn(emailService, 'sendFamilyDigestEmailVerificationEmail').mockResolvedValue();
    await clientService.sendFamilyDigestEmailVerification(caregiver, client.id);
    const tokenDoc = await Token.findOne({ client: client._id, type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY });
    await clientService.verifyFamilyDigestEmailToken(tokenDoc.token);

    const updated = await Client.findById(client._id);
    const after = buildFamilyDigestEligibility(updated.toObject(), recipient);
    expect(after.ok).toBe(true);
  });

  it('is single-use — second verify fails after successful verification', async () => {
    const { caregiver, client } = await seedClient();
    jest.spyOn(emailService, 'sendFamilyDigestEmailVerificationEmail').mockResolvedValue();
    await clientService.sendFamilyDigestEmailVerification(caregiver, client.id);
    const tokenDoc = await Token.findOne({ client: client._id, type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY });

    await clientService.verifyFamilyDigestEmailToken(tokenDoc.token);
    await expect(clientService.verifyFamilyDigestEmailToken(tokenDoc.token)).rejects.toBeInstanceOf(ApiError);
  });
});
