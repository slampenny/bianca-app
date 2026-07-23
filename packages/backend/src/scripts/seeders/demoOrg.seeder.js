/**
 * Org-scoped demo data seeder.
 * All timestamps are derived from an injectable `now` (relative offsets only).
 */
const mongoose = require('mongoose');
const {
  Org,
  Caregiver,
  Client,
  Call,
  Conversation,
  Message,
  Alert,
  Schedule,
  Invoice,
  LineItem,
  PaymentMethod,
  OnboardingResponse,
  MedicalAnalysis,
  MedicalBaseline,
  FraudAbuseAnalysis,
  FamilyWeeklyDigest,
  FamilyResidentLink,
  CaregiverDailyDigest,
  CaregiverDailyDigestSchedulerRun,
  Report,
  ClientMemory,
} = require('../../models');

const DEMO_SEED_VERSION = 'demo-org-v1';
const ALLOWED_HISTORY_DAYS = Object.freeze([7, 30, 90, 180]);
const DEFAULT_HISTORY_DAYS = 90;
const DEMO_PASSWORD = 'Password1';

const TRAJECTORIES = Object.freeze({
  stable: {
    key: 'stable',
    name: 'Helen Stable',
    email: 'helen.stable@demo.biancatechnologies.com',
    preferredName: 'Helen',
    phone: '+16045550101',
    room: '101A',
    notes: 'Stable wellness trajectory for demo Long View.',
  },
  dipRecover: {
    key: 'dipRecover',
    name: 'Marcus Dip-Recover',
    email: 'marcus.dip@demo.biancatechnologies.com',
    preferredName: 'Marcus',
    phone: '+16045550102',
    room: '102B',
    notes: 'Mid-window mood dip that recovers — demo alert resolve story.',
  },
  decline: {
    key: 'decline',
    name: 'Ruth Decline',
    email: 'ruth.decline@demo.biancatechnologies.com',
    preferredName: 'Ruth',
    phone: '+16045550103',
    room: '103C',
    notes: 'Gradual cognitive/emotional decline over months — Long View story.',
  },
});

const FAMILY_PORTAL_EMAIL = 'family.demo@demo.biancatechnologies.com';

function assertAllowedHistoryDays(historyDays) {
  const n = Number(historyDays);
  if (!ALLOWED_HISTORY_DAYS.includes(n)) {
    throw new Error(`historyDays must be one of ${ALLOWED_HISTORY_DAYS.join(', ')}`);
  }
  return n;
}

function createClock(nowInput) {
  const now = nowInput instanceof Date ? new Date(nowInput.getTime()) : new Date(nowInput || Date.now());
  const daysAgo = (n, hour = 10, minute = 0) => {
    const d = new Date(now.getTime());
    d.setUTCDate(d.getUTCDate() - n);
    d.setUTCHours(hour, minute, 0, 0);
    return d;
  };
  const hoursAgo = (n) => new Date(now.getTime() - n * 60 * 60 * 1000);
  const localDateKey = (date) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { now, daysAgo, hoursAgo, localDateKey };
}

/**
 * Child collections wiped for an org-scoped demo refresh.
 * Used by wipe + orphan-check tests — keep in sync with wipeDemoOrgData.
 */
const DEMO_ORG_CHILD_COLLECTIONS = Object.freeze([
  { name: 'Client', orgField: 'org' },
  { name: 'CaregiverDailyDigest', orgField: 'org' },
  { name: 'CaregiverDailyDigestSchedulerRun', orgField: 'org' },
  { name: 'FamilyWeeklyDigest', orgField: 'org' },
  { name: 'FamilyResidentLink', orgField: 'org' },
  { name: 'Invoice', orgField: 'org' },
  { name: 'PaymentMethod', orgField: 'org' },
  { name: 'Call', clientField: 'clientId' },
  { name: 'Conversation', clientField: 'clientId' },
  { name: 'OnboardingResponse', clientField: 'clientId' },
  { name: 'MedicalAnalysis', clientField: 'clientId' },
  { name: 'MedicalBaseline', clientField: 'clientId' },
  { name: 'FraudAbuseAnalysis', clientField: 'clientId' },
  { name: 'Report', clientField: 'clientId' },
  { name: 'ClientMemory', clientField: 'clientId' },
  { name: 'Schedule', clientField: 'client' },
  { name: 'Alert', clientField: 'relatedClient' },
  { name: 'LineItem', clientField: 'clientId' },
]);

/**
 * Count remaining documents for an org (and optional prior client ids) across child collections.
 * @returns {Promise<Array<{ collection: string, count: number }>>}
 */
async function countOrgChildDocuments(orgId, clientIds = []) {
  const oid = new mongoose.Types.ObjectId(String(orgId));
  const cids = (clientIds || []).map((id) => new mongoose.Types.ObjectId(String(id)));
  const modelByName = {
    Client,
    CaregiverDailyDigest,
    CaregiverDailyDigestSchedulerRun,
    FamilyWeeklyDigest,
    FamilyResidentLink,
    Invoice,
    PaymentMethod,
    Call,
    Conversation,
    OnboardingResponse,
    MedicalAnalysis,
    MedicalBaseline,
    FraudAbuseAnalysis,
    Report,
    ClientMemory,
    Schedule,
    Alert,
    LineItem,
  };

  const results = [];
  for (const spec of DEMO_ORG_CHILD_COLLECTIONS) {
    const Model = modelByName[spec.name];
    if (!Model) continue;
    let filter;
    if (spec.orgField) {
      filter = { [spec.orgField]: oid };
    } else if (spec.clientField && cids.length) {
      filter = { [spec.clientField]: { $in: cids } };
    } else {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const count = await Model.countDocuments(filter);
    results.push({ collection: spec.name, count });
  }

  // Messages for conversations of these clients
  if (cids.length) {
    const convIds = await Conversation.find({ clientId: { $in: cids } }).distinct('_id');
    const messageCount = convIds.length
      ? await Message.countDocuments({ conversationId: { $in: convIds } })
      : 0;
    results.push({ collection: 'Message', count: messageCount });
  }

  return results;
}

/**
 * Wipe all demo-seeded operational data for an org. Keeps the Org document and
 * non-family caregivers. Deletes family-role caregivers created for the portal demo.
 */
async function wipeDemoOrgData(orgId) {
  const oid = new mongoose.Types.ObjectId(String(orgId));
  const clients = await Client.find({ org: oid }).select('_id').lean();
  const clientIds = clients.map((c) => c._id);

  if (clientIds.length) {
    const conversations = await Conversation.find({ clientId: { $in: clientIds } }).select('_id').lean();
    const conversationIds = conversations.map((c) => c._id);
    if (conversationIds.length) {
      await Message.deleteMany({ conversationId: { $in: conversationIds } });
    }
    await Conversation.deleteMany({ clientId: { $in: clientIds } });
    await Call.deleteMany({ clientId: { $in: clientIds } });
    await OnboardingResponse.deleteMany({ clientId: { $in: clientIds } });
    await MedicalAnalysis.deleteMany({ clientId: { $in: clientIds } });
    await MedicalBaseline.deleteMany({ clientId: { $in: clientIds } });
    await FraudAbuseAnalysis.deleteMany({ clientId: { $in: clientIds } });
    await Report.deleteMany({ clientId: { $in: clientIds } });
    await ClientMemory.deleteMany({ clientId: { $in: clientIds } });
    await Schedule.deleteMany({ client: { $in: clientIds } });
    await Alert.deleteMany({ relatedClient: { $in: clientIds } });
    await LineItem.deleteMany({ clientId: { $in: clientIds } });
  }

  await FamilyWeeklyDigest.deleteMany({ org: oid });
  await FamilyResidentLink.deleteMany({ org: oid });
  await CaregiverDailyDigest.deleteMany({ org: oid });
  await CaregiverDailyDigestSchedulerRun.deleteMany({ org: oid });
  await Invoice.deleteMany({ org: oid });
  await PaymentMethod.deleteMany({ org: oid });

  // Remove family portal demo caregivers; keep staff/orgAdmin/superAdmin
  await Caregiver.deleteMany({ org: oid, role: 'family' });
  // Remove prior demo residents
  await Client.deleteMany({ org: oid });

  await Org.findByIdAndUpdate(oid, {
    $set: { clients: [], patients: [] },
  });

  return { wipedClientIds: clientIds.map(String) };
}

function scoreForTrajectory(trajectoryKey, progress01) {
  // progress01: 0 = oldest, 1 = newest
  if (trajectoryKey === 'stable') {
    return {
      cognitive: 12 + Math.round(2 * Math.sin(progress01 * Math.PI * 2)),
      depression: 10 + Math.round(2 * Math.cos(progress01 * Math.PI * 2)),
      anxiety: 8 + Math.round(1.5 * Math.sin(progress01 * Math.PI)),
      fraudOverall: 14,
    };
  }
  if (trajectoryKey === 'dipRecover') {
    // Peak distress around progress 0.55–0.7, then recover
    const dip = Math.exp(-Math.pow((progress01 - 0.62) / 0.12, 2));
    return {
      cognitive: Math.round(14 + 22 * dip),
      depression: Math.round(12 + 40 * dip),
      anxiety: Math.round(10 + 35 * dip),
      fraudOverall: Math.round(16 + 8 * dip),
    };
  }
  // gradual decline
  return {
    cognitive: Math.round(10 + 45 * progress01),
    depression: Math.round(8 + 38 * progress01),
    anxiety: Math.round(7 + 30 * progress01),
    fraudOverall: Math.round(12 + 20 * progress01),
  };
}

function clientLineForTrajectory(trajectoryKey, daysAgo, historyDays) {
  const progress = 1 - daysAgo / Math.max(historyDays, 1);
  if (trajectoryKey === 'stable') {
    return 'I am feeling well today. Sleep has been fine and I have been enjoying visits with family.';
  }
  if (trajectoryKey === 'dipRecover') {
    if (daysAgo >= 5 && daysAgo <= 14) {
      return 'I have been feeling quite low and anxious this week. Some days I do not want to get out of bed.';
    }
    if (daysAgo < 5) {
      return 'I am feeling much better than last week. Talking helped, and my mood is lifting again.';
    }
    return 'Things have been mostly okay. A little tired but managing.';
  }
  // decline
  if (progress > 0.7) {
    return 'I keep forgetting appointments and get confused about what day it is. I feel worried about my memory.';
  }
  if (progress > 0.4) {
    return 'I notice I am more forgetful and a bit down. Daily tasks take longer than they used to.';
  }
  return 'I am doing alright overall, though I have small memory lapses now and then.';
}

async function createCallConversation({
  client,
  caregiverId,
  at,
  daysAgo,
  historyDays,
  trajectoryKey,
  clock,
}) {
  const durationMin = 18 + (daysAgo % 7);
  const end = new Date(at.getTime() + durationMin * 60 * 1000);
  const call = await Call.create({
    callSid: `DEMO_ORG_${client._id}_${at.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    clientId: client._id,
    callType: 'wellness-check',
    status: 'completed',
    callStatus: 'ended',
    callOutcome: 'answered',
    startTime: at,
    endTime: end,
    callStartTime: at,
    callEndTime: end,
    duration: durationMin,
    callDuration: durationMin,
    cost: 0.25,
    createdAt: at,
    updatedAt: at,
  });

  const sentimentScore =
    trajectoryKey === 'stable'
      ? 0.55
      : trajectoryKey === 'dipRecover'
        ? daysAgo >= 5 && daysAgo <= 14
          ? -0.45
          : 0.35
        : -0.1 - 0.5 * (1 - daysAgo / Math.max(historyDays, 1));

  const conv = new Conversation({
    callId: call._id,
    clientId: client._id,
    messages: [],
    history: `Wellness check ${daysAgo}d ago (${trajectoryKey}).`,
    analyzedData: {
      sentiment: {
        overall: sentimentScore,
        label: sentimentScore >= 0.2 ? 'positive' : sentimentScore <= -0.2 ? 'negative' : 'neutral',
        clientMood: clientLineForTrajectory(trajectoryKey, daysAgo, historyDays).slice(0, 120),
        summary: `Seeded ${trajectoryKey} conversation from ${daysAgo} days ago.`,
      },
      sentimentAnalyzedAt: at,
    },
    metadata: { source: 'demo_org_seed', trajectory: trajectoryKey, daysAgo },
    createdAt: at,
    updatedAt: at,
  });
  await conv.save();

  const lines = [
    {
      role: 'assistant',
      content: `Hello ${client.preferredName}! This is Bianca calling for your wellness check. How are you feeling today?`,
    },
    {
      role: 'client',
      content: clientLineForTrajectory(trajectoryKey, daysAgo, historyDays),
    },
    {
      role: 'assistant',
      content: 'Thank you for sharing. I am here with you, and your care team will follow up if needed.',
    },
  ];
  for (let i = 0; i < lines.length; i += 1) {
    const msgAt = new Date(at.getTime() + (i + 1) * 60 * 1000);
    // eslint-disable-next-line no-await-in-loop
    const msg = await Message.create({
      role: lines[i].role,
      content: lines[i].content,
      conversationId: conv._id,
      createdAt: msgAt,
      updatedAt: msgAt,
    });
    conv.messages.push(msg._id);
  }
  await conv.save();
  return { call, conversation: conv };
}

/**
 * Seed rich demo data into an existing isDemo org.
 */
async function seedDemoOrgData({
  orgId,
  historyDays = DEFAULT_HISTORY_DAYS,
  now: nowInput = new Date(),
  staffCaregiverId = null,
} = {}) {
  const days = assertAllowedHistoryDays(historyDays);
  const clock = createClock(nowInput);
  const { now, daysAgo, localDateKey } = clock;
  const oid = new mongoose.Types.ObjectId(String(orgId));

  const org = await Org.findById(oid);
  if (!org) {
    throw new Error(`Org ${orgId} not found`);
  }

  // Prefer explicit id, else existing orgAdmin (incl. inactive), else other staff roles.
  // Do not require active:true — refresh must reactivate the primary caregiver.
  let staff = staffCaregiverId ? await Caregiver.findById(staffCaregiverId) : null;
  if (!staff) {
    staff = await Caregiver.findOne({ org: oid, role: 'orgAdmin' });
  }
  if (!staff) {
    staff = await Caregiver.findOne({
      org: oid,
      role: { $in: ['staff', 'superAdmin'] },
    });
  }
  if (!staff) {
    staff = await Caregiver.create({
      org: oid,
      name: 'Demo Staff',
      email: `demo.staff.${String(oid).slice(-6)}@demo.biancatechnologies.com`,
      phone: '+16045550999',
      role: 'orgAdmin',
      password: DEMO_PASSWORD,
      isEmailVerified: true,
      onboardingComplete: true,
      active: true,
      notificationPreferences: { dailyDigestEmail: true },
      clients: [],
    });
    await Org.findByIdAndUpdate(oid, { $addToSet: { caregivers: staff._id } });
  }

  const clients = [];
  const trajectoryKeys = ['stable', 'dipRecover', 'decline'];
  for (let i = 0; i < trajectoryKeys.length; i += 1) {
    const key = trajectoryKeys[i];
    const t = TRAJECTORIES[key];
    // eslint-disable-next-line no-await-in-loop
    const client = await Client.create({
      name: t.name,
      email: t.email,
      phone: t.phone,
      preferredName: t.preferredName,
      preferredLanguage: 'en',
      room: t.room,
      notes: t.notes,
      org: oid,
      caregivers: [staff._id],
      moveInDate: daysAgo(Math.min(days + 120, 400)),
      isActive: true,
      isEmailVerified: true,
      createdAt: daysAgo(days + 30),
      updatedAt: now,
    });
    clients.push({ client, trajectoryKey: key });
  }

  // Every refresh: force primary staff digest gates Ready (not Demo Family / other roles).
  await Caregiver.findByIdAndUpdate(staff._id, {
    $set: {
      clients: clients.map(({ client }) => client._id),
      isEmailVerified: true,
      active: true,
      'notificationPreferences.dailyDigestEmail': true,
    },
  });
  await Org.findByIdAndUpdate(oid, {
    $set: {
      clients: clients.map(({ client }) => client._id),
      patients: clients.map(({ client }) => client._id),
      familyPortalSettings: { enabled: true, allowInviteAfterDigestVerify: true },
      dailyDigestSettings: { enabled: true, sendTime: org.dailyDigestSettings?.sendTime || '18:00' },
    },
  });

  const callCadence = 3;
  const analysisCadence = 7;
  const createdConversations = [];

  for (const { client, trajectoryKey } of clients) {
    const schedule = new Schedule({
      frequency: 'daily',
      time: '10:00',
      isActive: true,
      client: client._id,
    });
    schedule.calculateNextCallDate();
    // eslint-disable-next-line no-await-in-loop
    await schedule.save();
    client.schedules = [schedule._id];
    // eslint-disable-next-line no-await-in-loop
    await client.save();

    for (let d = 0; d <= days; d += callCadence) {
      const at = daysAgo(d, 10 + (d % 5), 15);
      // eslint-disable-next-line no-await-in-loop
      const created = await createCallConversation({
        client,
        caregiverId: staff._id,
        at,
        daysAgo: d,
        historyDays: days,
        trajectoryKey,
        clock,
      });
      createdConversations.push({ ...created, client, trajectoryKey, daysAgo: d });
    }

    // Medical + fraud time series (weekly)
    const analysisPoints = Math.max(2, Math.floor(days / analysisCadence) + 1);
    for (let i = 0; i < analysisPoints; i += 1) {
      const daysBack = Math.min(days, i * analysisCadence);
      const analysisDate = daysAgo(daysBack, 12, 0);
      const progress01 = 1 - daysBack / Math.max(days, 1);
      const scores = scoreForTrajectory(trajectoryKey, progress01);
      const weekStart = daysAgo(daysBack + 6, 0, 0);
      // eslint-disable-next-line no-await-in-loop
      await MedicalAnalysis.create({
        clientId: client._id,
        analysisDate,
        timeRange: 'custom',
        startDate: weekStart,
        endDate: analysisDate,
        conversationCount: 4,
        messageCount: 16,
        totalWords: 1400,
        confidence: 'medium',
        cognitiveMetrics: {
          riskScore: Math.min(100, Math.max(0, scores.cognitive)),
          confidence: 'medium',
        },
        psychiatricMetrics: {
          depressionScore: Math.min(100, Math.max(0, scores.depression)),
          anxietyScore: Math.min(100, Math.max(0, scores.anxiety)),
          crisisIndicators: { hasCrisisIndicators: false, crisisCount: 0, crisisWords: [] },
        },
        warnings: [],
        recommendations: [],
        createdAt: analysisDate,
        updatedAt: analysisDate,
      });
      // eslint-disable-next-line no-await-in-loop
      await FraudAbuseAnalysis.create({
        clientId: client._id,
        analysisDate,
        timeRange: 'custom',
        startDate: weekStart,
        endDate: analysisDate,
        conversationCount: 4,
        messageCount: 16,
        totalWords: 1400,
        overallRiskScore: Math.min(100, Math.max(0, scores.fraudOverall)),
        confidence: 'medium',
        financialRisk: { riskScore: Math.min(100, scores.fraudOverall - 2), confidence: 'medium' },
        abuseRisk: { riskScore: Math.max(5, scores.fraudOverall - 10), confidence: 'medium' },
        relationshipRisk: { riskScore: Math.max(5, scores.fraudOverall - 8), confidence: 'medium' },
        warnings: [],
        recommendations: [],
        createdAt: analysisDate,
        updatedAt: analysisDate,
      });
    }
  }

  // Alerts: dip-recover mid-window (resolved), decline open
  const dipClient = clients.find((c) => c.trajectoryKey === 'dipRecover')?.client;
  const declineClient = clients.find((c) => c.trajectoryKey === 'decline')?.client;
  const dipConv = createdConversations.find(
    (c) => c.trajectoryKey === 'dipRecover' && c.daysAgo >= 7 && c.daysAgo <= 12
  );
  if (dipClient && dipConv) {
    await Alert.create({
      importance: 'high',
      alertType: 'conversation',
      message: 'Mood decline detected mid-week for Marcus — follow-up recommended.',
      relatedClient: dipClient._id,
      relatedConversation: dipConv.conversation._id,
      visibility: 'allCaregivers',
      createdBy: staff._id,
      createdModel: 'Caregiver',
      relevanceUntil: daysAgo(3),
      resolvedAt: daysAgo(2, 16, 0),
      readBy: [staff._id],
      createdAt: daysAgo(10, 11, 0),
      updatedAt: daysAgo(2, 16, 0),
    });
  }
  if (declineClient) {
    const declineConv = createdConversations.find((c) => c.trajectoryKey === 'decline' && c.daysAgo <= 5);
    await Alert.create({
      importance: 'urgent',
      alertType: 'conversation',
      message: 'Gradual cognitive decline pattern over recent weeks for Ruth.',
      relatedClient: declineClient._id,
      relatedConversation: declineConv?.conversation?._id,
      visibility: 'allCaregivers',
      createdBy: staff._id,
      createdModel: 'Caregiver',
      relevanceUntil: daysAgo(-2), // still relevant (in the future)
      readBy: [],
      createdAt: daysAgo(4, 9, 0),
      updatedAt: daysAgo(4, 9, 0),
    });
  }

  // Family portal + weekly digests for stable resident
  const stableClient = clients.find((c) => c.trajectoryKey === 'stable')?.client;
  if (stableClient) {
    const recipientId = new mongoose.Types.ObjectId();
    stableClient.familyDigestRecipients = [
      {
        _id: recipientId,
        name: 'Demo Family',
        relationship: 'daughter',
        email: FAMILY_PORTAL_EMAIL,
        familyDigestEmail: {
          enabled: true,
          verifiedAt: daysAgo(20),
          verifiedEmail: FAMILY_PORTAL_EMAIL,
        },
      },
    ];
    await stableClient.save();

    const familyCg = await Caregiver.create({
      org: oid,
      name: 'Demo Family',
      email: FAMILY_PORTAL_EMAIL,
      phone: '+16045550111',
      role: 'family',
      password: DEMO_PASSWORD,
      isEmailVerified: true,
      onboardingComplete: true,
      active: true,
      clients: [stableClient._id],
    });
    await Org.findByIdAndUpdate(oid, { $addToSet: { caregivers: familyCg._id } });
    await FamilyResidentLink.create({
      caregiver: familyCg._id,
      org: oid,
      client: stableClient._id,
      recipientId,
      portalEnabled: true,
      invitedBy: staff._id,
      invitedAt: daysAgo(20),
    });

    const weeks = Math.max(1, Math.ceil(days / 7));
    for (let w = 0; w < weeks; w += 1) {
      const weekEnd = daysAgo(w * 7, 6, 59);
      const weekStart = daysAgo(w * 7 + 6, 7, 0);
      const key = localDateKey(weekStart);
      // eslint-disable-next-line no-await-in-loop
      await FamilyWeeklyDigest.create({
        org: oid,
        client: stableClient._id,
        weekStart,
        weekEnd,
        localWeekKey: key,
        timezoneAtBuild: org.timezone || 'America/Los_Angeles',
        legacyUtcWeek: false,
        status: 'sent',
        sentAt: weekEnd,
        emailRecipients: [FAMILY_PORTAL_EMAIL.toLowerCase()],
        emailRecipient: FAMILY_PORTAL_EMAIL.toLowerCase(),
        recipient: {
          name: 'Demo Family',
          relationship: 'daughter',
          email: FAMILY_PORTAL_EMAIL,
        },
        payload: {
          version: 1,
          title: 'Weekly call digest for families',
          localWeekKey: key,
          atAGlance: {
            weekRangeLabel: key,
            callsPlaced: 3,
            answeredCount: 3,
          },
          callRows: [],
          narrative: [],
          subtitleParts: {
            recipientLine: 'For Demo Family',
            residentLine: `Your loved one: ${stableClient.name}`,
          },
          eligibility: { ok: true, reasons: [], warnings: [] },
        },
        createdBy: staff._id,
        createdAt: weekEnd,
        updatedAt: weekEnd,
      });
    }
  }

  // Caregiver daily digests for recent days (ties into digest feature)
  const dailyDays = Math.min(7, days);
  for (let d = 0; d < dailyDays; d += 1) {
    const digestAt = daysAgo(d, 18, 5);
    const key = localDateKey(digestAt);
    // eslint-disable-next-line no-await-in-loop
    await CaregiverDailyDigest.create({
      org: oid,
      caregiver: staff._id,
      digestDate: digestAt,
      localDateKey: key,
      timezoneAtBuild: org.timezone || 'America/Los_Angeles',
      legacyUtcDay: false,
      version: 1,
      builtAt: digestAt,
      locale: 'en',
      status: 'sent',
      sentAt: digestAt,
      emailRecipient: staff.email,
      emailSubject: `Daily care digest — ${key}`,
      emailMessageId: `<demo-seed-${key}@ca-central-1.amazonses.com>`,
      payload: {
        version: 1,
        title: 'Daily wellness digest',
        localDateKey: key,
        rows: clients.map(({ client, trajectoryKey }) => ({
          clientId: String(client._id),
          clientName: client.name,
          trajectory: trajectoryKey,
          summary: `Seeded daily summary for ${client.preferredName}`,
        })),
      },
      payloadHash: `demo-${key}`,
      sentPayloadHash: `demo-${key}`,
      createdAt: digestAt,
      updatedAt: digestAt,
    });
  }

  await Org.findByIdAndUpdate(oid, {
    $set: {
      demoSeededAt: now,
      demoHistoryDays: days,
      demoSeedVersion: DEMO_SEED_VERSION,
    },
  });

  return {
    orgId: String(oid),
    historyDays: days,
    seedVersion: DEMO_SEED_VERSION,
    seededAt: now.toISOString(),
    clients: clients.map(({ client, trajectoryKey }) => ({
      id: String(client._id),
      name: client.name,
      email: client.email,
      trajectory: trajectoryKey,
    })),
    staffCaregiverId: String(staff._id),
    staffEmail: staff.email,
    conversationCount: createdConversations.length,
    analysisPointsPerClient: Math.max(2, Math.floor(days / analysisCadence) + 1),
  };
}

module.exports = {
  DEMO_SEED_VERSION,
  ALLOWED_HISTORY_DAYS,
  DEFAULT_HISTORY_DAYS,
  TRAJECTORIES,
  DEMO_ORG_CHILD_COLLECTIONS,
  assertAllowedHistoryDays,
  createClock,
  countOrgChildDocuments,
  wipeDemoOrgData,
  seedDemoOrgData,
  scoreForTrajectory,
};
