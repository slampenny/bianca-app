jest.mock('../../../src/services/email.service', () => ({
  sendEmail: jest.fn(),
}));

const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const logger = require('../../../src/config/logger');
const {
  createDigest,
  sendDigest,
  deliverDigestEmail,
  updateDraftDigest,
  markDigestSent,
  hashPayload,
  previewDigest,
  getDigestById,
  payloadToEmailHtml,
  payloadToPlainText,
  familySafeSummary,
  SEND_IN_PROGRESS_TIMEOUT_MS,
  FAMILY_SAFE_NO_SUMMARY_FALLBACK,
  FAMILY_AI_DISCLAIMER,
  FAMILY_CONFIDENTIAL_FOOTER,
} = require('../../../src/services/familyWeeklyDigest.service');
const {
  resolveOrgLocalDigestWeek,
  startOfUtcWeekContaining,
  endOfUtcWeek,
} = require('../../../src/utils/digestWeek.utils');
const clientService = require('../../../src/services/client.service');
const { Caregiver, Client, Org, Call, Conversation, FamilyWeeklyDigest } = require('../../../src/models');
const emailService = require('../../../src/services/email.service');

describe('familyWeeklyDigest.service', () => {
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
    emailService.sendEmail.mockResolvedValue({ messageId: 'msg-family-test-123', provider: 'capture' });

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

  const weekRef = () => '2026-03-25T12:00:00.000Z';

  const orgWeek = (input = weekRef()) => resolveOrgLocalDigestWeek(null, input);

  const seedCall = async (summary = 'Upbeat call summary.', history = summary, startTimeOverride) => {
    const { weekStart } = orgWeek();
    const call = await Call.create({
      callSid: `CA${Date.now()}`,
      clientId: client._id,
      status: 'completed',
      callOutcome: 'answered',
      duration: 240,
      startTime: startTimeOverride ?? new Date(weekStart.getTime() + 86400000),
    });
    await Conversation.create({
      callId: call._id,
      clientId: client._id,
      summary,
      history,
    });
    return call;
  };

  describe('org-local week boundaries', () => {
    it('stores localWeekKey and timezoneAtBuild on create (default org timezone)', async () => {
      await seedCall();
      const { digest } = await createDigest(requester, client._id.toString(), weekRef());
      expect(digest.localWeekKey).toBe('2026-03-23');
      expect(digest.timezoneAtBuild).toBe('America/Los_Angeles');
      expect(digest.legacyUtcWeek).toBe(false);
      expect(digest.payload.localWeekKey).toBe('2026-03-23');
    });

    it('Vancouver Sunday evening call is in prior org-local week, not UTC week', async () => {
      await Org.findByIdAndUpdate(org._id, { timezone: 'America/Vancouver' });
      const sundayEveningUtc = new Date('2026-03-23T03:00:00.000Z');
      await seedCall('Sunday evening call.', 'Sunday evening call.', sundayEveningUtc);

      const { payload } = await previewDigest(requester, client._id.toString(), '2026-03-16');
      expect(payload.localWeekKey).toBe('2026-03-16');
      expect(payload.callRows).toHaveLength(1);
      expect(payload.callRows[0].dayLabel).toBe('Sun');
      expect(payload.callRows[0].dateLabel).toBe('Mar 22');

      const utcWeekPreview = await previewDigest(requester, client._id.toString(), '2026-03-23');
      expect(utcWeekPreview.payload.callRows).toHaveLength(0);
    });

    it('Toronto Monday early morning call is in that org-local week', async () => {
      await Org.findByIdAndUpdate(org._id, { timezone: 'America/Toronto' });
      const mondayEarly = new Date('2026-03-23T06:00:00.000Z');
      await seedCall('Early Monday check-in.', 'Early Monday check-in.', mondayEarly);

      const { payload } = await previewDigest(requester, client._id.toString(), '2026-03-23');
      expect(payload.localWeekKey).toBe('2026-03-23');
      expect(payload.callRows).toHaveLength(1);
      expect(payload.atAGlance.weekRangeLabel).toBe('Mar 23, 2026 – Mar 29, 2026');
    });

    it('spring-forward week includes calls on Mar 8 in America/Los_Angeles', async () => {
      await Org.findByIdAndUpdate(org._id, { timezone: 'America/Los_Angeles' });
      await seedCall('Spring-forward week call.', 'Spring-forward week call.', new Date('2026-03-08T20:00:00.000Z'));

      const { payload } = await previewDigest(requester, client._id.toString(), '2026-03-02');
      expect(payload.localWeekKey).toBe('2026-03-02');
      expect(payload.callRows).toHaveLength(1);
    });

    it('fall-back week includes calls on Nov 1 in America/Los_Angeles', async () => {
      await Org.findByIdAndUpdate(org._id, { timezone: 'America/Los_Angeles' });
      await seedCall('Fall-back week call.', 'Fall-back week call.', new Date('2026-11-01T08:30:00.000Z'));

      const { payload } = await previewDigest(requester, client._id.toString(), '2026-10-26');
      expect(payload.localWeekKey).toBe('2026-10-26');
      expect(payload.callRows).toHaveLength(1);
    });

    it('legacy digest with legacyUtcWeek remains readable', async () => {
      const ws = startOfUtcWeekContaining('2026-03-25T12:00:00.000Z');
      const we = endOfUtcWeek(ws);
      const legacy = await FamilyWeeklyDigest.create({
        org: org._id,
        client: client._id,
        weekStart: ws,
        weekEnd: we,
        localWeekKey: '2026-03-23',
        timezoneAtBuild: null,
        legacyUtcWeek: true,
        status: 'sent',
        sentAt: new Date(),
        recipient: { name: 'Sarah M.', relationship: 'daughter', email: 'family@test.com' },
        payload: {
          version: 1,
          title: 'Weekly call digest for families',
          localWeekKey: '2026-03-23',
          legacyUtcWeek: true,
          atAGlance: { weekRangeLabel: 'Mar 23 – Mar 29, 2026', callsPlaced: 0, answeredCount: 0 },
          callRows: [],
          narrative: [],
          subtitleParts: { recipientLine: 'For Sarah', residentLine: 'Your loved one: Resident' },
          eligibility: { ok: true, reasons: [], warnings: [] },
        },
        createdBy: caregiver._id,
      });

      const detail = await getDigestById(requester, legacy.id);
      expect(detail.legacyUtcWeek).toBe(true);
      expect(detail.localWeekKey).toBe('2026-03-23');
      expect(detail.payload.legacyUtcWeek).toBe(true);
    });
  });

  describe('draft lifecycle', () => {
    it('sets payloadHash on create', async () => {
      await seedCall();
      const { digest } = await createDigest(requester, client._id.toString(), weekRef());
      expect(digest.payloadHash).toBe(hashPayload(digest.payload));
    });

    it('refreshes an existing draft in place', async () => {
      await seedCall('First summary');
      const { digest: first } = await createDigest(requester, client._id.toString(), weekRef());
      await Conversation.deleteMany({});
      await Call.deleteMany({});
      await seedCall('Updated summary');
      const { digest: second } = await createDigest(requester, client._id.toString(), weekRef());

      expect(second.id).toBe(first.id);
      expect(second.payload.callRows[0].summary).toContain('Updated');
      expect(second.payloadHash).toBe(hashPayload(second.payload));
      expect(await FamilyWeeklyDigest.countDocuments({ client: client._id })).toBe(1);
    });

    it('blocks create when digest for the week was already sent', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      await sendDigest(requester, draft.id);

      await expect(createDigest(requester, client._id.toString(), weekRef())).rejects.toMatchObject({
        statusCode: httpStatus.CONFLICT,
      });
    });

    it('updateDraftDigest rejects sent digests', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      const sent = await sendDigest(requester, draft.id);

      await expect(
        updateDraftDigest(sent, {
          payload: { tampered: true },
          recipient: sent.recipient,
        })
      ).rejects.toMatchObject({ statusCode: httpStatus.BAD_REQUEST });
    });
  });

  describe('send safety', () => {
    it('send transition records audit metadata', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      const sent = await sendDigest(requester, draft.id);

      expect(sent.status).toBe('sent');
      expect(sent.sentAt).toBeTruthy();
      expect(sent.sentPayloadHash).toBe(sent.payloadHash);
      expect(sent.emailRecipient).toBe('family@test.com');
      expect(sent.emailSubject).toBe('Weekly update from Test Org');
      expect(sent.emailMessageId).toBe('msg-family-test-123');
      expect(sent.sendInProgressAt).toBeNull();
      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('duplicate send on sent digest throws 400', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      await sendDigest(requester, draft.id);
      await expect(sendDigest(requester, draft.id)).rejects.toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
      });
    });

    it('recent sendInProgressAt blocks duplicate send with 409', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      draft.sendInProgressAt = new Date();
      await draft.save();

      await expect(sendDigest(requester, draft.id)).rejects.toMatchObject({
        statusCode: httpStatus.CONFLICT,
      });
    });

    it('SES failure leaves digest as draft and clears sendInProgressAt', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      emailService.sendEmail.mockRejectedValueOnce(new Error('SES unavailable'));

      await expect(sendDigest(requester, draft.id)).rejects.toThrow('SES unavailable');

      const reloaded = await FamilyWeeklyDigest.findById(draft.id);
      expect(reloaded.status).toBe('draft');
      expect(reloaded.sendInProgressAt).toBeNull();
      expect(reloaded.sentAt).toBeNull();
      expect(reloaded.sentPayloadHash).toBeNull();
    });

    it('SES success + Mongo failure logs CRITICAL with audit context', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      const draftDoc = await FamilyWeeklyDigest.findById(draft.id);
      const loggerSpy = jest.spyOn(logger, 'error');
      let saveCalls = 0;
      jest.spyOn(draftDoc, 'save').mockImplementation(function patchedSave() {
        saveCalls += 1;
        if (saveCalls >= 2) {
          return Promise.reject(new Error('Mongo unavailable'));
        }
        return mongoose.Model.prototype.save.call(this);
      });

      await expect(deliverDigestEmail(draftDoc)).rejects.toThrow('Mongo unavailable');

      expect(loggerSpy).toHaveBeenCalledWith(
        '[FamilyWeeklyDigest] CRITICAL: SES succeeded but Mongo save failed',
        expect.objectContaining({
          digestId: draft.id,
          clientId: String(client._id),
          orgId: String(org._id),
          emailRecipients: ['family@test.com'],
          emailMessageId: 'msg-family-test-123',
        })
      );

      loggerSpy.mockRestore();
    });

    it('deliverDigestEmail allows retry after sendInProgressAt ages out', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      draft.sendInProgressAt = new Date(Date.now() - SEND_IN_PROGRESS_TIMEOUT_MS - 1000);
      await draft.save();

      const sent = await deliverDigestEmail(draft);
      expect(sent.status).toBe('sent');
      expect(sent.emailMessageId).toBe('msg-family-test-123');
    });

    it('captures emailMessageId from capture-mode raw.id', async () => {
      await seedCall();
      emailService.sendEmail.mockResolvedValueOnce({
        provider: 'capture',
        raw: { id: 'capture-family-xyz' },
      });
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      const sent = await sendDigest(requester, draft.id);
      expect(sent.emailMessageId).toBe('capture-family-xyz');
    });

    it('markDigestSent transitions draft to sent with audit fields', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      const payloadHashAtSend = hashPayload(draft.payload);

      const sent = await markDigestSent(draft, {
        emails: ['family@test.com'],
        subject: 'Weekly update from Test Org',
        messageIds: ['helper-msg-1'],
        payloadHashAtSend,
      });

      expect(sent.status).toBe('sent');
      expect(sent.sentPayloadHash).toBe(payloadHashAtSend);
      expect(sent.emailMessageId).toBe('helper-msg-1');
    });
  });

  describe('required call question answers', () => {
    it('includes standard question answers in weekly call rows and summary', async () => {
      const { weekStart } = orgWeek();
      const call = await Call.create({
        callSid: `CA${Date.now()}`,
        clientId: client._id,
        status: 'completed',
        callOutcome: 'answered',
        duration: 240,
        startTime: new Date(weekStart.getTime() + 86400000),
      });
      await Conversation.create({
        callId: call._id,
        clientId: client._id,
        summary: 'Pleasant wellness check.',
        history: 'Pleasant wellness check.',
        analyzedData: {
          requiredQuestions: {
            answers: [
              {
                questionId: 'med',
                prompt: 'Have you taken your medication today?',
                answer: 'Yes',
                asked: true,
              },
            ],
          },
        },
      });

      const { payload } = await previewDigest(requester, client._id.toString(), weekRef());
      expect(payload.callRows[0].requiredQuestionAnswers).toEqual([
        {
          question: 'Have you taken your medication today?',
          answer: 'Yes',
          asked: true,
        },
      ]);
      expect(payload.callRows[0].summary).toContain('Standard questions:');
      expect(payload.callRows[0].summary).toContain('Have you taken your medication today?');
      expect(payload.callRows[0].summary).toContain('Yes');
    });
  });

  describe('content safety and email copy', () => {
    it('replaces unsafe failure summary in payload with family-safe fallback', async () => {
      await seedCall('Summary generation failed - manual review needed');
      const { payload } = await previewDigest(requester, client._id.toString(), weekRef());

      expect(payload.callRows[0].summary).toBe(FAMILY_SAFE_NO_SUMMARY_FALLBACK);
      expect(payload.callRows[0].summary).not.toContain('manual review');
      expect(payload.narrative).toContain(FAMILY_AI_DISCLAIMER);
    });

    it('does not expose unsafe failure text in HTML or plain-text email', async () => {
      await seedCall('Summary generation failed - manual review needed');
      const { payload } = await previewDigest(requester, client._id.toString(), weekRef());
      const html = payloadToEmailHtml(payload, 'Test Org');
      const text = payloadToPlainText(payload, 'Test Org');

      expect(html).not.toContain('manual review needed');
      expect(html).toContain(FAMILY_SAFE_NO_SUMMARY_FALLBACK);
      expect(html).toContain(FAMILY_AI_DISCLAIMER);
      expect(text).not.toContain('manual review needed');
      expect(text).toContain(FAMILY_SAFE_NO_SUMMARY_FALLBACK);
      expect(text).toContain(FAMILY_CONFIDENTIAL_FOOTER);
    });

    it('blocks transcript-like history when summary is absent', async () => {
      const transcript = [
        'User: Hello there',
        'Assistant: Hi, how are you feeling?',
        'User: Fine thanks',
        'Assistant: That is good to hear today',
      ].join('\n');
      await seedCall('', transcript);

      const { payload } = await previewDigest(requester, client._id.toString(), weekRef());
      expect(payload.callRows[0].summary).toBe(FAMILY_SAFE_NO_SUMMARY_FALLBACK);
      expect(payload.callRows[0].summary).not.toContain('User:');
    });

    it('uses safe summary and ignores unsafe history when summary is present', async () => {
      const { weekStart } = orgWeek();
      const call = await Call.create({
        callSid: `CA${Date.now()}`,
        clientId: client._id,
        status: 'completed',
        callOutcome: 'answered',
        duration: 240,
        startTime: new Date(weekStart.getTime() + 86400000),
      });
      await Conversation.create({
        callId: call._id,
        clientId: client._id,
        summary: 'Had a pleasant chat about the garden.',
        history: 'User: raw\nAssistant: leak\nUser: more\nAssistant: lines',
      });

      const { payload } = await previewDigest(requester, client._id.toString(), weekRef());
      expect(payload.callRows[0].summary).toContain('pleasant chat');
      expect(payload.callRows[0].summary).not.toContain('User:');
    });

    it('escapes HTML in org names, summaries, and narrative', async () => {
      await seedCall('<script>alert(1)</script> summary');
      await Org.findByIdAndUpdate(org._id, { name: 'Evil <img src=x onerror=alert(1)> Org' });
      const { payload } = await previewDigest(requester, client._id.toString(), weekRef());
      const html = payloadToEmailHtml(payload, 'Evil <img src=x onerror=alert(1)> Org');

      expect(html).not.toContain('<script>');
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;img');
    });

    it('plain-text email contains full digest content', async () => {
      await seedCall('She mentioned enjoying music this week.');
      const { payload } = await previewDigest(requester, client._id.toString(), weekRef());
      const text = payloadToPlainText(payload, 'Test Org');

      expect(text).toContain('Weekly call digest for families');
      expect(text).toContain('Mar 23, 2026');
      expect(text).toContain('She mentioned enjoying music this week.');
      expect(text).toContain('Calls placed:');
      expect(text).toContain('What’s not in this message');
      expect(text).toContain(FAMILY_AI_DISCLAIMER);
    });

    it('plain-text email includes AI disclaimer only once', async () => {
      await seedCall('Brief check-in.');
      const { payload } = await previewDigest(requester, client._id.toString(), weekRef());
      const text = payloadToPlainText(payload, 'Test Org');
      const matches = text.match(new RegExp(FAMILY_AI_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
      expect(matches).toHaveLength(1);
    });

    it('HTML email includes AI disclaimer exactly once', async () => {
      await seedCall('Brief check-in.');
      const { payload } = await previewDigest(requester, client._id.toString(), weekRef());
      const html = payloadToEmailHtml(payload, 'Test Org');
      const matches = html.match(new RegExp(FAMILY_AI_DISCLAIMER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
      expect(matches).toHaveLength(1);
    });

    it('familySafeSummary returns fallback for internal error strings', () => {
      const call = { duration: 120, callOutcome: 'answered', status: 'completed' };
      const conv = { summary: 'Error: something broke internally' };
      expect(familySafeSummary(call, conv, true)).toBe(FAMILY_SAFE_NO_SUMMARY_FALLBACK);
    });

    it('send uses full plain-text body', async () => {
      await seedCall('Friendly check-in about breakfast.');
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      await sendDigest(requester, draft.id);

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        'family@test.com',
        'Weekly update from Test Org',
        expect.stringContaining('Friendly check-in about breakfast.'),
        expect.any(String)
      );
      const plainBody = emailService.sendEmail.mock.calls[0][2];
      expect(plainBody).toContain(FAMILY_AI_DISCLAIMER);
      expect(plainBody).not.toContain('Open the HTML version');
    });
  });

  describe('recipient eligibility', () => {
    it('preview reports eligibility reasons when opt-in is false', async () => {
      await Client.findByIdAndUpdate(client._id, {
        'emergencyContact.familyDigestEmail.enabled': false,
      });
      await seedCall();
      const { payload, eligibility } = await previewDigest(requester, client._id.toString(), weekRef());
      expect(payload.callRows.length).toBeGreaterThan(0);
      expect(eligibility.ok).toBe(false);
      expect(eligibility.reasons.some((r) => r.includes('not enabled'))).toBe(true);
    });

    it('create blocks when opt-in is false', async () => {
      await Client.findByIdAndUpdate(client._id, {
        'emergencyContact.familyDigestEmail.enabled': false,
      });
      await seedCall();
      await expect(createDigest(requester, client._id.toString(), weekRef())).rejects.toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
      });
    });

    it('create blocks when client consent is false', async () => {
      await seedCall();
      await Client.findByIdAndUpdate(client._id, { consented: false });
      await expect(createDigest(requester, client._id.toString(), weekRef())).rejects.toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
      });
    });

    it('create blocks when email is not verified', async () => {
      await Client.findByIdAndUpdate(client._id, {
        'emergencyContact.familyDigestEmail.verifiedAt': null,
        'emergencyContact.familyDigestEmail.verifiedEmail': null,
      });
      await seedCall();
      await expect(createDigest(requester, client._id.toString(), weekRef())).rejects.toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
      });
    });

    it('send blocks when opt-in is false', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      await Client.findByIdAndUpdate(client._id, {
        'emergencyContact.familyDigestEmail.enabled': false,
      });
      await expect(sendDigest(requester, draft.id)).rejects.toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
      });
    });

    it('send blocks when client consent is false', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      await Client.findByIdAndUpdate(client._id, { consented: false });
      await expect(sendDigest(requester, draft.id)).rejects.toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
      });
    });

    it('send blocks when verifiedEmail does not match current email', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      await Client.findByIdAndUpdate(client._id, {
        'emergencyContact.email': 'newfamily@test.com',
        'emergencyContact.familyDigestEmail.verifiedEmail': 'family@test.com',
      });
      await expect(sendDigest(requester, draft.id)).rejects.toMatchObject({
        statusCode: httpStatus.BAD_REQUEST,
      });
    });

    it('send succeeds when opt-in and verification are valid', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      const sent = await sendDigest(requester, draft.id);
      expect(sent.status).toBe('sent');
    });
  });

  describe('sent record immutability', () => {
    const createSentDigest = async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      return sendDigest(requester, draft.id);
    };

    it('replaceOne is blocked', async () => {
      const sent = await createSentDigest();
      await expect(
        FamilyWeeklyDigest.replaceOne({ _id: sent._id }, { ...sent.toObject(), payload: { tampered: true } })
      ).rejects.toThrow('Sent digest records are immutable');
    });

    it('findByIdAndUpdate is blocked', async () => {
      const sent = await createSentDigest();
      await expect(
        FamilyWeeklyDigest.findByIdAndUpdate(sent._id, { status: 'draft' })
      ).rejects.toThrow('Sent digest records are immutable');
    });

    it('collection.updateOne is blocked', async () => {
      const sent = await createSentDigest();
      await expect(
        FamilyWeeklyDigest.collection.updateOne({ _id: sent._id }, { $set: { payload: { tampered: true } } })
      ).rejects.toThrow('Sent digest records are immutable');
    });

    it('collection.bulkWrite updateOne is blocked', async () => {
      const sent = await createSentDigest();
      await expect(
        FamilyWeeklyDigest.collection.bulkWrite([
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

  describe('cleanup compatibility', () => {
    it('cleanup service can redact sent records and preserves sentPayloadHash', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      const sent = await sendDigest(requester, draft.id);
      const originalSentHash = sent.sentPayloadHash;

      await clientService.deleteClientById(client._id);

      const reloaded = await FamilyWeeklyDigest.findById(sent._id);
      expect(reloaded.phiRedactedAt).toBeTruthy();
      expect(reloaded.payload.phiRedacted).toBe(true);
      expect(reloaded.sentPayloadHash).toBe(originalSentHash);
      expect(reloaded.payloadHash).not.toBe(originalSentHash);
      expect(reloaded.emailRecipient).toBeNull();
      expect(reloaded.emailSubject).toBeNull();
      expect(reloaded.emailMessageId).toBe('msg-family-test-123');
      expect(reloaded.status).toBe('sent');
      expect(reloaded.sentAt).toBeTruthy();
    });

    it('redacted records remain readable via getDigestById for orgAdmin', async () => {
      await seedCall();
      const { digest: draft } = await createDigest(requester, client._id.toString(), weekRef());
      const sent = await sendDigest(requester, draft.id);
      await clientService.deleteClientById(client._id);

      const { getDigestById } = require('../../../src/services/familyWeeklyDigest.service');
      const orgAdminRequester = { ...requester, role: 'orgAdmin' };
      const detail = await getDigestById(orgAdminRequester, sent.id);
      expect(detail.payload.phiRedacted).toBe(true);
      expect(detail.phiRedactedAt).toBeTruthy();
    });
  });
});
