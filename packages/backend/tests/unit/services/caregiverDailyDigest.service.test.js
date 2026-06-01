jest.unmock('i18n');

jest.mock('../../../src/services/email.service', () => ({
  sendEmail: jest.fn(),
}));

const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const httpStatus = require('http-status');
const i18n = require('i18n');

i18n.configure({
  locales: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ko', 'ar', 'hu'],
  directory: path.join(__dirname, '../../../src/locales'),
  defaultLocale: 'en',
  updateFiles: false,
  objectNotation: true,
  logWarnFn() {},
});

const {
  resolveDigestDayForOrg,
  hashPayload,
  isUnsafeDigestText,
  buildPayloadForCaregiverDay,
  createOrUpdateDigest,
  sendDigest,
  deliverDigestEmail,
  updateDraftDigest,
  createDigestVersion,
  markDigestSent,
  extractEmailMessageId,
  queryDigests,
  getDigestById,
  SEND_IN_PROGRESS_TIMEOUT_MS,
} = require('../../../src/services/caregiverDailyDigest.service');
const {
  startOfOrgLocalDay,
  endOfOrgLocalDay,
  resolveOrgLocalDigestDay,
  getPayloadDigestDayStartIso,
} = require('../../../src/utils/digestDay.utils');
const { Caregiver, Client, Org, Call, Conversation, CaregiverDailyDigest } = require('../../../src/models');
const emailService = require('../../../src/services/email.service');

describe('caregiverDailyDigest.service org-local day boundaries', () => {
  it('resolveDigestDayForOrg maps instant to org-local day for default Pacific org', () => {
    const { localDateKey, digestDate, timezone } = resolveDigestDayForOrg(
      'America/Los_Angeles',
      '2026-06-01T12:00:00.000Z'
    );
    expect(timezone).toBe('America/Los_Angeles');
    expect(localDateKey).toBe('2026-06-01');
    expect(digestDate.toISOString()).toBe('2026-06-01T07:00:00.000Z');
  });

  it('endOfOrgLocalDay is last ms of org-local day', () => {
    const end = endOfOrgLocalDay('America/Los_Angeles', '2026-06-01');
    expect(end.toISOString()).toBe('2026-06-02T06:59:59.999Z');
  });
});

describe('caregiverDailyDigest.service helpers', () => {
  it('hashPayload is stable for the same payload', () => {
    const payload = { version: 1, entries: [{ clientId: 'a', clientName: 'Alice' }] };
    expect(hashPayload(payload)).toBe(hashPayload({ ...payload }));
  });

  it('isUnsafeDigestText detects internal failure placeholders', () => {
    expect(isUnsafeDigestText('Summary generation failed - manual review needed')).toBe(true);
    expect(isUnsafeDigestText('All good summary')).toBe(false);
  });

  it('extractEmailMessageId reads capture and SES shapes', () => {
    expect(extractEmailMessageId({ messageId: 'msg-test-123' })).toBe('msg-test-123');
    expect(extractEmailMessageId({ MessageId: 'ses-abc' })).toBe('ses-abc');
    expect(extractEmailMessageId({ raw: { id: 'capture-id-1' } })).toBe('capture-id-1');
    expect(extractEmailMessageId({ raw: { messageId: 'nested' } })).toBe('nested');
    expect(extractEmailMessageId(null)).toBeNull();
  });
});

describe('caregiverDailyDigest.service versioning and send', () => {
  let mongoServer;
  let org;
  let caregiver;
  let client;
  let requester;
  const digestDate = '2026-06-01T12:00:00.000Z';

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri(), {});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  let callCounter = 0;

  beforeEach(async () => {
    jest.clearAllMocks();
    emailService.sendEmail.mockResolvedValue({ messageId: 'msg-test-123', provider: 'capture' });
    callCounter = 0;

    await CaregiverDailyDigest.deleteMany({});
    await Conversation.deleteMany({});
    await Call.deleteMany({});
    await Client.deleteMany({});
    await Caregiver.deleteMany({});
    await Org.deleteMany({});

    org = await Org.create({ name: 'Test Org', email: 'org@test.com', country: 'US' });
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

  const seedCompletedCall = async ({ summary, startTime }) => {
    callCounter += 1;
    const call = await Call.create({
      callSid: `CA${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      clientId: client._id,
      status: 'completed',
      callOutcome: 'answered',
      duration: 120,
      startTime: startTime || new Date(`2026-06-01T${String(10 + callCounter).padStart(2, '0')}:00:00.000Z`),
    });
    await Conversation.create({
      callId: call._id,
      clientId: client._id,
      summary: summary || 'Resident felt well today.',
      history: summary || 'Resident felt well today.',
      analyzedData: {
        sentiment: {
          overallSentiment: 'positive',
          sentimentScore: 0.5,
          confidence: 0.9,
          summary: 'Generally upbeat',
        },
      },
    });
    return call;
  };

  it('createOrUpdateDigest creates version 1 draft with org-local metadata', async () => {
    await seedCompletedCall({});
    const digest = await createOrUpdateDigest(requester, digestDate);
    expect(digest.version).toBe(1);
    expect(digest.status).toBe('draft');
    expect(digest.payloadHash).toBeTruthy();
    expect(digest.builtAt).toBeTruthy();
    expect(digest.localDateKey).toBe('2026-06-01');
    expect(digest.timezoneAtBuild).toBe('America/Los_Angeles');
    expect(digest.legacyUtcDay).toBe(false);
    expect(digest.digestDate.toISOString()).toBe('2026-06-01T07:00:00.000Z');
    expect(digest.payload.timezone).toBe('America/Los_Angeles');
    expect(digest.payload.localDateKey).toBe('2026-06-01');
    expect(digest.payload.digestDayStartIso).toBe('2026-06-01T07:00:00.000Z');
    expect(digest.payload.digestDateUtc).toBeUndefined();
  });

  it('refreshing a draft overwrites version 1 in place', async () => {
    await seedCompletedCall({ summary: 'First summary' });
    const first = await createOrUpdateDigest(requester, digestDate);
    await seedCompletedCall({ summary: 'Updated summary' });
    const second = await createOrUpdateDigest(requester, digestDate);

    expect(second.id).toBe(first.id);
    expect(second.version).toBe(1);
    expect(second.payload.entries[0].conversationSummaryShort).toContain('Updated');
    expect(await CaregiverDailyDigest.countDocuments({ caregiver: caregiver._id, digestDate: first.digestDate })).toBe(1);
  });

  it('refreshing after send creates version 2 without mutating version 1', async () => {
    await seedCompletedCall({ summary: 'Sent summary content' });
    const v1 = await createOrUpdateDigest(requester, digestDate);
    const sent = await sendDigest(requester, v1.id);
    expect(sent.status).toBe('sent');
    const v1PayloadBefore = JSON.stringify(sent.payload);

    await Conversation.deleteMany({});
    await Call.deleteMany({});
    await seedCompletedCall({ summary: 'New day summary after send' });

    const v2 = await createOrUpdateDigest(requester, digestDate);
    expect(v2.version).toBe(2);
    expect(v2.status).toBe('draft');
    expect(String(v2.previousDigest)).toBe(String(sent._id));
    expect(String(v2.supersedesDigest)).toBe(String(sent._id));

    const v1Reloaded = await CaregiverDailyDigest.findById(sent._id);
    expect(v1Reloaded.status).toBe('sent');
    expect(JSON.stringify(v1Reloaded.payload)).toBe(v1PayloadBefore);
    expect(v2.payload.entries[0].conversationSummaryShort).toContain('New day summary');
  });

  it('blocks send when caregiver email is not verified', async () => {
    await seedCompletedCall({});
    const draft = await createOrUpdateDigest(requester, digestDate);
    await Caregiver.findByIdAndUpdate(caregiver._id, { isEmailVerified: false });

    await expect(sendDigest(requester, draft.id)).rejects.toMatchObject({
      statusCode: httpStatus.BAD_REQUEST,
      message: 'A verified email is required on your profile to send this digest',
    });
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('manual send succeeds when dailyDigestEmail preference is false', async () => {
    await seedCompletedCall({});
    const draft = await createOrUpdateDigest(requester, digestDate);
    const cg = await Caregiver.findById(caregiver._id);
    cg.notificationPreferences = cg.notificationPreferences || {};
    cg.notificationPreferences.dailyDigestEmail = false;
    await cg.save();

    const sent = await sendDigest(requester, draft.id);
    expect(sent.status).toBe('sent');
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('send transition records audit metadata', async () => {
    await seedCompletedCall({});
    const draft = await createOrUpdateDigest(requester, digestDate);
    const sent = await sendDigest(requester, draft.id);

    expect(sent.status).toBe('sent');
    expect(sent.sentAt).toBeTruthy();
    expect(sent.sentPayloadHash).toBe(sent.payloadHash);
    expect(sent.emailRecipient).toBe('staff@test.com');
    expect(sent.emailSubject).toContain('Daily care digest');
    expect(sent.emailMessageId).toBe('msg-test-123');
    expect(sent.sendInProgressAt).toBeNull();
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('duplicate send on sent digest throws 400', async () => {
    await seedCompletedCall({});
    const draft = await createOrUpdateDigest(requester, digestDate);
    await sendDigest(requester, draft.id);
    await expect(sendDigest(requester, draft.id)).rejects.toMatchObject({
      statusCode: httpStatus.BAD_REQUEST,
    });
  });

  it('recent sendInProgressAt blocks duplicate send with 409', async () => {
    await seedCompletedCall({});
    const draft = await createOrUpdateDigest(requester, digestDate);
    draft.sendInProgressAt = new Date();
    await draft.save();

    await expect(sendDigest(requester, draft.id)).rejects.toMatchObject({
      statusCode: httpStatus.CONFLICT,
    });
  });

  it('SES failure leaves digest as draft and clears sendInProgressAt', async () => {
    await seedCompletedCall({});
    const draft = await createOrUpdateDigest(requester, digestDate);
    emailService.sendEmail.mockRejectedValueOnce(new Error('SES unavailable'));

    await expect(sendDigest(requester, draft.id)).rejects.toThrow('SES unavailable');

    const reloaded = await CaregiverDailyDigest.findById(draft.id);
    expect(reloaded.status).toBe('draft');
    expect(reloaded.sendInProgressAt).toBeNull();
    expect(reloaded.sentAt).toBeNull();
  });

  it('filters failure placeholder summaries from digest payload', async () => {
    await seedCompletedCall({ summary: 'Summary generation failed - manual review needed' });
    const caregiverDoc = await Caregiver.findById(caregiver._id);
    const { localDateKey, digestDate: dayStart, timezone } = resolveOrgLocalDigestDay(
      org.timezone,
      digestDate
    );
    const { payload } = await buildPayloadForCaregiverDay(caregiverDoc, {
      digestDateStart: dayStart,
      orgTimezone: timezone,
      localDateKey,
    });
    const summary = payload.entries[0].conversationSummaryShort || '';
    expect(summary).not.toContain('Summary generation failed');
    expect(summary).not.toContain('manual review needed');
    expect(summary).toContain('no written summary');
  });

  it('historical immutability: sent v1 unchanged after source mutation and refresh', async () => {
    await seedCompletedCall({ summary: 'Original immutable summary' });
    const v1 = await createOrUpdateDigest(requester, digestDate);
    await sendDigest(requester, v1.id);

    await Conversation.updateMany({}, { summary: 'Mutated after send', history: 'Mutated after send' });
    const v2 = await createOrUpdateDigest(requester, digestDate);

    const v1After = await CaregiverDailyDigest.findById(v1.id);
    expect(v1After.payload.entries[0].conversationSummaryShort).toContain('Original immutable');
    expect(v2.payload.entries[0].conversationSummaryShort).toContain('Mutated after send');
  });

  it('model pre-save hook prevents mutating sent digest payload', async () => {
    await seedCompletedCall({});
    const draft = await createOrUpdateDigest(requester, digestDate);
    const sent = await sendDigest(requester, draft.id);
    sent.payload = { tampered: true };
    await expect(sent.save()).rejects.toThrow('Sent digest records are immutable');
  });

  it('deliverDigestEmail allows retry after sendInProgressAt ages out', async () => {
    await seedCompletedCall({});
    const draft = await createOrUpdateDigest(requester, digestDate);
    draft.sendInProgressAt = new Date(Date.now() - SEND_IN_PROGRESS_TIMEOUT_MS - 1000);
    await draft.save();

    const sent = await deliverDigestEmail(draft);
    expect(sent.status).toBe('sent');
  });

  it('save hook allows draft to sent transition', async () => {
    await seedCompletedCall({});
    const draft = await createOrUpdateDigest(requester, digestDate);
    expect(draft.status).toBe('draft');

    const sent = await sendDigest(requester, draft.id);
    expect(sent.status).toBe('sent');
    expect(sent.emailMessageId).toBe('msg-test-123');
  });

  it('updateOne cannot mutate sent digest payload', async () => {
    await seedCompletedCall({});
    const draft = await createOrUpdateDigest(requester, digestDate);
    const sent = await sendDigest(requester, draft.id);

    await expect(
      CaregiverDailyDigest.updateOne({ _id: sent._id }, { $set: { payload: { tampered: true } } })
    ).rejects.toThrow('Sent digest records are immutable');
  });

  it('findOneAndUpdate cannot mutate sent digest status', async () => {
    await seedCompletedCall({});
    const draft = await createOrUpdateDigest(requester, digestDate);
    const sent = await sendDigest(requester, draft.id);

    await expect(
      CaregiverDailyDigest.findOneAndUpdate({ _id: sent._id }, { status: 'draft' })
    ).rejects.toThrow('Sent digest records are immutable');
  });

  it('updateOne can still mutate draft digests', async () => {
    await seedCompletedCall({});
    const draft = await createOrUpdateDigest(requester, digestDate);

    await CaregiverDailyDigest.updateOne({ _id: draft._id }, { $set: { 'payload.version': 99 } });
    const reloaded = await CaregiverDailyDigest.findById(draft._id);
    expect(reloaded.payload.version).toBe(99);
  });

  describe('write helpers', () => {
    it('updateDraftDigest refreshes draft payload in place', async () => {
      await seedCompletedCall({});
      const draft = await createOrUpdateDigest(requester, digestDate);
      const newPayload = { ...draft.payload, title: 'Updated title' };

      const updated = await updateDraftDigest(draft, { payload: newPayload, locale: 'en' });
      expect(updated.id).toBe(draft.id);
      expect(updated.payload.title).toBe('Updated title');
      expect(updated.payloadHash).toBe(hashPayload(newPayload));
    });

    it('createDigestVersion creates a linked draft version', async () => {
      await seedCompletedCall({});
      const caregiverDoc = await Caregiver.findById(caregiver._id);
      const { localDateKey, digestDate: dayStart, timezone } = resolveOrgLocalDigestDay(
        org.timezone,
        digestDate
      );
      const { payload, locale } = await buildPayloadForCaregiverDay(caregiverDoc, {
        digestDateStart: dayStart,
        orgTimezone: timezone,
        localDateKey,
      });
      const v1 = await createDigestVersion({
        caregiverDoc,
        digestDate: dayStart,
        localDateKey,
        timezoneAtBuild: timezone,
        payload,
        locale,
        version: 1,
      });
      const v2 = await createDigestVersion({
        caregiverDoc,
        digestDate: dayStart,
        localDateKey,
        timezoneAtBuild: timezone,
        payload: { ...payload, title: 'v2' },
        locale,
        version: 2,
        previousDigest: v1._id,
        supersedesDigest: v1._id,
      });

      expect(v2.version).toBe(2);
      expect(String(v2.supersedesDigest)).toBe(String(v1._id));
      expect(v2.status).toBe('draft');
    });

    it('markDigestSent transitions draft to sent with audit fields', async () => {
      await seedCompletedCall({});
      const draft = await createOrUpdateDigest(requester, digestDate);
      const payloadHashAtSend = hashPayload(draft.payload);

      const sent = await markDigestSent(draft, {
        email: 'staff@test.com',
        subject: 'Daily digest',
        messageId: 'helper-msg-1',
        payloadHashAtSend,
      });

      expect(sent.status).toBe('sent');
      expect(sent.sentPayloadHash).toBe(payloadHashAtSend);
      expect(sent.emailMessageId).toBe('helper-msg-1');
    });

    it('updateDraftDigest rejects sent digests', async () => {
      await seedCompletedCall({});
      const draft = await createOrUpdateDigest(requester, digestDate);
      const sent = await sendDigest(requester, draft.id);

      await expect(
        updateDraftDigest(sent, { payload: { tampered: true }, locale: 'en' })
      ).rejects.toMatchObject({ statusCode: httpStatus.BAD_REQUEST });
    });
  });

  describe('remaining mutation vectors on sent digests', () => {
    const createSentDigest = async () => {
      await seedCompletedCall({});
      const draft = await createOrUpdateDigest(requester, digestDate);
      return sendDigest(requester, draft.id);
    };

    it('replaceOne is blocked', async () => {
      const sent = await createSentDigest();
      await expect(
        CaregiverDailyDigest.replaceOne({ _id: sent._id }, { ...sent.toObject(), payload: { tampered: true } })
      ).rejects.toThrow('Sent digest records are immutable');
    });

    it('findByIdAndUpdate is blocked', async () => {
      const sent = await createSentDigest();
      await expect(
        CaregiverDailyDigest.findByIdAndUpdate(sent._id, { status: 'draft' })
      ).rejects.toThrow('Sent digest records are immutable');
    });

    it('collection.updateOne is blocked', async () => {
      const sent = await createSentDigest();
      await expect(
        CaregiverDailyDigest.collection.updateOne({ _id: sent._id }, { $set: { payload: { tampered: true } } })
      ).rejects.toThrow('Sent digest records are immutable');
    });

    it('collection.replaceOne is blocked', async () => {
      const sent = await createSentDigest();
      const plain = sent.toObject();
      plain.payload = { tampered: true };
      delete plain._id;
      await expect(
        CaregiverDailyDigest.collection.replaceOne({ _id: sent._id }, plain)
      ).rejects.toThrow('Sent digest records are immutable');
    });

    it('collection.bulkWrite updateOne is blocked', async () => {
      const sent = await createSentDigest();
      await expect(
        CaregiverDailyDigest.collection.bulkWrite([
          {
            updateOne: {
              filter: { _id: sent._id },
              update: { $set: { payload: { tampered: true } } },
            },
          },
        ])
      ).rejects.toThrow('Sent digest records are immutable');
    });
  });

  it('list returns latest draft with supersedesDigestMeta after sent refresh', async () => {
    await seedCompletedCall({ summary: 'Sent version summary' });
    const v1 = await createOrUpdateDigest(requester, digestDate);
    await sendDigest(requester, v1.id);
    await seedCompletedCall({ summary: 'Draft v2 summary' });
    await createOrUpdateDigest(requester, digestDate);

    const list = await queryDigests(requester, {}, { limit: 10, page: 1 });
    expect(list.results).toHaveLength(1);
    expect(list.results[0].version).toBe(2);
    expect(list.results[0].status).toBe('draft');
    expect(list.results[0].supersedesDigestMeta).toMatchObject({ version: 1, status: 'sent' });
    expect(list.results[0].listScope).toBe('latestPerDigestDate');
  });

  it('includeAllVersions returns every version for orgAdmin', async () => {
    const adminRequester = { ...requester, role: 'orgAdmin' };
    await seedCompletedCall({ summary: 'v1' });
    const v1 = await createOrUpdateDigest(adminRequester, digestDate);
    await sendDigest(adminRequester, v1.id);
    await seedCompletedCall({ summary: 'v2' });
    await createOrUpdateDigest(adminRequester, digestDate);

    const all = await queryDigests(adminRequester, { includeAllVersions: true }, { limit: 10, page: 1 });
    expect(all.results.length).toBeGreaterThanOrEqual(2);
    expect(all.results.some((r) => r.version === 1 && r.status === 'sent')).toBe(true);
    expect(all.results.some((r) => r.version === 2 && r.status === 'draft')).toBe(true);
    expect(all.results[0].listScope).toBe('allVersions');
  });

  it('includeAllVersions is forbidden for staff', async () => {
    await expect(queryDigests(requester, { includeAllVersions: true }, {})).rejects.toMatchObject({
      statusCode: httpStatus.FORBIDDEN,
    });
  });

  it('captures emailMessageId from capture-mode raw.id', async () => {
    await seedCompletedCall({});
    emailService.sendEmail.mockResolvedValueOnce({
      provider: 'capture',
      raw: { id: 'capture-email-xyz' },
    });
    const draft = await createOrUpdateDigest(requester, digestDate);
    const sent = await sendDigest(requester, draft.id);
    expect(sent.emailMessageId).toBe('capture-email-xyz');
  });

  describe('org-local call inclusion and date labels', () => {
    it('includes only calls within org-local day for America/Los_Angeles', async () => {
      await Call.create({
        callSid: `CA-before-${Date.now()}`,
        clientId: client._id,
        status: 'completed',
        callOutcome: 'answered',
        duration: 60,
        startTime: new Date('2026-06-01T06:00:00.000Z'),
      });
      await seedCompletedCall({ summary: 'Included LA morning call', startTime: new Date('2026-06-01T10:00:00.000Z') });

      const digest = await createOrUpdateDigest(requester, '2026-06-01');
      expect(digest.payload.entries[0].callsPlaced).toBe(1);
      expect(digest.payload.entries[0].conversationSummaryShort).toContain('Included LA morning call');
    });

    it('uses org-local day boundaries for America/New_York', async () => {
      await Org.findByIdAndUpdate(org._id, { timezone: 'America/New_York' });
      await Call.create({
        callSid: `CA-ny-before-${Date.now()}`,
        clientId: client._id,
        status: 'completed',
        callOutcome: 'answered',
        duration: 60,
        startTime: new Date('2026-06-01T03:00:00.000Z'),
      });
      await seedCompletedCall({ summary: 'Included NY morning call', startTime: new Date('2026-06-01T08:00:00.000Z') });

      const digest = await createOrUpdateDigest(requester, '2026-06-01');
      expect(digest.timezoneAtBuild).toBe('America/New_York');
      expect(digest.digestDate.toISOString()).toBe('2026-06-01T04:00:00.000Z');
      expect(digest.payload.entries[0].callsPlaced).toBe(1);
    });

    it('formats dateLabel in org timezone', async () => {
      await seedCompletedCall({});
      const digest = await createOrUpdateDigest(requester, '2026-06-01');
      expect(digest.payload.dateLabel).toMatch(/June 1, 2026/);
      expect(digest.payload.dateLabel).not.toMatch(/May 31, 2026/);
    });

    it('resolves digestDate filter using org timezone when listing', async () => {
      await seedCompletedCall({});
      await createOrUpdateDigest(requester, '2026-06-01');
      const list = await queryDigests(requester, { digestDate: '2026-06-01' }, { limit: 10, page: 1 });
      expect(list.totalResults).toBe(1);
    });

    it('legacy digestDateUtc payloads are returned unchanged and readable', async () => {
      const digestDate = startOfOrgLocalDay('America/Los_Angeles', '2026-06-01');
      const legacyPayload = {
        version: 1,
        title: 'Daily care digest',
        subtitle: 'Test Org',
        dateLabel: 'Monday, June 1, 2026',
        digestDateUtc: '2026-06-01T00:00:00.000Z',
        labels: {
          conversationSummary: 'Summary',
          sentiment: 'Sentiment',
          callsToday: 'Calls',
          noActivity: 'No activity',
          emailScreenHint: 'Hint',
        },
        entries: [
          {
            clientId: client._id.toString(),
            clientName: 'Resident One',
            conversationSummaryShort: 'Legacy digest summary.',
            sentiment: { overallSentiment: 'positive' },
            callsPlaced: 1,
            answeredCalls: 1,
          },
        ],
        generatedAt: '2026-06-01T12:00:00.000Z',
      };
      const stored = await CaregiverDailyDigest.create({
        org: org._id,
        caregiver: caregiver._id,
        digestDate,
        version: 1,
        status: 'sent',
        sentAt: new Date('2026-06-01T12:00:00.000Z'),
        payload: legacyPayload,
        payloadHash: hashPayload(legacyPayload),
        sentPayloadHash: hashPayload(legacyPayload),
      });

      const detail = await getDigestById(requester, stored.id);
      expect(detail.payload.digestDateUtc).toBe('2026-06-01T00:00:00.000Z');
      expect(detail.payload.digestDayStartIso).toBeUndefined();
      expect(getPayloadDigestDayStartIso(detail.payload)).toBe('2026-06-01T00:00:00.000Z');
      expect(detail.payload.dateLabel).toBe('Monday, June 1, 2026');
      expect(detail.payload.entries[0].conversationSummaryShort).toBe('Legacy digest summary.');

      const list = await queryDigests(requester, {}, { limit: 10, page: 1 });
      expect(list.results).toHaveLength(1);
      expect(list.results[0].payload.dateLabel).toBe('Monday, June 1, 2026');
      expect(getPayloadDigestDayStartIso(list.results[0].payload)).toBe('2026-06-01T00:00:00.000Z');
    });
  });
});
