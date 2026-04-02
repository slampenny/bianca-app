const httpStatus = require('http-status');
const { Client, Call, Conversation, Caregiver, FamilyWeeklyDigest, Org } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const emailService = require('./email.service');
const validator = require('validator');

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const truncate = (s, max) => {
  const t = String(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
};

/**
 * Monday 00:00:00.000 UTC for the calendar week containing `input` (or today).
 */
const startOfUtcWeekContaining = (input) => {
  const hasInput = input != null && String(input).trim() !== '';
  const d = hasInput ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid weekStart date');
  }
  const day = d.getUTCDay();
  const diffFromMonday = (day + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffFromMonday, 0, 0, 0, 0));
};

const endOfUtcWeek = (weekStartMonday) => {
  const end = new Date(weekStartMonday);
  end.setUTCDate(end.getUTCDate() + 7);
  end.setUTCMilliseconds(-1);
  return end;
};

const formatWeekRangeLabel = (start, end) => {
  const opts = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
};

const isCallAnswered = (call) =>
  call.callOutcome === 'answered' || (Number(call.duration) > 0 && call.status === 'completed');

const familySafeSummary = (call, conv, answered) => {
  if (!answered) {
    return "No answer — we'll try again.";
  }
  if (conv?.summary && String(conv.summary).trim()) {
    return truncate(String(conv.summary).trim(), 220);
  }
  if (conv?.history && String(conv.history).trim()) {
    return truncate(String(conv.history).trim(), 220);
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
  const clientOrg = client.org._id ? client.org._id.toString() : client.org.toString();
  if (caregiver.org.toString() !== clientOrg) {
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

const getRecipientFromClient = (client) => {
  const ec = client.emergencyContact;
  if (!ec || typeof ec !== 'object') {
    return { name: '', relationship: '', email: '' };
  }
  const email = ec.email ? String(ec.email).trim().toLowerCase() : '';
  return {
    name: ec.name ? String(ec.name).trim() : '',
    relationship: ec.relationship ? String(ec.relationship).trim() : '',
    email,
  };
};

const buildEligibility = (client, recipient) => {
  const reasons = [];
  const warnings = [];
  if (client.consented === false) {
    reasons.push('Client consent is required before family communications.');
  }
  if (!recipient.email || !validator.isEmail(recipient.email)) {
    reasons.push('Add a valid emergencyContact.email on the client to send this digest.');
  }
  if (!recipient.name && !recipient.relationship) {
    warnings.push('Add emergency contact name or relationship for a clearer greeting.');
  }
  return {
    ok: reasons.length === 0,
    reasons,
    warnings,
  };
};

/**
 * Build digest payload from calls/conversations (no persist).
 */
const buildPayloadForWeek = async (client, orgName, weekStart) => {
  const weekEnd = endOfUtcWeek(weekStart);
  const calls = await Call.find({
    clientId: client._id,
    startTime: { $gte: weekStart, $lte: weekEnd },
  })
    .sort({ startTime: 1 })
    .lean();

  const callIds = calls.map((c) => c._id);
  const convs = await Conversation.find({ callId: { $in: callIds } })
    .select('callId summary history')
    .lean();
  const convByCallId = new Map(convs.map((c) => [c.callId.toString(), c]));

  const displayFirst =
    (client.preferredName && String(client.preferredName).trim().split(/\s+/)[0]) ||
    (client.name && String(client.name).trim().split(/\s+/)[0]) ||
    'your loved one';

  const callRows = calls.map((call) => {
    const answered = isCallAnswered(call);
    const conv = convByCallId.get(call._id.toString());
    const t = call.startTime ? new Date(call.startTime) : new Date(0);
    const dayLabel = DAY_LABELS[t.getUTCDay()];
    const dateLabel = t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    return {
      dayLabel,
      dateLabel,
      connected: answered,
      summary: familySafeSummary(call, conv, answered),
    };
  });

  const answeredCount = calls.filter((c) => isCallAnswered(c)).length;
  const answeredDurations = calls.filter((c) => isCallAnswered(c)).map((c) => Number(c.duration || c.callDuration || 0));
  const typicalSeconds =
    answeredDurations.length === 0
      ? null
      : Math.round(answeredDurations.reduce((a, b) => a + b, 0) / answeredDurations.length);

  const atAGlance = {
    weekRangeLabel: formatWeekRangeLabel(weekStart, weekEnd),
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
  const eligibility = buildEligibility(client, recipient);

  const narrative = [
    'This digest describes wellness check-in calls only — not clinical care.',
    'If you received this message by mistake, contact the facility and do not forward.',
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
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    narrative,
    atAGlance,
    callRows,
    exclusions,
    eligibility,
  };

  return { payload, recipient, eligibility, weekEnd };
};

const payloadToEmailHtml = (payload, orgName) => {
  const sub = `${payload.subtitleParts.recipientLine} · ${payload.subtitleParts.residentLine}`;
  const rows = payload.callRows
    .map(
      (r) =>
        `<tr><td>${r.dayLabel} ${r.dateLabel}</td><td>${r.connected ? 'Yes' : 'No'}</td><td>${String(r.summary)
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</td></tr>`
    )
    .join('');
  const exc = payload.exclusions
    .map(
      (e) =>
        `<tr><td>${String(e.topic).replace(/</g, '&lt;')}</td><td>${String(e.instead).replace(/</g, '&lt;')}</td></tr>`
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5;color:#0f172a">
<p style="font-weight:700">bianca<span style="color:#14b8a6">.</span></p>
<h1 style="font-size:1.25rem">${payload.title}</h1>
<p style="color:#64748b;font-size:0.9rem">${sub} · ${orgName} · ${payload.atAGlance.weekRangeLabel}</p>
<ul>${payload.narrative.map((n) => `<li>${n.replace(/</g, '&lt;')}</li>`).join('')}</ul>
<h2 style="font-size:1rem">Week at a glance</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:0.85rem"><tr><th>Metric</th><th>Detail</th></tr>
<tr><td>Calls placed</td><td>${payload.atAGlance.callsPlaced}</td></tr>
<tr><td>Answered</td><td>${payload.atAGlance.answeredCount}</td></tr>
<tr><td>Typical length (when connected)</td><td>${
    payload.atAGlance.typicalMinutesWhenConnected == null
      ? '—'
      : `~${payload.atAGlance.typicalMinutesWhenConnected} min`
  }</td></tr>
</table>
<h2 style="font-size:1rem">This week</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:0.85rem"><tr><th>Day</th><th>Connected</th><th>Summary</th></tr>${rows}</table>
<h2 style="font-size:1rem">What’s not in this message</h2>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:0.85rem"><tr><th>Topic</th><th>Instead</th></tr>${exc}</table>
</body></html>`;
};

const previewDigest = async (caregiver, clientId, weekStartInput) => {
  const client = await Client.findById(clientId);
  await ensureCaregiverCanAccessClient(caregiver, client);
  const org = await Org.findById(client.org);
  const orgName = org?.name || 'Your care community';
  const weekStart = startOfUtcWeekContaining(weekStartInput);
  const { payload, recipient, eligibility } = await buildPayloadForWeek(client, orgName, weekStart);
  return { payload, recipient, eligibility, weekStart: weekStart.toISOString() };
};

const createDigest = async (caregiver, clientId, weekStartInput) => {
  const client = await Client.findById(clientId);
  await ensureCaregiverCanAccessClient(caregiver, client);
  const org = await Org.findById(client.org);
  const orgName = org?.name || 'Your care community';
  const weekStart = startOfUtcWeekContaining(weekStartInput);
  const { payload, recipient, eligibility, weekEnd } = await buildPayloadForWeek(client, orgName, weekStart);

  try {
    const doc = await FamilyWeeklyDigest.create({
      org: client.org,
      client: client._id,
      weekStart,
      weekEnd,
      status: 'draft',
      recipient,
      payload,
      createdBy: caregiver.id || caregiver._id,
    });
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
    await ensureCaregiverCanAccessClient(caregiver, c);
    base.client = filter.clientId;
  } else if (caregiver.role === 'staff') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Query parameter clientId is required for your role');
  }
  const result = await FamilyWeeklyDigest.paginate(base, {
    ...options,
    sortBy: 'weekStart:desc',
    populate: [{ path: 'client', select: 'name preferredName' }],
  });
  return result;
};

const getDigestById = async (caregiver, digestId) => {
  const digest = await FamilyWeeklyDigest.findById(digestId);
  if (!digest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Digest not found');
  }
  if (caregiver.role !== 'superAdmin' && digest.org.toString() !== caregiver.org.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this digest');
  }
  const client = await Client.findById(digest.client);
  await ensureCaregiverCanAccessClient(caregiver, client);
  return digest;
};

const sendDigest = async (caregiver, digestId) => {
  const digest = await getDigestById(caregiver, digestId);
  if (digest.status === 'sent') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Digest was already sent');
  }
  const eligibility = digest.payload?.eligibility || buildEligibility(await Client.findById(digest.client), digest.recipient);
  if (!eligibility.ok) {
    throw new ApiError(httpStatus.BAD_REQUEST, eligibility.reasons.join(' ') || 'Cannot send digest');
  }
  const email = digest.recipient?.email;
  if (!email || !validator.isEmail(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Valid recipient email is required to send');
  }
  const org = await Org.findById(digest.org);
  const orgName = org?.name || 'Your care community';
  const html = payloadToEmailHtml(digest.payload, orgName);
  const text = `Weekly call digest from ${orgName}. Open the HTML version for the full summary.`;
  const subject = `Weekly update from ${orgName}`;
  await emailService.sendEmail(email, subject, text, html);
  digest.status = 'sent';
  digest.sentAt = new Date();
  await digest.save();
  logger.info(`[FamilyWeeklyDigest] Sent digest ${digest.id} to ${email}`);
  return digest;
};

module.exports = {
  previewDigest,
  createDigest,
  queryDigests,
  getDigestById,
  sendDigest,
  startOfUtcWeekContaining,
  endOfUtcWeek,
};
