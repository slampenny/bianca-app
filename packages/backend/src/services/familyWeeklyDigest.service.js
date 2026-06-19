const httpStatus = require('http-status');
const moment = require('moment-timezone');
const { Client, Call, Conversation, Caregiver, FamilyWeeklyDigest, Org } = require('../models');
const { toOrgIdString } = require('../dtos/caregiver.dto');
const { hashPayload } = require('../utils/digestPayloadHash');
const {
  resolveOrgLocalDigestWeek,
  startOfUtcWeekContaining,
  endOfUtcWeek,
} = require('../utils/digestWeek.utils');
const {
  FAMILY_SAFE_NO_SUMMARY_FALLBACK,
  FAMILY_AI_DISCLAIMER,
  FAMILY_CONFIDENTIAL_FOOTER,
  isUnsafeDigestText,
  isTranscriptLikeText,
} = require('../utils/digestContentSafety');
const { buildFamilyDigestEligibility } = require('../utils/familyDigestEligibility');
const {
  getPrimaryFamilyDigestRecipient,
  getEligibleFamilyDigestRecipients,
  buildAggregateFamilyDigestEligibility,
  recipientSnapshot,
  personalizePayloadForRecipient,
} = require('../utils/clientContacts.util');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const emailService = require('./email.service');
const validator = require('validator');

const SEND_IN_PROGRESS_TIMEOUT_MS = 10 * 60 * 1000;

const truncate = (s, max) => {
  const t = String(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
};

const formatWeekRangeLabel = (timezone, localWeekKey) => {
  const tz = timezone;
  const mon = moment.tz(localWeekKey, 'YYYY-MM-DD', true, tz);
  const sun = mon.clone().add(6, 'days');
  const fmt = (m) => m.format('MMM D, YYYY');
  return `${fmt(mon)} – ${fmt(sun)}`;
};

const formatCallDayLabels = (timezone, startTime) => {
  const m = moment.tz(startTime, timezone);
  return {
    dayLabel: m.format('ddd'),
    dateLabel: m.format('MMM D'),
  };
};

const isCallAnswered = (call) =>
  call.callOutcome === 'answered' || (Number(call.duration) > 0 && call.status === 'completed');

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Prefer Conversation.summary when safe; use history only if summary is absent and not transcript-like.
 */
const pickSafeConversationText = (conv) => {
  const summaryRaw = conv?.summary ? String(conv.summary).trim() : '';
  const historyRaw = conv?.history ? String(conv.history).trim() : '';

  if (summaryRaw) {
    if (!isUnsafeDigestText(summaryRaw) && !isTranscriptLikeText(summaryRaw)) {
      return truncate(summaryRaw, 220);
    }
    return FAMILY_SAFE_NO_SUMMARY_FALLBACK;
  }

  if (historyRaw) {
    if (!isUnsafeDigestText(historyRaw) && !isTranscriptLikeText(historyRaw)) {
      return truncate(historyRaw, 220);
    }
    return FAMILY_SAFE_NO_SUMMARY_FALLBACK;
  }

  return null;
};

const familySafeSummary = (call, conv, answered) => {
  if (!answered) {
    return "No answer — we'll try again.";
  }
  const safeText = pickSafeConversationText(conv);
  if (safeText) {
    return safeText;
  }
  const sec = Number(call.duration || call.callDuration || 0);
  if (sec > 0) {
    const min = Math.max(1, Math.round(sec / 60));
    return `Wellness check-in completed (about ${min} min).`;
  }
  return 'Wellness check-in completed.';
};

const ensureCaregiverCanAccessClient = async (caregiver, client) => {
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  if (caregiver.role === 'superAdmin') {
    return;
  }
  const clientOrg = toOrgIdString(client.org);
  const caregiverOrg = toOrgIdString(caregiver.org);
  if (!clientOrg || !caregiverOrg || clientOrg !== caregiverOrg) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this client');
  }
  if (caregiver.role === 'orgAdmin') {
    return;
  }
  const caregiverDoc = await Caregiver.findById(caregiver.id || caregiver._id).select('clients');
  if (!caregiverDoc) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Caregiver not found');
  }
  const idStr = client._id.toString();
  const onRoster = (caregiverDoc.clients || []).some((p) => (p._id ? p._id.toString() : p.toString()) === idStr);
  const assignedOnClient =
    Array.isArray(client.caregivers) &&
    client.caregivers.some((c) => (c._id ? c._id.toString() : c.toString()) === caregiver.id.toString());
  if (onRoster || assignedOnClient) {
    return;
  }
  const callCount = await Call.countDocuments({ clientId: client._id, caregiverId: caregiver.id });
  if (callCount === 0) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this client');
  }
};

/** Allow read access to redacted audit records when the source client was removed. */
const ensureCaregiverCanAccessDigest = async (caregiver, digest) => {
  if (caregiver.role !== 'superAdmin' && toOrgIdString(digest.org) !== toOrgIdString(caregiver.org)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this digest');
  }
  const client = await Client.findById(digest.client);
  if (client) {
    await ensureCaregiverCanAccessClient(caregiver, client);
    return;
  }
  const isRedacted = Boolean(digest.phiRedactedAt || digest.payload?.phiRedacted);
  if (isRedacted && (caregiver.role === 'orgAdmin' || caregiver.role === 'superAdmin')) {
    return;
  }
  throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
};

const getRecipientFromClient = (client) => recipientSnapshot(getPrimaryFamilyDigestRecipient(client));

const buildEligibility = (client) => buildAggregateFamilyDigestEligibility(client);

/**
 * Build digest payload from calls/conversations (no persist).
 */
const buildPayloadForWeek = async (client, orgName, weekContext) => {
  const { localWeekKey, weekStart, weekEndExclusive, weekEnd, timezone } = weekContext;
  const calls = await Call.find({
    clientId: client._id,
    startTime: { $gte: weekStart, $lt: weekEndExclusive },
  })
    .sort({ startTime: 1 })
    .lean();

  const callIds = calls.map((c) => c._id);
  const convs = await Conversation.find({ callId: { $in: callIds } })
    .select('callId summary history analyzedData')
    .lean();
  const convByCallId = new Map(convs.map((c) => [c.callId.toString(), c]));

  const displayFirst =
    (client.preferredName && String(client.preferredName).trim().split(/\s+/)[0]) ||
    (client.name && String(client.name).trim().split(/\s+/)[0]) ||
    'your loved one';

  const { pickAnswersForDigest, formatAnswersPlain } = require('./requiredCallQuestions.service');

  const callRows = calls.map((call) => {
    const answered = isCallAnswered(call);
    const conv = convByCallId.get(call._id.toString());
    const t = call.startTime ? new Date(call.startTime) : new Date(0);
    const { dayLabel, dateLabel } = formatCallDayLabels(timezone, t);
    const requiredQuestionAnswers = answered ? pickAnswersForDigest(conv?.analyzedData) : [];
    let summary = familySafeSummary(call, conv, answered);
    if (requiredQuestionAnswers.length > 0) {
      const reqLine = formatAnswersPlain(requiredQuestionAnswers);
      summary = `${summary} Standard questions: ${reqLine}`;
    }
    return {
      dayLabel,
      dateLabel,
      connected: answered,
      summary,
      requiredQuestionAnswers,
    };
  });

  const answeredCount = calls.filter((c) => isCallAnswered(c)).length;
  const answeredDurations = calls.filter((c) => isCallAnswered(c)).map((c) => Number(c.duration || c.callDuration || 0));
  const typicalSeconds =
    answeredDurations.length === 0
      ? null
      : Math.round(answeredDurations.reduce((a, b) => a + b, 0) / answeredDurations.length);

  const atAGlance = {
    weekRangeLabel: formatWeekRangeLabel(timezone, localWeekKey),
    callsPlaced: calls.length,
    answeredCount,
    typicalMinutesWhenConnected:
      typicalSeconds == null ? null : Math.max(1, Math.round(typicalSeconds / 60)),
  };

  const exclusions = [
    { topic: 'Diagnoses, medications, vitals', instead: 'Call the care team or nurse line.' },
    { topic: 'Full recordings or word-for-word transcripts', instead: 'Not included by design.' },
    { topic: 'Other residents', instead: 'Each send is scoped to one authorized contact.' },
  ];

  const recipient = getRecipientFromClient(client);
  const eligibility = buildEligibility(client);

  const narrative = [
    'This digest describes wellness check-in calls only — not clinical care.',
    'If you received this message by mistake, contact the facility and do not forward.',
    FAMILY_AI_DISCLAIMER,
  ];

  const payload = {
    version: 1,
    title: 'Weekly call digest for families',
    subtitleParts: {
      recipientLine: recipient.name
        ? `For ${recipient.name}${recipient.relationship ? ` (${recipient.relationship})` : ''}`
        : recipient.relationship
          ? `For ${recipient.relationship}`
          : 'For authorized contact on file',
      residentLine: `Your loved one: ${displayFirst}`,
    },
    facilityName: orgName,
    generatedAt: new Date().toISOString(),
    localWeekKey,
    timezoneAtBuild: timezone,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    narrative,
    atAGlance,
    callRows,
    exclusions,
    eligibility,
  };

  return { payload, recipient, eligibility, weekEnd, localWeekKey, timezone };
};

const payloadToEmailHtml = (payload, orgName) => {
  const sub = `${payload.subtitleParts.recipientLine} · ${payload.subtitleParts.residentLine}`;
  const narrativeWithoutDisclaimer = (payload.narrative || []).filter((line) => line !== FAMILY_AI_DISCLAIMER);
  const rows = payload.callRows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(`${r.dayLabel} ${r.dateLabel}`)}</td><td>${r.connected ? 'Yes' : 'No'}</td><td>${escapeHtml(r.summary)}</td></tr>`
    )
    .join('');
  const exc = payload.exclusions
    .map((e) => `<tr><td>${escapeHtml(e.topic)}</td><td>${escapeHtml(e.instead)}</td></tr>`)
    .join('');
  const typicalDetail =
    payload.atAGlance.typicalMinutesWhenConnected == null
      ? '—'
      : `~${payload.atAGlance.typicalMinutesWhenConnected} min`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5;color:#0f172a">
<p style="font-weight:700">bianca<span style="color:#14b8a6">.</span></p>
<h1 style="font-size:1.25rem">${escapeHtml(payload.title)}</h1>
<p style="color:#64748b;font-size:0.9rem">${escapeHtml(sub)} · ${escapeHtml(orgName)} · ${escapeHtml(payload.atAGlance.weekRangeLabel)}</p>
<ul>${narrativeWithoutDisclaimer.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
<h2 style="font-size:1rem">Week at a glance</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:0.85rem"><tr><th>Metric</th><th>Detail</th></tr>
<tr><td>Calls placed</td><td>${payload.atAGlance.callsPlaced}</td></tr>
<tr><td>Answered</td><td>${payload.atAGlance.answeredCount}</td></tr>
<tr><td>Typical length (when connected)</td><td>${escapeHtml(typicalDetail)}</td></tr>
</table>
<h2 style="font-size:1rem">This week</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:0.85rem"><tr><th>Day</th><th>Connected</th><th>Summary</th></tr>${rows}</table>
<h2 style="font-size:1rem">What’s not in this message</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:0.85rem"><tr><th>Topic</th><th>Instead</th></tr>${exc}</table>
<p style="margin-top:24px;font-size:0.75rem;color:#94a3b8">${escapeHtml(FAMILY_AI_DISCLAIMER)}</p>
<p style="margin-top:8px;font-size:0.75rem;color:#94a3b8">${escapeHtml(FAMILY_CONFIDENTIAL_FOOTER)}</p>
</body></html>`;
};

const payloadToPlainText = (payload, orgName) => {
  const sub = `${payload.subtitleParts.recipientLine} · ${payload.subtitleParts.residentLine}`;
  const narrativeWithoutDisclaimer = (payload.narrative || []).filter((line) => line !== FAMILY_AI_DISCLAIMER);
  const lines = [
    payload.title,
    `${sub} · ${orgName} · ${payload.atAGlance.weekRangeLabel}`,
    '',
    ...narrativeWithoutDisclaimer,
    '',
    'Week at a glance',
    `Calls placed: ${payload.atAGlance.callsPlaced}`,
    `Answered: ${payload.atAGlance.answeredCount}`,
    `Typical length (when connected): ${
      payload.atAGlance.typicalMinutesWhenConnected == null
        ? '—'
        : `~${payload.atAGlance.typicalMinutesWhenConnected} min`
    }`,
    '',
    'This week',
  ];
  (payload.callRows || []).forEach((r) => {
    lines.push(
      `- ${r.dayLabel} ${r.dateLabel} · Connected: ${r.connected ? 'Yes' : 'No'} · ${r.summary}`
    );
  });
  lines.push('', 'What’s not in this message');
  (payload.exclusions || []).forEach((e) => {
    lines.push(`- ${e.topic}: ${e.instead}`);
  });
  lines.push('', FAMILY_AI_DISCLAIMER, FAMILY_CONFIDENTIAL_FOOTER);
  return lines.join('\n');
};

const clearDraftEmailMetadata = (doc) => {
  doc.sentAt = null;
  doc.sentPayloadHash = null;
  doc.emailMessageId = null;
  doc.emailRecipient = null;
  doc.emailSubject = null;
  doc.sendInProgressAt = null;
};

const assertDigestIsDraft = (digestDoc) => {
  if (digestDoc.status === 'sent') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Sent digest records are immutable');
  }
};

/** Refresh an existing draft in place. Never use on sent records. */
const updateDraftDigest = async (digestDoc, { payload, recipient, weekEnd }) => {
  assertDigestIsDraft(digestDoc);
  digestDoc.payload = payload;
  digestDoc.payloadHash = hashPayload(payload);
  digestDoc.recipient = recipient;
  if (weekEnd) {
    digestDoc.weekEnd = weekEnd;
  }
  clearDraftEmailMetadata(digestDoc);
  await digestDoc.save();
  return digestDoc;
};

/** Mark a draft digest as sent after successful email delivery. */
const markDigestSent = async (digestDoc, { emails, subject, messageIds, payloadHashAtSend }) => {
  assertDigestIsDraft(digestDoc);
  const recipients = Array.isArray(emails) ? emails.filter(Boolean) : [];
  digestDoc.status = 'sent';
  digestDoc.sentAt = new Date();
  digestDoc.sentPayloadHash = payloadHashAtSend;
  digestDoc.payloadHash = payloadHashAtSend;
  digestDoc.emailRecipients = recipients;
  digestDoc.emailRecipient = recipients.length > 0 ? recipients.join(', ') : null;
  digestDoc.emailSubject = subject;
  digestDoc.emailMessageId = Array.isArray(messageIds) ? messageIds.filter(Boolean).join(', ') : messageIds;
  digestDoc.sendInProgressAt = null;
  await digestDoc.save();
  return digestDoc;
};

const extractEmailMessageId = (sendResult) => {
  if (!sendResult || typeof sendResult !== 'object') {
    return null;
  }
  return (
    sendResult.messageId ||
    sendResult.MessageId ||
    sendResult.raw?.messageId ||
    sendResult.raw?.id ||
    null
  );
};

const previewDigest = async (caregiver, clientId, weekStartInput) => {
  const client = await Client.findById(clientId);
  await ensureCaregiverCanAccessClient(caregiver, client);
  const org = await Org.findById(client.org);
  const orgName = org?.name || 'Your care community';
  let weekContext;
  try {
    weekContext = resolveOrgLocalDigestWeek(org?.timezone, weekStartInput);
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message || 'Invalid weekStart date');
  }
  const { payload, recipient, eligibility } = await buildPayloadForWeek(client, orgName, weekContext);
  return {
    payload,
    recipient,
    eligibility,
    localWeekKey: weekContext.localWeekKey,
    weekStart: weekContext.weekStart.toISOString(),
  };
};

const createDigest = async (caregiver, clientId, weekStartInput) => {
  const client = await Client.findById(clientId);
  await ensureCaregiverCanAccessClient(caregiver, client);
  const org = await Org.findById(client.org);
  const orgName = org?.name || 'Your care community';
  let weekContext;
  try {
    weekContext = resolveOrgLocalDigestWeek(org?.timezone, weekStartInput);
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message || 'Invalid weekStart date');
  }
  const { payload, recipient, eligibility, weekEnd, localWeekKey, timezone } = await buildPayloadForWeek(
    client,
    orgName,
    weekContext
  );

  if (!eligibility.ok) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      eligibility.reasons.join(' ') || 'Family weekly digest email is not eligible for this recipient'
    );
  }

  const existing = await FamilyWeeklyDigest.findOne({ client: client._id, localWeekKey });
  if (existing) {
    if (existing.status === 'sent') {
      throw new ApiError(
        httpStatus.CONFLICT,
        'A digest for this client and week was already sent and cannot be replaced'
      );
    }
    const digest = await updateDraftDigest(existing, { payload, recipient, weekEnd });
    logger.info(`[FamilyWeeklyDigest] Refreshed draft digest ${digest.id} for client ${client._id}`);
    return { digest, eligibility };
  }

  try {
    const doc = await FamilyWeeklyDigest.create({
      org: client.org,
      client: client._id,
      weekStart: weekContext.weekStart,
      weekEnd,
      localWeekKey,
      timezoneAtBuild: timezone,
      legacyUtcWeek: false,
      status: 'draft',
      recipient,
      payload,
      payloadHash: hashPayload(payload),
      createdBy: caregiver.id || caregiver._id,
    });
    logger.info(`[FamilyWeeklyDigest] Created draft digest ${doc.id} for client ${client._id}`);
    return { digest: doc, eligibility };
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(httpStatus.CONFLICT, 'A digest for this client and week already exists');
    }
    throw err;
  }
};

const queryDigests = async (caregiver, filter, options) => {
  const base = {};
  if (caregiver.role !== 'superAdmin') {
    base.org = caregiver.org;
  }
  if (filter.clientId) {
    const c = await Client.findById(filter.clientId);
    if (c) {
      await ensureCaregiverCanAccessClient(caregiver, c);
    } else if (caregiver.role !== 'orgAdmin' && caregiver.role !== 'superAdmin') {
      throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
    }
    base.client = filter.clientId;
  } else if (caregiver.role === 'staff') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Query parameter clientId is required for your role');
  }
  const result = await FamilyWeeklyDigest.paginate(base, {
    ...options,
    sortBy: options.sortBy || 'weekStart:desc',
    populate: 'client',
  });
  return result;
};

const getDigestById = async (caregiver, digestId) => {
  const digest = await FamilyWeeklyDigest.findById(digestId);
  if (!digest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Digest not found');
  }
  await ensureCaregiverCanAccessDigest(caregiver, digest);
  return digest;
};

/**
 * Send digest email to the family recipient on file. Updates status to sent.
 */
const deliverDigestEmail = async (digest) => {
  if (digest.status === 'sent') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Digest was already sent');
  }
  if (
    digest.sendInProgressAt &&
    Date.now() - new Date(digest.sendInProgressAt).getTime() < SEND_IN_PROGRESS_TIMEOUT_MS
  ) {
    throw new ApiError(httpStatus.CONFLICT, 'Digest email send is already in progress');
  }

  const client = await Client.findById(digest.client);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  const eligibleRecipients = getEligibleFamilyDigestRecipients(client);
  const eligibility = buildEligibility(client);
  if (!eligibility.ok || eligibleRecipients.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, eligibility.reasons.join(' ') || 'Cannot send digest');
  }

  const org = await Org.findById(digest.org);
  const orgName = org?.name || 'Your care community';
  const subject = `Weekly update from ${orgName}`;
  const payloadHashAtSend = hashPayload(digest.payload);

  digest.sendInProgressAt = new Date();
  await digest.save();

  const sentEmails = [];
  const messageIds = [];
  try {
    for (const recipient of eligibleRecipients) {
      const email = recipient.email;
      if (!email || !validator.isEmail(email)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Valid recipient email is required to send');
      }
      const personalizedPayload = personalizePayloadForRecipient(digest.payload, recipient);
      const html = payloadToEmailHtml(personalizedPayload, orgName);
      const text = payloadToPlainText(personalizedPayload, orgName);
      const sendResult = await emailService.sendEmail(email, subject, text, html);
      sentEmails.push(email);
      messageIds.push(extractEmailMessageId(sendResult));
    }
  } catch (err) {
    digest.sendInProgressAt = null;
    await digest.save();
    throw err;
  }

  try {
    await markDigestSent(digest, { emails: sentEmails, subject, messageIds, payloadHashAtSend });
  } catch (saveErr) {
    logger.error('[FamilyWeeklyDigest] CRITICAL: SES succeeded but Mongo save failed', {
      digestId: digest.id,
      clientId: String(digest.client),
      orgId: String(digest.org),
      emailRecipients: sentEmails,
      emailMessageId: messageIds.join(', '),
      error: saveErr.message,
    });
    throw saveErr;
  }

  logger.info(`[FamilyWeeklyDigest] Sent digest ${digest.id} to ${sentEmails.join(', ')}`);
  return digest;
};

const sendDigest = async (caregiver, digestId) => {
  const digest = await getDigestById(caregiver, digestId);
  return deliverDigestEmail(digest);
};

module.exports = {
  previewDigest,
  createDigest,
  queryDigests,
  getDigestById,
  sendDigest,
  deliverDigestEmail,
  updateDraftDigest,
  markDigestSent,
  hashPayload,
  startOfUtcWeekContaining,
  endOfUtcWeek,
  SEND_IN_PROGRESS_TIMEOUT_MS,
  familySafeSummary,
  pickSafeConversationText,
  payloadToEmailHtml,
  payloadToPlainText,
  buildEligibility,
  isUnsafeDigestText,
  isTranscriptLikeText,
  FAMILY_SAFE_NO_SUMMARY_FALLBACK,
  FAMILY_AI_DISCLAIMER,
  FAMILY_CONFIDENTIAL_FOOTER,
};
