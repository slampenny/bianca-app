const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { Org, Client, ConsentRecord } = require('../../../src/models');
const {
  migrateClientConsent,
  LEGACY_CONSENT_VERSION,
  MIGRATION_NOTES,
} = require('../../../src/scripts/migrateClientConsent.lib');
const { REQUIRED_CLIENT_CONSENT_PURPOSES, isFullyConsented } = require('../../../src/constants/clientConsent.constants');
const { orgOne, insertOrgs } = require('../../fixtures/org.fixture');
const { clientOne } = require('../../fixtures/client.fixture');

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

describe('migrateClientConsent', () => {
  afterEach(async () => {
    await Org.deleteMany();
    await Client.deleteMany();
    await ConsentRecord.deleteMany();
  });

  it('is idempotent — second run does not create duplicate records or re-process clients', async () => {
    const [org] = await insertOrgs([{ ...orgOne, country: 'DE' }]);
    const createdAt = new Date('2024-06-01T12:00:00.000Z');
    const consentedAt = new Date('2024-06-15T08:30:00.000Z');

    const insertResult = await Client.collection.insertOne({
      ...clientOne,
      org: org._id,
      consented: true,
      consentedAt,
      createdAt,
      updatedAt: createdAt,
    });

    const first = await migrateClientConsent({ Client, Org, ConsentRecord, logger: { info: jest.fn(), error: jest.fn() } });
    expect(first.processed).toBe(1);
    expect(first.failed).toBe(0);

    const afterFirst = await Client.findById(insertResult.insertedId);
    expect(isFullyConsented(afterFirst.consentedPurposes)).toBe(true);
    REQUIRED_CLIENT_CONSENT_PURPOSES.forEach((purpose) => {
      expect(afterFirst.consentVersionByPurpose[purpose]).toBe(LEGACY_CONSENT_VERSION);
      expect(afterFirst.consentedAtByPurpose[purpose].getTime()).toBe(consentedAt.getTime());
    });

    const recordsAfterFirst = await ConsentRecord.find({
      clientId: insertResult.insertedId,
      notes: MIGRATION_NOTES,
    });
    expect(recordsAfterFirst).toHaveLength(1);
    expect(recordsAfterFirst[0].consentVersion).toBe(LEGACY_CONSENT_VERSION);
    expect(recordsAfterFirst[0].explicitConsent.ipAddress).toBeNull();
    expect(recordsAfterFirst[0].explicitConsent.userAgent).toBeNull();
    expect(recordsAfterFirst[0].jurisdiction).toBe('GDPR');

    const second = await migrateClientConsent({ Client, Org, ConsentRecord, logger: { info: jest.fn(), error: jest.fn() } });
    expect(second.processed).toBe(0);
    expect(second.skipped).toBeGreaterThanOrEqual(1);

    const recordsAfterSecond = await ConsentRecord.find({
      clientId: insertResult.insertedId,
      notes: MIGRATION_NOTES,
    });
    expect(recordsAfterSecond).toHaveLength(1);
  });

  it('does not migrate new GDPR clients with explicit recording=false', async () => {
    const [org] = await insertOrgs([{ ...orgOne, country: 'US' }]);
    await Client.create({ ...clientOne, org: org._id });

    const result = await migrateClientConsent({ Client, Org, ConsentRecord, logger: { info: jest.fn(), error: jest.fn() } });
    expect(result.processed).toBe(0);
    expect(await ConsentRecord.countDocuments()).toBe(0);
  });
});
