const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Client, Token, ConsentRecord } = require('../../../src/models');
const clientService = require('../../../src/services/client.service');
const privacyService = require('../../../src/services/privacy.service');
const tokenService = require('../../../src/services/token.service');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { clientOne } = require('../../fixtures/client.fixture');
const {
  REQUIRED_CLIENT_CONSENT_PURPOSES,
  CLIENT_CONSENT_VERSION,
  isFullyConsented,
} = require('../../../src/constants/clientConsent.constants');

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

describe('client GDPR consent', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Client.deleteMany();
    await Token.deleteMany();
    await ConsentRecord.deleteMany();
  });

  const createUnconsentedClient = async () => {
    const [org] = await insertOrgs([{ ...orgOne, requireClientConsent: true, country: 'DE' }]);
    const client = await Client.create({ ...clientOne, org: org._id });
    return { org, client };
  };

  const grantPurposes = async (client, purposes) => {
    const consentToken = await tokenService.generateClientConsentToken(client);
    return clientService.verifyConsentToken(consentToken, {
      purposes,
      ipAddress: '203.0.113.10',
      userAgent: 'jest-test-agent',
    });
  };

  it('consented virtual is false until all required purposes are granted', async () => {
    const { client } = await createUnconsentedClient();

    expect(isFullyConsented(client.consentedPurposes)).toBe(false);
    const fresh = await Client.findById(client._id);
    expect(fresh.consented).toBe(false);

    await grantPurposes(client, ['recording', 'transcription', 'aiAnalysis']);

    const partial = await Client.findById(client._id);
    expect(partial.consented).toBe(false);
    expect(partial.consentedPurposes.recording).toBe(true);
    expect(partial.consentedPurposes.familyReports).toBe(false);

    await grantPurposes(partial, ['familyReports']);

    const complete = await Client.findById(client._id);
    expect(complete.consented).toBe(true);
    expect(isFullyConsented(complete.consentedPurposes)).toBe(true);
  });

  it('consent grant creates an append-only ConsentRecord', async () => {
    const { client } = await createUnconsentedClient();

    await grantPurposes(client, ['recording', 'transcription']);

    const records = await ConsentRecord.find({ clientId: client._id, recordType: 'grant' });
    expect(records).toHaveLength(1);
    expect(records[0].purposes).toEqual(expect.arrayContaining(['recording', 'transcription']));
    expect(records[0].purposes).toHaveLength(2);
    expect(records[0].legalBasis).toBe('consent');
    expect(records[0].jurisdiction).toBe('GDPR');
    expect(records[0].consentVersion).toBe(CLIENT_CONSENT_VERSION);
    expect(records[0].explicitConsent.ipAddress).toBe('203.0.113.10');
    expect(records[0].explicitConsent.userAgent).toBe('jest-test-agent');
    expect(records[0].granted).toBe(true);
    expect(records[0].withdrawn).toBe(false);
  });

  it('withdrawal creates a new ConsentRecord and does not mutate the grant record', async () => {
    const { org, client } = await createUnconsentedClient();
    await grantPurposes(client, [...REQUIRED_CLIENT_CONSENT_PURPOSES]);

    const grantRecord = await ConsentRecord.findOne({ clientId: client._id, recordType: 'grant' });
    expect(grantRecord).toBeTruthy();
    const grantId = grantRecord._id;
    const grantCreatedAt = grantRecord.createdAt;

    const caregiver = { role: 'orgAdmin', org: org._id, id: new mongoose.Types.ObjectId() };

    const { record: withdrawalRecord } = await privacyService.withdrawClientConsent(
      {
        clientId: client._id.toString(),
        purposes: ['recording'],
        withdrawalReason: 'Resident requested withdrawal',
      },
      caregiver,
      '203.0.113.11',
      'jest-withdraw-agent'
    );

    expect(withdrawalRecord.recordType).toBe('withdrawal');
    expect(withdrawalRecord.purposes).toEqual(['recording']);
    expect(withdrawalRecord._id.toString()).not.toBe(grantId.toString());

    const grantAfter = await ConsentRecord.findById(grantId);
    expect(grantAfter.granted).toBe(true);
    expect(grantAfter.withdrawn).toBe(false);
    expect(grantAfter.createdAt.getTime()).toBe(grantCreatedAt.getTime());
    expect(grantAfter.purposes).toEqual(expect.arrayContaining(REQUIRED_CLIENT_CONSENT_PURPOSES));

    const updatedClient = await Client.findById(client._id);
    expect(updatedClient.consentedPurposes.recording).toBe(false);
    expect(updatedClient.consented).toBe(false);

    await expect(async () => {
      grantAfter.withdrawn = true;
      await grantAfter.save();
    }).rejects.toThrow(/append-only/i);
  });
});
