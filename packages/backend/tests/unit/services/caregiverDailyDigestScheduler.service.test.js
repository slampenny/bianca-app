jest.unmock('i18n');

jest.mock('../../../src/services/email.service', () => ({
  sendEmail: jest.fn(),
}));

const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
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
  createOrGetSchedulerRun,
  claimSchedulerRun,
  processOneCaregiverDigest,
  processCaregiverDailyDigestJob,
  findEligibleCaregiversForOrg,
  recoverStaleProcessingRuns,
  runDailyDigestCoordinatorTick,
} = require('../../../src/services/caregiverDailyDigestScheduler.service');
const config = require('../../../src/config/config');
const { createOrUpdateDigest, markDigestSent } = require('../../../src/services/caregiverDailyDigest.service');
const {
  Caregiver,
  Client,
  Org,
  Call,
  Conversation,
  CaregiverDailyDigest,
  CaregiverDailyDigestSchedulerRun,
} = require('../../../src/models');
const emailService = require('../../../src/services/email.service');

describe('caregiverDailyDigestScheduler.service', () => {
  let mongoServer;
  let org;
  let caregiver;
  let client;
  let requester;
  const localDateKey = '2026-06-01';

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
    emailService.sendEmail.mockResolvedValue({ messageId: 'msg-scheduler-123', provider: 'capture' });

    await CaregiverDailyDigestSchedulerRun.deleteMany({});
    await CaregiverDailyDigest.deleteMany({});
    await Conversation.deleteMany({});
    await Call.deleteMany({});
    await Client.deleteMany({});
    await Caregiver.deleteMany({});
    await Org.deleteMany({});

    org = await Org.create({ name: 'Scheduler Org', email: 'org@test.com', country: 'US' });
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

  const enableDigestNotifications = async (caregiverId) => {
    const cg = await Caregiver.findById(caregiverId);
    cg.notificationPreferences = cg.notificationPreferences || {};
    cg.notificationPreferences.dailyDigestEmail = true;
    await cg.save();
  };

  const seedCompletedCall = async () => {
    const call = await Call.create({
      callSid: `CA${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      clientId: client._id,
      status: 'completed',
      callOutcome: 'answered',
      duration: 120,
      startTime: new Date('2026-06-01T15:00:00.000Z'),
    });
    await Conversation.create({
      callId: call._id,
      clientId: client._id,
      summary: 'Resident felt well today.',
      history: 'Resident felt well today.',
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

  it('creates scheduler run idempotently for caregiver + localDateKey', async () => {
    const first = await createOrGetSchedulerRun({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'manual_test',
    });
    const second = await createOrGetSchedulerRun({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'manual_test',
    });

    expect(String(first._id)).toBe(String(second._id));
    expect(first.timezone).toBe('America/Los_Angeles');
    expect(first.digestDate.toISOString()).toBe('2026-06-01T07:00:00.000Z');
    expect(await CaregiverDailyDigestSchedulerRun.countDocuments({ caregiver: caregiver._id })).toBe(1);
  });

  it('claim prevents double processing', async () => {
    const run = await createOrGetSchedulerRun({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'manual_test',
    });

    const firstClaim = await claimSchedulerRun(run._id);
    const secondClaim = await claimSchedulerRun(run._id);

    expect(firstClaim).toBeTruthy();
    expect(firstClaim.status).toBe('processing');
    expect(firstClaim.attempts).toBe(1);
    expect(secondClaim).toBeNull();
  });

  it('skips ineligible caregiver (unverified email)', async () => {
    await Caregiver.updateOne({ _id: caregiver._id }, { $set: { isEmailVerified: false } });

    const result = await processOneCaregiverDigest({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'manual_test',
    });

    expect(result.outcome).toBe('skipped');
    expect(result.skipReason).toContain('verified email');
    expect(result.run.status).toBe('skipped');
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('skips automated send when notificationPreferences.dailyDigestEmail is missing', async () => {
    const result = await processOneCaregiverDigest({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'scheduled',
    });

    expect(result.outcome).toBe('skipped');
    expect(result.skipReason).toContain('Daily digest email notifications are not enabled');
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('builds and sends digest for eligible caregiver', async () => {
    await enableDigestNotifications(caregiver._id);
    await seedCompletedCall();

    const result = await processOneCaregiverDigest({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'manual_test',
    });

    expect(result.outcome).toBe('sent');
    expect(result.run.status).toBe('sent');
    expect(result.run.digestId).toBeTruthy();
    expect(result.run.emailMessageId).toBe('msg-scheduler-123');
    expect(result.run.digestPayloadHash).toBeTruthy();
    expect(result.run.completedAt).toBeTruthy();
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);

    const digest = await CaregiverDailyDigest.findById(result.run.digestId);
    expect(digest.status).toBe('sent');
  });

  it('second run for same caregiver/localDateKey does not resend', async () => {
    await enableDigestNotifications(caregiver._id);
    await seedCompletedCall();

    const first = await processOneCaregiverDigest({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'manual_test',
    });
    const second = await processOneCaregiverDigest({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'manual_test',
    });

    expect(first.outcome).toBe('sent');
    expect(second.outcome).toBe('sent');
    expect(second.idempotent).toBe(true);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('existing sent digest causes idempotent success without resend', async () => {
    await enableDigestNotifications(caregiver._id);
    await seedCompletedCall();

    const digest = await createOrUpdateDigest(requester, localDateKey);
    await markDigestSent(digest, {
      email: caregiver.email,
      subject: 'Test subject',
      messageId: 'pre-existing-msg',
      payloadHashAtSend: digest.payloadHash,
    });

    const result = await processOneCaregiverDigest({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'manual_backfill',
    });

    expect(result.outcome).toBe('sent');
    expect(result.idempotent).toBe(true);
    expect(String(result.run.digestId)).toBe(String(digest._id));
    expect(result.run.emailMessageId).toBe('pre-existing-msg');
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('marks run failed and records lastError on send failure', async () => {
    await enableDigestNotifications(caregiver._id);
    await seedCompletedCall();
    emailService.sendEmail.mockRejectedValueOnce(new Error('SES unavailable'));

    await expect(
      processOneCaregiverDigest({
        orgId: org._id,
        caregiverId: caregiver._id,
        localDateKey,
        trigger: 'manual_test',
      })
    ).rejects.toThrow('SES unavailable');

    const run = await CaregiverDailyDigestSchedulerRun.findOne({
      caregiver: caregiver._id,
      localDateKey,
    });
    expect(run.status).toBe('failed');
    expect(run.lastError).toBe('SES unavailable');
    expect(run.attempts).toBe(1);
    expect(run.completedAt).toBeTruthy();
  });

  it('dryRun does not send email', async () => {
    await enableDigestNotifications(caregiver._id);
    await seedCompletedCall();

    const result = await processOneCaregiverDigest({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'manual_test',
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.outcome).toBe('would_send');
    expect(result.digest.status).toBe('draft');
    expect(emailService.sendEmail).not.toHaveBeenCalled();

    const run = await CaregiverDailyDigestSchedulerRun.findOne({
      caregiver: caregiver._id,
      localDateKey,
    });
    expect(run.status).toBe('pending');
  });

  it('findEligibleCaregiversForOrg returns only notification-enabled active caregivers', async () => {
    await enableDigestNotifications(caregiver._id);

    const inactive = await Caregiver.create({
      name: 'Inactive',
      email: 'inactive@test.com',
      phone: '+16045624265',
      password: 'Password1',
      role: 'staff',
      isEmailVerified: true,
      isPhoneVerified: true,
      active: false,
      org: org._id,
    });
    await Caregiver.updateOne(
      { _id: inactive._id },
      { $set: { 'notificationPreferences.dailyDigestEmail': true } }
    );

    const noPref = await Caregiver.create({
      name: 'No Pref',
      email: 'nopref@test.com',
      phone: '+16045624266',
      password: 'Password1',
      role: 'staff',
      isEmailVerified: true,
      isPhoneVerified: true,
      org: org._id,
    });

    const eligible = await findEligibleCaregiversForOrg(org._id);
    const ids = eligible.map((c) => String(c._id));
    expect(ids).toContain(String(caregiver._id));
    expect(ids).not.toContain(String(inactive._id));
    expect(ids).not.toContain(String(noPref._id));
  });
});

describe('caregiverDailyDigestScheduler coordinator', () => {
  let mongoServer;
  let org;
  let caregiver;
  let client;
  const localDateKey = '2026-06-01';
  /** 18:05 America/Los_Angeles on 2026-06-01 */
  const inWindowNow = new Date('2026-06-02T01:05:00.000Z');
  /** 10:00 America/Los_Angeles on 2026-06-01 */
  const outsideWindowNow = new Date('2026-06-01T17:00:00.000Z');

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
    emailService.sendEmail.mockResolvedValue({ messageId: 'msg-coordinator-123', provider: 'capture' });
    config.dailyDigestScheduler.enabled = true;

    await CaregiverDailyDigestSchedulerRun.deleteMany({});
    await CaregiverDailyDigest.deleteMany({});
    await Conversation.deleteMany({});
    await Call.deleteMany({});
    await Client.deleteMany({});
    await Caregiver.deleteMany({});
    await Org.deleteMany({});

    org = await Org.create({
      name: 'Digest Org',
      email: 'digest-org@test.com',
      country: 'US',
      timezone: 'America/Los_Angeles',
      dailyDigestSettings: { enabled: true, sendTime: '18:00' },
    });
    caregiver = await Caregiver.create({
      name: 'Digest Staff',
      email: 'digest-staff@test.com',
      phone: '+16045624263',
      password: 'Password1',
      role: 'staff',
      isEmailVerified: true,
      isPhoneVerified: true,
      org: org._id,
      notificationPreferences: { dailyDigestEmail: true },
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
  });

  const seedCompletedCall = async () => {
    const call = await Call.create({
      callSid: `CA${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      clientId: client._id,
      status: 'completed',
      callOutcome: 'answered',
      duration: 120,
      startTime: new Date('2026-06-01T15:00:00.000Z'),
    });
    await Conversation.create({
      callId: call._id,
      clientId: client._id,
      summary: 'Resident felt well today.',
      history: 'Resident felt well today.',
    });
    return call;
  };

  it('coordinator does nothing when globally disabled', async () => {
    config.dailyDigestScheduler.enabled = false;
    await seedCompletedCall();
    const summary = await runDailyDigestCoordinatorTick({ now: inWindowNow });
    expect(summary.enabled).toBe(false);
    expect(summary.orgsInWindow).toBe(0);
    expect(await CaregiverDailyDigestSchedulerRun.countDocuments({})).toBe(0);
  });

  it('coordinator skips org outside send window', async () => {
    await seedCompletedCall();
    const summary = await runDailyDigestCoordinatorTick({ now: outsideWindowNow });
    expect(summary.orgsChecked).toBe(1);
    expect(summary.orgsInWindow).toBe(0);
    expect(await CaregiverDailyDigestSchedulerRun.countDocuments({})).toBe(0);
  });

  it('coordinator creates runs inside org-local window', async () => {
    await seedCompletedCall();
    const summary = await runDailyDigestCoordinatorTick({ now: inWindowNow });
    expect(summary.orgsInWindow).toBe(1);
    expect(summary.runsCreated).toBe(1);
    const run = await CaregiverDailyDigestSchedulerRun.findOne({ caregiver: caregiver._id, localDateKey });
    expect(run).toBeTruthy();
    expect(run.trigger).toBe('scheduled');
  });

  it('coordinator respects org timezone for send window', async () => {
    await Org.findByIdAndUpdate(org._id, {
      timezone: 'America/New_York',
      dailyDigestSettings: { enabled: true, sendTime: '18:00' },
    });
    await seedCompletedCall();
    // 18:05 Eastern = 22:05 UTC same calendar day in June (EDT, UTC-4)
    const nyInWindow = new Date('2026-06-01T22:05:00.000Z');
    const summary = await runDailyDigestCoordinatorTick({ now: nyInWindow });
    expect(summary.orgsInWindow).toBe(1);
    expect(summary.details[0].localDateKey).toBe('2026-06-01');
  });

  it('coordinator does not duplicate runs on repeated ticks', async () => {
    await seedCompletedCall();
    await runDailyDigestCoordinatorTick({ now: inWindowNow });
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    const summary = await runDailyDigestCoordinatorTick({ now: inWindowNow });
    expect(summary.runsCreated).toBe(0);
    expect(summary.runsSkippedTerminal).toBe(1);
    expect(summary.runsEnqueued).toBe(0);
    expect(await CaregiverDailyDigestSchedulerRun.countDocuments({ caregiver: caregiver._id, localDateKey })).toBe(1);
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('does not enqueue opted-out caregivers', async () => {
    caregiver.notificationPreferences.dailyDigestEmail = false;
    await caregiver.save();
    await seedCompletedCall();
    const summary = await runDailyDigestCoordinatorTick({ now: inWindowNow });
    expect(summary.orgsInWindow).toBe(1);
    expect(summary.details[0].eligibleCaregiverCount).toBe(0);
    expect(await CaregiverDailyDigestSchedulerRun.countDocuments({})).toBe(0);
  });

  it('child job sends eligible caregiver digest', async () => {
    await seedCompletedCall();
    const run = await createOrGetSchedulerRun({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'scheduled',
    });
    await processCaregiverDailyDigestJob({ runId: run._id, agendaJobId: 'agenda-job-1' });
    const updated = await CaregiverDailyDigestSchedulerRun.findById(run._id);
    expect(updated.status).toBe('sent');
    expect(updated.agendaJobId).toBe('agenda-job-1');
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('second child job run does not resend', async () => {
    await seedCompletedCall();
    const run = await createOrGetSchedulerRun({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'scheduled',
    });
    await processCaregiverDailyDigestJob({ runId: run._id });
    await processCaregiverDailyDigestJob({ runId: run._id });
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('recovers stale processing runs before retry', async () => {
    await seedCompletedCall();
    const run = await createOrGetSchedulerRun({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'scheduled',
    });
    run.status = 'processing';
    run.startedAt = new Date(inWindowNow.getTime() - 31 * 60 * 1000);
    await run.save();

    const recovered = await recoverStaleProcessingRuns({
      orgId: org._id,
      localDateKey,
      now: inWindowNow,
    });
    expect(recovered).toBe(1);
    const reloaded = await CaregiverDailyDigestSchedulerRun.findById(run._id);
    expect(reloaded.status).toBe('failed');
    expect(reloaded.lastError).toContain('Stale processing');

    await processCaregiverDailyDigestJob({ runId: run._id });
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('coordinator dryRun never sends email', async () => {
    await seedCompletedCall();
    const summary = await runDailyDigestCoordinatorTick({ now: inWindowNow, dryRun: true });
    expect(summary.dryRun).toBe(true);
    expect(summary.runsCreated).toBe(1);
    expect(summary.details[0].runs[0].action).toBe('would_create_run');
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(await CaregiverDailyDigestSchedulerRun.countDocuments({})).toBe(0);
  });

  it('coordinator skips org after send window', async () => {
    await seedCompletedCall();
    const afterWindowNow = new Date('2026-06-02T02:00:00.000Z'); // 19:00 Pacific
    const summary = await runDailyDigestCoordinatorTick({ now: afterWindowNow });
    expect(summary.orgsInWindow).toBe(0);
    expect(await CaregiverDailyDigestSchedulerRun.countDocuments({})).toBe(0);
  });

  it('coordinator works on DST spring-forward day', async () => {
    await Org.findByIdAndUpdate(org._id, {
      timezone: 'America/Los_Angeles',
      dailyDigestSettings: { enabled: true, sendTime: '18:00' },
    });
    await seedCompletedCall();
    // 2026-03-08 spring forward; 18:05 PDT = 2026-03-09T01:05:00.000Z
    const dstNow = new Date('2026-03-09T01:05:00.000Z');
    const summary = await runDailyDigestCoordinatorTick({ now: dstNow });
    expect(summary.orgsInWindow).toBe(1);
    expect(summary.details[0].localDateKey).toBe('2026-03-08');
  });

  it('does not recover active processing runs younger than stale threshold', async () => {
    const run = await createOrGetSchedulerRun({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey,
      trigger: 'scheduled',
    });
    run.status = 'processing';
    run.startedAt = new Date(inWindowNow.getTime() - 5 * 60 * 1000);
    await run.save();

    const recovered = await recoverStaleProcessingRuns({
      orgId: org._id,
      localDateKey,
      now: inWindowNow,
    });
    expect(recovered).toBe(0);
    const reloaded = await CaregiverDailyDigestSchedulerRun.findById(run._id);
    expect(reloaded.status).toBe('processing');
  });

  it('skips org when dailyDigestSettings.enabled is false', async () => {
    await Org.findByIdAndUpdate(org._id, { 'dailyDigestSettings.enabled': false });
    await seedCompletedCall();
    const summary = await runDailyDigestCoordinatorTick({ now: inWindowNow });
    expect(summary.orgsChecked).toBe(0);
    expect(summary.orgsInWindow).toBe(0);
  });

  it('records failure and success metadata on ledger rows', async () => {
    await seedCompletedCall();
    emailService.sendEmail.mockRejectedValueOnce(new Error('SES down'));
    const failRun = await createOrGetSchedulerRun({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey: '2026-06-02',
      trigger: 'scheduled',
    });
    await expect(processCaregiverDailyDigestJob({ runId: failRun._id })).rejects.toThrow('SES down');
    const failed = await CaregiverDailyDigestSchedulerRun.findById(failRun._id);
    expect(failed.status).toBe('failed');
    expect(failed.lastError).toBe('SES down');

    caregiver.notificationPreferences.dailyDigestEmail = false;
    await caregiver.save();
    const skipRun = await createOrGetSchedulerRun({
      orgId: org._id,
      caregiverId: caregiver._id,
      localDateKey: '2026-06-03',
      trigger: 'scheduled',
    });
    await processCaregiverDailyDigestJob({ runId: skipRun._id });
    const skipped = await CaregiverDailyDigestSchedulerRun.findById(skipRun._id);
    expect(skipped.status).toBe('skipped');
    expect(skipped.skipReason).toContain('Daily digest email notifications are not enabled');
  });
});
