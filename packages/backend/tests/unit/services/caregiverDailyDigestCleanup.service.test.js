jest.mock('../../../src/services/email.service', () => ({
  sendEmail: jest.fn(),
}));

const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const i18n = require('i18n');

i18n.configure({
  locales: ['en'],
  directory: path.join(__dirname, '../../../src/locales'),
  defaultLocale: 'en',
  updateFiles: false,
  objectNotation: true,
  logWarnFn() {},
});

const digestCleanup = require('../../../src/services/caregiverDailyDigestCleanup.service');
const dataDeletionService = require('../../../src/services/dataDeletion.service');
const clientService = require('../../../src/services/client.service');
const caregiverService = require('../../../src/services/caregiver.service');
const orgService = require('../../../src/services/org.service');
const {
  createOrUpdateDigest,
  sendDigest,
  queryDigests,
  getDigestById,
  hashPayload,
} = require('../../../src/services/caregiverDailyDigest.service');
const { startOfOrgLocalDay } = require('../../../src/utils/digestDay.utils');
const { Caregiver, Client, Org, Call, Conversation, CaregiverDailyDigest } = require('../../../src/models');
const emailService = require('../../../src/services/email.service');

const samplePayload = (clientId, clientName = 'Resident One') => ({
  version: 1,
  title: 'Daily care digest',
  subtitle: 'Test Org',
  dateLabel: 'Sunday, June 1, 2026',
  digestDateUtc: '2026-06-01T00:00:00.000Z',
  labels: { conversationSummary: 'Summary' },
  entries: [
    {
      clientId: String(clientId),
      clientName,
      conversationSummaryShort: 'Resident felt well today.',
      sentiment: { overallSentiment: 'positive' },
      callsPlaced: 1,
      answeredCalls: 1,
    },
  ],
  generatedAt: new Date().toISOString(),
});

describe('caregiverDailyDigestCleanup.service', () => {
  let mongoServer;
  let org;
  let caregiver;
  let client;
  let requester;

  beforeAll(async () => {
    jest.setTimeout(60000);
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    emailService.sendEmail.mockResolvedValue({ messageId: 'msg-cleanup-test', provider: 'capture' });

    await CaregiverDailyDigest.deleteMany({});
    await Conversation.deleteMany({});
    await Call.deleteMany({});
    await Client.deleteMany({});
    await Caregiver.deleteMany({});
    await Org.deleteMany({});

    org = await Org.create({ name: 'Test Org', email: 'org@test.com', country: 'CA' });
    caregiver = await Caregiver.create({
      name: 'Staff User',
      email: 'staff@test.com',
      phone: '+16045624263',
      password: 'Password1',
      role: 'staff',
      isEmailVerified: true,
      isPhoneVerified: true,
      org: org._id,
      clients: [],
    });
    client = await Client.create({
      name: 'Resident One',
      email: 'resident@test.com',
      phone: '+16045624264',
      org: org._id,
      caregivers: [caregiver._id],
    });
    caregiver.clients = [client._id];
    await caregiver.save();

    requester = {
      id: caregiver._id.toString(),
      _id: caregiver._id,
      role: 'staff',
      org: org._id,
    };
  });

  const seedCallAndConversation = async () => {
    const call = await Call.create({
      callSid: `CA${Date.now()}`,
      clientId: client._id,
      status: 'completed',
      callOutcome: 'answered',
      duration: 120,
      startTime: new Date('2026-06-01T14:00:00.000Z'),
    });
    await Conversation.create({
      callId: call._id,
      clientId: client._id,
      summary: 'Resident felt well today.',
      history: 'Resident felt well today.',
      analyzedData: { sentiment: { overallSentiment: 'positive' } },
    });
    return call;
  };

  const createSentDigest = async () => {
    await seedCallAndConversation();
    const draft = await createOrUpdateDigest(requester, '2026-06-01T12:00:00.000Z');
    return sendDigest(requester, draft.id);
  };

  describe('client deletion cleanup', () => {
    it('redacts sent digest PHI when client is deleted via clientService', async () => {
      const sent = await createSentDigest();
      expect(sent.payload.entries[0].clientName).toBe('Resident One');

      await clientService.deleteClientById(client._id);

      const reloaded = await CaregiverDailyDigest.findById(sent._id);
      expect(reloaded.phiRedactedAt).toBeTruthy();
      expect(reloaded.phiRedactedReason).toBe('client_deleted');
      expect(reloaded.payload.phiRedacted).toBe(true);
      expect(reloaded.payload.entries).toEqual([]);
      expect(reloaded.sentAt).toBeTruthy();
      expect(reloaded.sentPayloadHash).toBeTruthy();
      expect(reloaded.emailMessageId).toBe('msg-cleanup-test');
      expect(reloaded.payloadHash).not.toBe(reloaded.sentPayloadHash);
      expect(reloaded.payloadHash).toBe(hashPayload(reloaded.payload));
    });

    it('deletes draft digest when sole client entry is removed', async () => {
      const digestDate = startOfOrgLocalDay('America/Los_Angeles', '2026-06-01');
      const draft = await CaregiverDailyDigest.create({
        org: org._id,
        caregiver: caregiver._id,
        digestDate,
        version: 1,
        status: 'draft',
        payload: samplePayload(client._id),
        payloadHash: 'draft-hash',
      });

      await digestCleanup.cleanupDigestsForClient(client._id, 'client_deleted');

      expect(await CaregiverDailyDigest.findById(draft._id)).toBeNull();
    });

    it('strips one client from multi-client sent digest while preserving audit metadata', async () => {
      const clientTwo = await Client.create({
        name: 'Resident Two',
        email: 'resident2@test.com',
        phone: '+16045624265',
        org: org._id,
        caregivers: [caregiver._id],
      });
      const digestDate = startOfOrgLocalDay('America/Los_Angeles', '2026-06-01');
      const sent = await CaregiverDailyDigest.create({
        org: org._id,
        caregiver: caregiver._id,
        digestDate,
        version: 1,
        status: 'sent',
        sentAt: new Date(),
        sentPayloadHash: 'original-sent-hash',
        emailMessageId: 'msg-multi',
        payload: {
          ...samplePayload(client._id, 'Resident One'),
          entries: [
            samplePayload(client._id).entries[0],
            {
              clientId: String(clientTwo._id),
              clientName: 'Resident Two',
              conversationSummaryShort: 'Second resident summary.',
              callsPlaced: 1,
              answeredCalls: 1,
            },
          ],
        },
      });

      await digestCleanup.cleanupDigestsForClient(client._id, 'client_deleted');

      const reloaded = await CaregiverDailyDigest.findById(sent._id);
      expect(reloaded.phiRedactedAt).toBeNull();
      expect(reloaded.phiRedactedReason).toBeNull();
      expect(reloaded.payload.phiRedacted).toBeUndefined();
      expect(reloaded.payload.entries).toHaveLength(1);
      expect(reloaded.payload.entries[0].clientId).toBe(String(clientTwo._id));
      expect(reloaded.sentPayloadHash).toBe('original-sent-hash');
      expect(reloaded.payloadHash).not.toBe('original-sent-hash');
      expect(reloaded.payloadHash).toBe(hashPayload(reloaded.payload));
    });

    it('allows subsequent cleanup of remaining clients after partial strip', async () => {
      const clientTwo = await Client.create({
        name: 'Resident Two',
        email: 'resident2@test.com',
        phone: '+16045624265',
        org: org._id,
        caregivers: [caregiver._id],
      });
      const digestDate = startOfOrgLocalDay('America/Los_Angeles', '2026-06-01');
      const sent = await CaregiverDailyDigest.create({
        org: org._id,
        caregiver: caregiver._id,
        digestDate,
        version: 1,
        status: 'sent',
        sentAt: new Date(),
        sentPayloadHash: 'original-sent-hash',
        payload: {
          ...samplePayload(client._id, 'Resident One'),
          entries: [
            samplePayload(client._id).entries[0],
            {
              clientId: String(clientTwo._id),
              clientName: 'Resident Two',
              conversationSummaryShort: 'Second resident summary.',
              callsPlaced: 1,
              answeredCalls: 1,
            },
          ],
        },
      });

      await digestCleanup.cleanupDigestsForClient(client._id, 'client_deleted');
      await digestCleanup.cleanupDigestsForClient(clientTwo._id, 'client_deleted');

      const reloaded = await CaregiverDailyDigest.findById(sent._id);
      expect(reloaded.phiRedactedAt).toBeTruthy();
      expect(reloaded.phiRedactedReason).toBe('client_deleted');
      expect(reloaded.payload.phiRedacted).toBe(true);
      expect(reloaded.payload.entries).toEqual([]);
    });
  });

  describe('caregiver deletion cleanup', () => {
    it('redacts sent digests and deletes drafts when caregiver is deleted', async () => {
      const sent = await createSentDigest();
      const digestDate = startOfOrgLocalDay('America/Los_Angeles', '2026-06-02');
      const draft = await CaregiverDailyDigest.create({
        org: org._id,
        caregiver: caregiver._id,
        digestDate,
        version: 1,
        status: 'draft',
        payload: samplePayload(client._id),
      });

      await caregiverService.deleteCaregiverById(caregiver._id);

      const reloadedSent = await CaregiverDailyDigest.findById(sent._id);
      expect(reloadedSent.phiRedactedReason).toBe('caregiver_deleted');
      expect(reloadedSent.payload.phiRedacted).toBe(true);
      expect(reloadedSent.emailRecipient).toBeNull();
      expect(await CaregiverDailyDigest.findById(draft._id)).toBeNull();
    });
  });

  describe('org deletion cleanup', () => {
    it('anonymizes sent digests and deletes drafts when org is deleted', async () => {
      const sent = await createSentDigest();
      const digestDate = startOfOrgLocalDay('America/Los_Angeles', '2026-06-02');
      const draft = await CaregiverDailyDigest.create({
        org: org._id,
        caregiver: caregiver._id,
        digestDate,
        version: 1,
        status: 'draft',
        payload: samplePayload(client._id),
      });

      await orgService.deleteOrgById(org._id);

      const reloadedSent = await CaregiverDailyDigest.findById(sent._id);
      expect(reloadedSent).toBeTruthy();
      expect(reloadedSent.phiRedactedReason).toBe('org_deleted');
      expect(reloadedSent.payload.phiRedacted).toBe(true);
      expect(reloadedSent.emailRecipient).toBeNull();
      expect(await CaregiverDailyDigest.findById(draft._id)).toBeNull();
    });
  });

  describe('erasure request cleanup', () => {
    it('redacts digest PHI when caregiver requests conversation erasure', async () => {
      const sent = await createSentDigest();

      const result = await dataDeletionService.handleDeletionRequest(caregiver._id, 'conversations');

      expect(result.deleted.dailyDigests.redacted).toBeGreaterThanOrEqual(1);
      const reloaded = await CaregiverDailyDigest.findById(sent._id);
      expect(reloaded.phiRedactedReason).toBe('erasure_request');
      expect(reloaded.payload.phiRedacted).toBe(true);
      expect(reloaded.sentPayloadHash).toBeTruthy();
    });
  });

  describe('API compatibility after redaction', () => {
    it('list and detail endpoints return redacted digests without error', async () => {
      const sent = await createSentDigest();
      await clientService.deleteClientById(client._id);

      const listed = await queryDigests(requester, {}, { limit: 10, page: 1 });
      expect(listed.results).toHaveLength(1);
      expect(listed.results[0].payload.phiRedacted).toBe(true);

      const detail = await getDigestById(requester, sent.id);
      expect(detail.payload.entries).toEqual([]);
      expect(detail.phiRedactedAt).toBeTruthy();
    });

    it('redaction preserves legacy digestDateUtc field name on sent payloads', async () => {
      const digestDate = startOfOrgLocalDay('America/Los_Angeles', '2026-06-01');
      const sent = await CaregiverDailyDigest.create({
        org: org._id,
        caregiver: caregiver._id,
        digestDate,
        version: 1,
        status: 'sent',
        sentAt: new Date(),
        sentPayloadHash: 'legacy-sent-hash',
        payload: samplePayload(client._id),
      });

      await clientService.deleteClientById(client._id);

      const reloaded = await CaregiverDailyDigest.findById(sent._id);
      expect(reloaded.payload.digestDateUtc).toBe('2026-06-01T00:00:00.000Z');
      expect(reloaded.payload.digestDayStartIso).toBeUndefined();
    });
  });

  describe('retention-window cleanup', () => {
    it('redacts sent digests and deletes drafts past conversation retention for CA orgs', async () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 6);

      const sent = await CaregiverDailyDigest.create({
        org: org._id,
        caregiver: caregiver._id,
        digestDate: oldDate,
        version: 1,
        status: 'sent',
        sentAt: oldDate,
        sentPayloadHash: 'old-sent-hash',
        emailRecipient: 'staff@test.com',
        payload: samplePayload(client._id),
      });
      const draft = await CaregiverDailyDigest.create({
        org: org._id,
        caregiver: caregiver._id,
        digestDate: oldDate,
        version: 2,
        status: 'draft',
        payload: samplePayload(client._id),
      });

      const stats = await dataDeletionService.deleteExpiredDigests('CA');

      expect(stats.redacted).toBe(1);
      expect(stats.deleted).toBe(1);

      const reloadedSent = await CaregiverDailyDigest.findById(sent._id);
      expect(reloadedSent.phiRedactedReason).toBe('retention_expired');
      expect(reloadedSent.payload.phiRedacted).toBe(true);
      expect(reloadedSent.sentPayloadHash).toBe('old-sent-hash');
      expect(await CaregiverDailyDigest.findById(draft._id)).toBeNull();
    });

    it('skips digest redaction for HIPAA (US) orgs', async () => {
      await Org.findByIdAndUpdate(org._id, { country: 'US' });
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 6);

      const sent = await CaregiverDailyDigest.create({
        org: org._id,
        caregiver: caregiver._id,
        digestDate: oldDate,
        version: 1,
        status: 'sent',
        sentAt: oldDate,
        payload: samplePayload(client._id),
      });

      const stats = await dataDeletionService.deleteExpiredDigests('US');

      expect(stats.redacted).toBe(0);
      expect(stats.deleted).toBe(0);

      const reloaded = await CaregiverDailyDigest.findById(sent._id);
      expect(reloaded.phiRedactedAt).toBeNull();
      expect(reloaded.payload.entries[0].clientName).toBe('Resident One');
    });
  });

  describe('orphaned digest cleanup', () => {
    it('redacts sent digest when caregiver is soft-deleted without service hook', async () => {
      const sent = await CaregiverDailyDigest.create({
        org: org._id,
        caregiver: caregiver._id,
        digestDate: startOfOrgLocalDay('America/Los_Angeles', '2026-06-01'),
        version: 1,
        status: 'sent',
        sentAt: new Date(),
        sentPayloadHash: 'orphan-hash',
        payload: samplePayload(client._id),
      });

      await caregiver.delete();

      const stats = await digestCleanup.cleanupOrphanedDigests('CA');

      expect(stats.redacted).toBe(1);
      const reloaded = await CaregiverDailyDigest.findById(sent._id);
      expect(reloaded.phiRedactedReason).toBe('orphaned');
      expect(reloaded.payload.phiRedacted).toBe(true);
    });

    it('strips entries referencing hard-deleted clients', async () => {
      const digestDate = startOfOrgLocalDay('America/Los_Angeles', '2026-06-01');
      const sent = await CaregiverDailyDigest.create({
        org: org._id,
        caregiver: caregiver._id,
        digestDate,
        version: 1,
        status: 'sent',
        sentAt: new Date(),
        payload: samplePayload(client._id),
      });

      await Client.deleteOne({ _id: client._id });

      const stats = await digestCleanup.cleanupOrphanedDigests('CA');

      expect(stats.entriesStripped).toBeGreaterThanOrEqual(1);
      const reloaded = await CaregiverDailyDigest.findById(sent._id);
      expect(reloaded.phiRedactedAt).toBeTruthy();
      expect(reloaded.payload.entries).toEqual([]);
    });
  });
});
