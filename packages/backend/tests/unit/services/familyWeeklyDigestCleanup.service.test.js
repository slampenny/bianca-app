jest.mock('../../../src/services/email.service', () => ({
  sendEmail: jest.fn(),
}));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const familyDigestCleanup = require('../../../src/services/familyWeeklyDigestCleanup.service');
const dataDeletionService = require('../../../src/services/dataDeletion.service');
const clientService = require('../../../src/services/client.service');
const caregiverService = require('../../../src/services/caregiver.service');
const orgService = require('../../../src/services/org.service');
const {
  createDigest,
  sendDigest,
  queryDigests,
  getDigestById,
} = require('../../../src/services/familyWeeklyDigest.service');
const {
  resolveOrgLocalDigestWeek,
  startOfUtcWeekContaining,
  endOfUtcWeek,
} = require('../../../src/utils/digestWeek.utils');
const { Caregiver, Client, Org, Call, Conversation, FamilyWeeklyDigest } = require('../../../src/models');
const emailService = require('../../../src/services/email.service');

const samplePayload = (overrides = {}) => ({
  version: 1,
  title: 'Weekly call digest for families',
  subtitleParts: {
    recipientLine: 'For Sarah M. (daughter)',
    residentLine: 'Your loved one: Eleanor',
  },
  facilityName: 'Test Org',
  generatedAt: new Date().toISOString(),
  weekStart: '2026-03-23T00:00:00.000Z',
  weekEnd: '2026-03-29T23:59:59.999Z',
  narrative: ['This digest describes wellness check-in calls only — not clinical care.'],
  atAGlance: {
    weekRangeLabel: 'Mar 23 – Mar 29, 2026',
    callsPlaced: 2,
    answeredCount: 1,
    typicalMinutesWhenConnected: 4,
  },
  callRows: [
    {
      dayLabel: 'Mon',
      dateLabel: 'Mar 23',
      connected: true,
      summary: 'Upbeat; chatted about nice weather.',
    },
  ],
  exclusions: [{ topic: 'Diagnoses, medications, vitals', instead: 'Call the care team.' }],
  eligibility: { ok: true, reasons: [], warnings: [] },
  ...overrides,
});

describe('familyWeeklyDigestCleanup.service', () => {
  let mongoServer;
  let org;
  let caregiver;
  let client;
  let requester;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    emailService.sendEmail.mockResolvedValue({ messageId: 'msg-family-cleanup', provider: 'capture' });

    await FamilyWeeklyDigest.deleteMany({});
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
      emergencyContact: {
        name: 'Sarah M.',
        relationship: 'daughter',
        email: 'family@test.com',
        familyDigestEmail: {
          enabled: true,
          verifiedAt: new Date('2026-01-01T00:00:00.000Z'),
          verifiedEmail: 'family@test.com',
        },
      },
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

  const weekStart = () => startOfUtcWeekContaining('2026-03-25T12:00:00.000Z');

  const legacyLocalWeekKey = (ws) => {
    const y = ws.getUTCFullYear();
    const m = String(ws.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ws.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const legacyDigestFields = (ws) => ({
    weekStart: ws,
    weekEnd: endOfUtcWeek(ws),
    localWeekKey: legacyLocalWeekKey(ws),
    timezoneAtBuild: null,
    legacyUtcWeek: true,
  });

  const orgLocalWeek = () => resolveOrgLocalDigestWeek(null, '2026-03-25T12:00:00.000Z');

  const seedCallAndConversation = async () => {
    const { weekStart: ws } = orgLocalWeek();
    const call = await Call.create({
      callSid: `CA${Date.now()}`,
      clientId: client._id,
      status: 'completed',
      callOutcome: 'answered',
      duration: 240,
      startTime: new Date(ws.getTime() + 86400000),
    });
    await Conversation.create({
      callId: call._id,
      clientId: client._id,
      summary: 'Upbeat; chatted about nice weather.',
      history: 'Upbeat; chatted about nice weather.',
    });
    return call;
  };

  const createSentDigest = async () => {
    await seedCallAndConversation();
    const { digest: draft } = await createDigest(requester, client._id.toString(), '2026-03-25T12:00:00.000Z');
    return sendDigest(requester, draft.id);
  };

  describe('client deletion cleanup', () => {
    it('redacts sent digest PHI when client is deleted via clientService', async () => {
      const sent = await createSentDigest();
      expect(sent.payload.callRows[0].summary).toContain('Upbeat');
      expect(sent.recipient.email).toBe('family@test.com');

      await clientService.deleteClientById(client._id);

      const reloaded = await FamilyWeeklyDigest.findById(sent._id);
      expect(reloaded.phiRedactedAt).toBeTruthy();
      expect(reloaded.phiRedactedReason).toBe('client_deleted');
      expect(reloaded.payload.phiRedacted).toBe(true);
      expect(reloaded.payload.callRows).toEqual([]);
      expect(reloaded.payload.subtitleParts.recipientLine).toBe('[Redacted]');
      expect(reloaded.sentAt).toBeTruthy();
      expect(reloaded.status).toBe('sent');
      expect(reloaded.recipient.email).toBe('');
      expect(reloaded.emailRecipient).toBeNull();
      expect(reloaded.emailSubject).toBeNull();
      expect(reloaded.weekStart).toEqual(sent.weekStart);
      if (sent.sentPayloadHash) {
        expect(reloaded.sentPayloadHash).toBe(sent.sentPayloadHash);
        expect(reloaded.payloadHash).not.toBe(sent.sentPayloadHash);
      }
    });

    it('deletes draft digest when client is removed', async () => {
      const ws = weekStart();
      const draft = await FamilyWeeklyDigest.create({
        org: org._id,
        client: client._id,
        ...legacyDigestFields(ws),
        status: 'draft',
        recipient: { name: 'Sarah', relationship: 'daughter', email: 'family@test.com' },
        payload: samplePayload(),
        createdBy: caregiver._id,
      });

      await familyDigestCleanup.cleanupDigestsForClient(client._id, 'client_deleted');

      expect(await FamilyWeeklyDigest.findById(draft._id)).toBeNull();
    });

    it('partial cleanup redacts only the deleted client digests', async () => {
      const clientTwo = await Client.create({
        name: 'Resident Two',
        email: 'resident2@test.com',
        phone: '+16045624265',
        org: org._id,
        caregivers: [caregiver._id],
        emergencyContact: { name: 'Bob', relationship: 'son', email: 'family2@test.com' },
      });

      const ws = weekStart();
      const sentOne = await FamilyWeeklyDigest.create({
        org: org._id,
        client: client._id,
        ...legacyDigestFields(ws),
        status: 'sent',
        sentAt: new Date(),
        recipient: { name: 'Sarah', relationship: 'daughter', email: 'family@test.com' },
        payload: samplePayload(),
        createdBy: caregiver._id,
      });
      const sentTwo = await FamilyWeeklyDigest.create({
        org: org._id,
        client: clientTwo._id,
        ...legacyDigestFields(ws),
        status: 'sent',
        sentAt: new Date(),
        recipient: { name: 'Bob', relationship: 'son', email: 'family2@test.com' },
        payload: samplePayload({ subtitleParts: { recipientLine: 'For Bob (son)', residentLine: 'Your loved one: Two' } }),
        createdBy: caregiver._id,
      });

      await familyDigestCleanup.cleanupDigestsForClient(client._id, 'client_deleted');

      const reloadedOne = await FamilyWeeklyDigest.findById(sentOne._id);
      const reloadedTwo = await FamilyWeeklyDigest.findById(sentTwo._id);
      expect(reloadedOne.payload.phiRedacted).toBe(true);
      expect(reloadedTwo.payload.phiRedacted).toBeUndefined();
      expect(reloadedTwo.payload.callRows).toHaveLength(1);
    });
  });

  describe('caregiver deletion cleanup', () => {
    it('deletes drafts authored by caregiver but preserves sent client audit records', async () => {
      const sent = await createSentDigest();
      const ws = weekStart();
      const nextWs = new Date(ws.getTime() + 7 * 86400000);
      const draft = await FamilyWeeklyDigest.create({
        org: org._id,
        client: client._id,
        ...legacyDigestFields(nextWs),
        status: 'draft',
        recipient: { name: 'Sarah', relationship: 'daughter', email: 'family@test.com' },
        payload: samplePayload(),
        createdBy: caregiver._id,
      });

      await caregiverService.deleteCaregiverById(caregiver._id);

      expect(await FamilyWeeklyDigest.findById(draft._id)).toBeNull();
      const reloadedSent = await FamilyWeeklyDigest.findById(sent._id);
      expect(reloadedSent).toBeTruthy();
      expect(reloadedSent.phiRedactedAt).toBeNull();
      expect(reloadedSent.payload.callRows).toHaveLength(1);
      expect(reloadedSent.status).toBe('sent');
    });
  });

  describe('org deletion cleanup', () => {
    it('anonymizes sent digests and deletes drafts when org is deleted', async () => {
      const sent = await createSentDigest();
      const ws = weekStart();
      const nextWs = new Date(ws.getTime() + 7 * 86400000);
      const draft = await FamilyWeeklyDigest.create({
        org: org._id,
        client: client._id,
        ...legacyDigestFields(nextWs),
        status: 'draft',
        recipient: { name: 'Sarah', relationship: 'daughter', email: 'family@test.com' },
        payload: samplePayload(),
        createdBy: caregiver._id,
      });

      await orgService.deleteOrgById(org._id);

      const reloadedSent = await FamilyWeeklyDigest.findById(sent._id);
      expect(reloadedSent).toBeTruthy();
      expect(reloadedSent.phiRedactedReason).toBe('org_deleted');
      expect(reloadedSent.payload.phiRedacted).toBe(true);
      expect(reloadedSent.recipient.email).toBe('');
      expect(await FamilyWeeklyDigest.findById(draft._id)).toBeNull();
    });
  });

  describe('erasure request cleanup', () => {
    it('redacts digest PHI when caregiver requests conversation erasure', async () => {
      const sent = await createSentDigest();

      const result = await dataDeletionService.handleDeletionRequest(caregiver._id, 'conversations');

      expect(result.deleted.familyWeeklyDigests.redacted).toBeGreaterThanOrEqual(1);
      const reloaded = await FamilyWeeklyDigest.findById(sent._id);
      expect(reloaded.phiRedactedReason).toBe('erasure_request');
      expect(reloaded.payload.phiRedacted).toBe(true);
      expect(reloaded.payload.callRows).toEqual([]);
    });
  });

  describe('API compatibility after redaction', () => {
    it('list and detail endpoints return redacted digests without error', async () => {
      const sent = await createSentDigest();
      await clientService.deleteClientById(client._id);

      const orgAdminRequester = {
        id: caregiver._id.toString(),
        _id: caregiver._id,
        role: 'orgAdmin',
        org: org._id,
      };

      const listed = await queryDigests(
        orgAdminRequester,
        { clientId: sent.client.toString() },
        { limit: 10, page: 1 }
      );
      expect(listed.results).toHaveLength(1);
      expect(listed.results[0].payload.phiRedacted).toBe(true);

      const detail = await getDigestById(orgAdminRequester, sent.id);
      expect(detail.payload.callRows).toEqual([]);
      expect(detail.phiRedactedAt).toBeTruthy();
      expect(detail.status).toBe('sent');
      expect(detail.sentAt).toBeTruthy();
    });

    it('preserves week boundary metadata on redacted sent payloads', async () => {
      const sent = await createSentDigest();
      await clientService.deleteClientById(client._id);

      const reloaded = await FamilyWeeklyDigest.findById(sent._id);
      expect(reloaded.payload.weekStart).toBeTruthy();
      expect(reloaded.payload.weekEnd).toBeTruthy();
      expect(reloaded.payload.atAGlance.weekRangeLabel).toBeTruthy();
    });
  });

  describe('retention-window cleanup', () => {
    it('redacts sent digests and deletes drafts past conversation retention for CA orgs', async () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 6);
      const oldWeekEnd = endOfUtcWeek(oldDate);

      const sent = await FamilyWeeklyDigest.create({
        org: org._id,
        client: client._id,
        weekStart: oldDate,
        weekEnd: oldWeekEnd,
        localWeekKey: legacyLocalWeekKey(oldDate),
        timezoneAtBuild: null,
        legacyUtcWeek: true,
        status: 'sent',
        sentAt: oldDate,
        recipient: { name: 'Sarah', relationship: 'daughter', email: 'family@test.com' },
        payload: samplePayload({
          weekStart: oldDate.toISOString(),
          weekEnd: oldWeekEnd.toISOString(),
        }),
        createdBy: caregiver._id,
      });
      const draft = await FamilyWeeklyDigest.create({
        org: org._id,
        client: client._id,
        weekStart: new Date(oldDate.getTime() + 7 * 86400000),
        weekEnd: new Date(oldWeekEnd.getTime() + 7 * 86400000),
        localWeekKey: legacyLocalWeekKey(new Date(oldDate.getTime() + 7 * 86400000)),
        timezoneAtBuild: null,
        legacyUtcWeek: true,
        status: 'draft',
        recipient: { name: 'Sarah', relationship: 'daughter', email: 'family@test.com' },
        payload: samplePayload(),
        createdBy: caregiver._id,
      });

      const stats = await dataDeletionService.deleteExpiredDigests('CA');

      expect(stats.familyWeekly.redacted).toBe(1);
      expect(stats.familyWeekly.deleted).toBe(1);

      const reloadedSent = await FamilyWeeklyDigest.findById(sent._id);
      expect(reloadedSent.phiRedactedReason).toBe('retention_expired');
      expect(reloadedSent.payload.phiRedacted).toBe(true);
      expect(reloadedSent.sentAt).toEqual(oldDate);
      expect(await FamilyWeeklyDigest.findById(draft._id)).toBeNull();
    });

    it('skips family digest redaction for HIPAA (US) orgs', async () => {
      await Org.findByIdAndUpdate(org._id, { country: 'US' });
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 6);

      const sent = await FamilyWeeklyDigest.create({
        org: org._id,
        client: client._id,
        ...legacyDigestFields(oldDate),
        status: 'sent',
        sentAt: oldDate,
        recipient: { name: 'Sarah', relationship: 'daughter', email: 'family@test.com' },
        payload: samplePayload(),
        createdBy: caregiver._id,
      });

      const stats = await dataDeletionService.deleteExpiredDigests('US');

      expect(stats.familyWeekly.redacted).toBe(0);
      expect(stats.familyWeekly.deleted).toBe(0);

      const reloaded = await FamilyWeeklyDigest.findById(sent._id);
      expect(reloaded.phiRedactedAt).toBeNull();
      expect(reloaded.payload.callRows).toHaveLength(1);
    });
  });

  describe('orphaned digest cleanup', () => {
    it('redacts sent digest when client is hard-deleted without service hook', async () => {
      const sent = await FamilyWeeklyDigest.create({
        org: org._id,
        client: client._id,
        ...legacyDigestFields(weekStart()),
        status: 'sent',
        sentAt: new Date(),
        recipient: { name: 'Sarah', relationship: 'daughter', email: 'family@test.com' },
        payload: samplePayload(),
        createdBy: caregiver._id,
      });

      await Client.deleteOne({ _id: client._id });

      const stats = await familyDigestCleanup.cleanupOrphanedDigests('CA');

      expect(stats.redacted).toBe(1);
      const reloaded = await FamilyWeeklyDigest.findById(sent._id);
      expect(reloaded.phiRedactedReason).toBe('orphaned');
      expect(reloaded.payload.phiRedacted).toBe(true);
    });

    it('deletes orphaned drafts when org is soft-deleted', async () => {
      const draft = await FamilyWeeklyDigest.create({
        org: org._id,
        client: client._id,
        ...legacyDigestFields(weekStart()),
        status: 'draft',
        recipient: { name: 'Sarah', relationship: 'daughter', email: 'family@test.com' },
        payload: samplePayload(),
        createdBy: caregiver._id,
      });

      await org.delete();

      const stats = await familyDigestCleanup.cleanupOrphanedDigests();

      expect(stats.deleted).toBe(1);
      expect(await FamilyWeeklyDigest.findById(draft._id)).toBeNull();
    });
  });
});
