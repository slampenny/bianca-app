const path = require('path');
const httpStatus = require('http-status');
const i18n = require('i18n');
const validator = require('validator');
const { Client, Call, Conversation, Caregiver, CaregiverDailyDigest, Org } = require('../models');
const { toOrgIdString } = require('../dtos/caregiver.dto');
const { toIdString } = require('../utils/accessControl');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const emailService = require('./email.service');

i18n.configure({
  locales: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ko', 'ar', 'hu'],
  directory: path.join(__dirname, '../locales'),
  defaultLocale: 'en',
  updateFiles: false,
  objectNotation: true,
  logWarnFn() {},
});

const truncate = (s, max) => {
  const t = String(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
};

/**
 * UTC midnight for the calendar day containing `input` (or today).
 */
const startOfUtcDayContaining = (input) => {
  const hasInput = input != null && String(input).trim() !== '';
  const d = hasInput ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid digestDate');
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};

const endOfUtcDay = (dayStart) => {
  const end = new Date(dayStart);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCMilliseconds(-1);
  return end;
};

const isCallAnswered = (call) =>
  call.callOutcome === 'answered' || (Number(call.duration) > 0 && call.status === 'completed');

const tx = (locale, phrase, ...args) => {
  const loc = locale || 'en';
  if (args.length) {
    return i18n.__({ phrase, locale: loc }, ...args);
  }
  return i18n.__({ phrase, locale: loc });
};

const conversationBriefLocalized = (locale, call, conv, answered) => {
  if (!answered) {
    return null;
  }
  if (conv?.summary && String(conv.summary).trim()) {
    return truncate(String(conv.summary).trim(), 160);
  }
  if (conv?.history && String(conv.history).trim()) {
    return truncate(String(conv.history).trim(), 160);
  }
  const sec = Number(call.duration || call.callDuration || 0);
  if (sec > 0) {
    const min = Math.max(1, Math.round(sec / 60));
    return tx(locale, 'caregiverDailyDigest.completedMinutes', min);
  }
  return tx(locale, 'caregiverDailyDigest.completedNoTranscript');
};

const pickSentimentSubset = (sentiment) => {
  if (!sentiment || typeof sentiment !== 'object') return null;
  const keys = [
    'overallSentiment',
    'sentimentScore',
    'confidence',
    'patientMood',
    'keyEmotions',
    'concernLevel',
    'summary',
    'recommendations',
  ];
  const out = {};
  keys.forEach((k) => {
    if (sentiment[k] !== undefined) out[k] = sentiment[k];
  });
  return Object.keys(out).length ? out : null;
};

const normalizeLang = (code) => String(code || 'en').toLowerCase();

const languageDisplayName = (viewerLocale, code) => {
  const loc = viewerLocale === 'en' ? 'en' : viewerLocale;
  try {
    const dn = new Intl.DisplayNames([loc], { type: 'language' });
    const name = dn.of(code);
    return name || code;
  } catch {
    return code;
  }
};

const ensureCaregiverCanAccessTarget = async (requester, targetCaregiverId) => {
  const targetId = String(targetCaregiverId);
  if (requester.role === 'superAdmin') {
    return Caregiver.findById(targetId).populate('clients');
  }
  if (String(requester.id || requester._id) === targetId) {
    return Caregiver.findById(targetId).populate('clients');
  }
  if (requester.role === 'orgAdmin') {
    const target = await Caregiver.findById(targetId).populate('clients');
    if (!target) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
    }
    if (toOrgIdString(target.org) !== toOrgIdString(requester.org)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this caregiver');
    }
    return target;
  }
  throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this digest');
};

const ensureStaffCanAccessClient = async (requester, client) => {
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  if (requester.role === 'superAdmin') return;
  const clientOrg = toOrgIdString(client.org);
  const requesterOrg = toOrgIdString(requester.org);
  if (!requesterOrg || !clientOrg || requesterOrg !== clientOrg) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this client');
  }
  if (requester.role === 'orgAdmin') return;
  const cg = await Caregiver.findById(requester.id || requester._id).select('clients');
  const idStr = client._id.toString();
  const onRoster = (cg?.clients || []).some((p) => (p._id ? p._id.toString() : p.toString()) === idStr);
  const assignedOnClient =
    Array.isArray(client.caregivers) &&
    client.caregivers.some((c) => (c._id ? c._id.toString() : c.toString()) === String(requester.id || requester._id));
  if (onRoster || assignedOnClient) return;
  const callCount = await Call.countDocuments({ clientId: client._id, caregiverId: requester.id || requester._id });
  if (callCount === 0) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this client');
  }
};

/**
 * Residents in the digest must stay inside the caregiver's org.
 * - orgAdmin / superAdmin: all clients in the org (facility-wide digest for email + UI).
 * - staff, invited, and other roles: only clients on this caregiver's roster or with this caregiver on client.caregivers
 *   (each caregiver's email digest is limited to their patients).
 */
const findClientsForDailyDigest = async (caregiverDoc) => {
  const orgId = toOrgIdString(caregiverDoc.org);
  if (!orgId) {
    return [];
  }
  const selectFields = 'name preferredName preferredLanguage org caregivers';

  if (caregiverDoc.role === 'orgAdmin' || caregiverDoc.role === 'superAdmin') {
    return Client.find({ org: orgId }).select(selectFields).sort({ name: 1 }).lean();
  }

  const rosterIds = (caregiverDoc.clients || []).map((c) => toIdString(c._id || c)).filter(Boolean);
  const caregiverIdStr = toIdString(caregiverDoc._id);
  const filter = {
    org: orgId,
    $or: [{ caregivers: caregiverIdStr }, { _id: { $in: rosterIds } }],
  };
  return Client.find(filter).select(selectFields).sort({ name: 1 }).lean();
};

/**
 * Build localized digest payload for one caregiver and UTC calendar day.
 */
const buildPayloadForCaregiverDay = async (caregiverDoc, digestDateStart) => {
  const locale = normalizeLang(caregiverDoc.preferredLanguage) || 'en';
  const dayStart = digestDateStart;
  const dayEnd = endOfUtcDay(dayStart);
  const org = await Org.findById(caregiverDoc.org);
  const orgName = org?.name || '';

  const clients = await findClientsForDailyDigest(caregiverDoc);

  const dateLabel = dayStart.toLocaleDateString(locale === 'en' ? 'en-US' : locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  const entries = [];

  for (const cl of clients) {
    const displayName =
      (cl.preferredName && String(cl.preferredName).trim()) || (cl.name && String(cl.name).trim()) || 'Resident';
    const clientLang = normalizeLang(cl.preferredLanguage);
    const languageMismatch = clientLang !== locale;

    const calls = await Call.find({
      clientId: cl._id,
      status: 'completed',
      startTime: { $gte: dayStart, $lte: dayEnd },
    })
      .sort({ startTime: -1 })
      .lean();

    const callIds = calls.map((c) => c._id);
    const convs = await Conversation.find({ callId: { $in: callIds } })
      .select('callId summary history analyzedData')
      .lean();
    const convByCallId = new Map(convs.map((c) => [c.callId.toString(), c]));

    const answeredCalls = calls.filter((c) => isCallAnswered(c));
    const primaryCall = answeredCalls[0] || null;
    const primaryConv = primaryCall ? convByCallId.get(primaryCall._id.toString()) : null;

    let conversationSummaryShort = null;
    let sentiment = null;

    if (primaryCall && primaryConv) {
      sentiment = pickSentimentSubset(primaryConv.analyzedData?.sentiment);
    } else if (calls.length > 0) {
      const last = calls[0];
      const conv = convByCallId.get(last._id.toString());
      if (conv) {
        sentiment = pickSentimentSubset(conv.analyzedData?.sentiment);
      }
    }

    if (!languageMismatch) {
      if (primaryCall) {
        conversationSummaryShort = conversationBriefLocalized(
          locale,
          primaryCall,
          primaryConv,
          isCallAnswered(primaryCall)
        );
      } else if (calls.length > 0) {
        conversationSummaryShort = tx(locale, 'caregiverDailyDigest.noAnswerToday');
      }
    }

    const clientLangName = languageDisplayName(locale, clientLang);
    const caregiverLangName = languageDisplayName(locale, locale);

    const hasSentiment = sentiment && typeof sentiment === 'object' && Object.keys(sentiment).length > 0;
    let languageMismatchExplanation = null;
    if (languageMismatch && calls.length > 0) {
      languageMismatchExplanation = hasSentiment
        ? tx(locale, 'caregiverDailyDigest.languageMismatchExplanation', clientLangName, caregiverLangName)
        : tx(locale, 'caregiverDailyDigest.languageMismatchExplanationNoSentiment', clientLangName, caregiverLangName);
    }

    entries.push({
      clientId: cl._id.toString(),
      clientName: displayName,
      clientPreferredLanguage: clientLang,
      caregiverPreferredLanguage: locale,
      languageMismatch,
      languageMismatchExplanation,
      conversationSummaryShort,
      sentiment,
      callsPlaced: calls.length,
      answeredCalls: answeredCalls.length,
      lastCallAt: calls[0]?.startTime ? new Date(calls[0].startTime).toISOString() : null,
    });
  }

  const payload = {
    version: 1,
    title: tx(locale, 'caregiverDailyDigest.title'),
    subtitle: orgName ? tx(locale, 'caregiverDailyDigest.subtitleWithOrg', orgName) : tx(locale, 'caregiverDailyDigest.subtitle'),
    dateLabel,
    digestDateUtc: dayStart.toISOString(),
    labels: {
      conversationSummary: tx(locale, 'caregiverDailyDigest.labelConversationSummary'),
      sentiment: tx(locale, 'caregiverDailyDigest.labelSentiment'),
      callsToday: tx(locale, 'caregiverDailyDigest.labelCallsToday'),
      noActivity: tx(locale, 'caregiverDailyDigest.noActivity'),
      emailScreenHint: tx(locale, 'caregiverDailyDigest.emailScreenHint'),
    },
    entries,
    generatedAt: new Date().toISOString(),
  };

  return { payload, locale };
};

const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatSentimentPlain = (sentiment) => {
  if (!sentiment || typeof sentiment !== 'object') return '';
  const parts = [];
  if (typeof sentiment.overallSentiment === 'string') parts.push(sentiment.overallSentiment);
  if (typeof sentiment.summary === 'string' && sentiment.summary) parts.push(sentiment.summary);
  else if (typeof sentiment.patientMood === 'string' && sentiment.patientMood) parts.push(sentiment.patientMood);
  if (Array.isArray(sentiment.keyEmotions) && sentiment.keyEmotions.length) {
    parts.push(sentiment.keyEmotions.join(', '));
  }
  return parts.join(' — ');
};

const payloadToEmailHtml = (payload) => {
  const { labels } = payload;
  const rows = (payload.entries || [])
    .map((e) => {
      const mismatch = e.languageMismatch && e.languageMismatchExplanation ? `<p style="margin:0 0 8px;font-size:0.85rem;color:#b45309">${escapeHtml(e.languageMismatchExplanation)}</p>` : '';
      const summary = e.conversationSummaryShort
        ? `<p style="margin:0 0 4px"><strong>${escapeHtml(labels.conversationSummary)}</strong></p><p style="margin:0 0 8px">${escapeHtml(e.conversationSummaryShort)}</p>`
        : e.callsPlaced === 0
          ? `<p style="margin:0 0 8px;color:#64748b">${escapeHtml(labels.noActivity)}</p>`
          : '';
      const sent = formatSentimentPlain(e.sentiment);
      const sentBlock = sent
        ? `<p style="margin:0 0 4px"><strong>${escapeHtml(labels.sentiment)}</strong></p><p style="margin:0">${escapeHtml(sent)}</p>`
        : '';
      return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px">
<h3 style="margin:0 0 8px;font-size:1rem">${escapeHtml(e.clientName)}</h3>
<p style="margin:0 0 8px;font-size:0.8rem;color:#64748b">${escapeHtml(labels.callsToday)}: ${e.callsPlaced} · ${e.answeredCalls} answered</p>
${mismatch}${summary}${sentBlock}
</div>`;
    })
    .join('');
  const footer = escapeHtml(
    i18n.__({ phrase: 'caregiverDailyDigest.emailConfidentialFooter', locale: payload.localeHint || 'en' })
  );
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5;color:#0f172a">
<p style="font-weight:700">bianca<span style="color:#14b8a6">.</span></p>
<h1 style="font-size:1.25rem">${escapeHtml(payload.title)}</h1>
<p style="color:#64748b;font-size:0.9rem">${escapeHtml(payload.subtitle)} · ${escapeHtml(payload.dateLabel)}</p>
${rows}
<p style="margin-top:24px;font-size:0.75rem;color:#94a3b8">${footer}</p>
</body></html>`;
};

const payloadToPlainText = (payload) => {
  const lines = [
    payload.title,
    `${payload.subtitle} · ${payload.dateLabel}`,
    '',
    i18n.__({ phrase: 'caregiverDailyDigest.emailPlainIntro', locale: payload.localeHint || 'en' }),
    '',
  ];
  (payload.entries || []).forEach((e) => {
    lines.push(`— ${e.clientName} —`);
    lines.push(`${payload.labels.callsToday}: ${e.callsPlaced}, answered: ${e.answeredCalls}`);
    if (e.languageMismatchExplanation) lines.push(e.languageMismatchExplanation);
    if (e.conversationSummaryShort) lines.push(`${payload.labels.conversationSummary}: ${e.conversationSummaryShort}`);
    const s = formatSentimentPlain(e.sentiment);
    if (s) lines.push(`${payload.labels.sentiment}: ${s}`);
    lines.push('');
  });
  lines.push(i18n.__({ phrase: 'caregiverDailyDigest.emailConfidentialFooter', locale: payload.localeHint || 'en' }));
  return lines.join('\n');
};

/**
 * Send digest email to the caregiver on file. Updates status to sent.
 */
const deliverDigestEmail = async (digest) => {
  if (digest.status === 'sent') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Digest was already sent');
  }
  const caregiver = await Caregiver.findById(digest.caregiver).select('email name preferredLanguage');
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }
  const email = caregiver.email;
  if (!email || !validator.isEmail(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'A verified email is required on your profile to send this digest');
  }
  const loc = normalizeLang(digest.locale || caregiver.preferredLanguage);
  const payload = { ...digest.payload, localeHint: loc };
  const html = payloadToEmailHtml(payload);
  const text = payloadToPlainText(payload);
  const subject = tx(loc, 'caregiverDailyDigest.emailSubject', payload.dateLabel || '');
  await emailService.sendEmail(email, subject, text, html);
  digest.status = 'sent';
  digest.sentAt = new Date();
  await digest.save();
  logger.info(`[CaregiverDailyDigest] Sent digest ${digest.id} to ${email}`);
  return digest;
};

const createOrUpdateDigest = async (requester, digestDateInput, options = {}) => {
  const sendEmail = Boolean(options.sendEmail);
  const targetId = requester.id || requester._id;
  const caregiverDoc = await ensureCaregiverCanAccessTarget(requester, targetId);
  if (!caregiverDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  if (requester.role === 'staff' || requester.role === 'invited') {
    for (const c of caregiverDoc.clients || []) {
      const cl = await Client.findById(c._id || c);
      await ensureStaffCanAccessClient(requester, cl);
    }
  }

  const digestDate = startOfUtcDayContaining(digestDateInput);
  const { payload, locale } = await buildPayloadForCaregiverDay(caregiverDoc, digestDate);

  const filter = { caregiver: caregiverDoc._id, digestDate };
  const existing = await CaregiverDailyDigest.findOne(filter);
  if (existing) {
    existing.payload = payload;
    existing.locale = locale;
    existing.status = 'draft';
    await existing.save();
    logger.info(`[CaregiverDailyDigest] Refreshed digest ${existing.id} for caregiver ${caregiverDoc._id}`);
    let out = existing;
    if (sendEmail) {
      const reloaded = await CaregiverDailyDigest.findById(existing._id);
      out = await deliverDigestEmail(reloaded);
    }
    return out;
  }

  const doc = await CaregiverDailyDigest.create({
    org: caregiverDoc.org,
    caregiver: caregiverDoc._id,
    digestDate,
    locale,
    status: 'draft',
    payload,
  });
  logger.info(`[CaregiverDailyDigest] Created digest ${doc.id} for caregiver ${caregiverDoc._id}`);
  if (sendEmail) {
    const reloaded = await CaregiverDailyDigest.findById(doc._id);
    return deliverDigestEmail(reloaded);
  }
  return doc;
};

const queryDigests = async (requester, filter, options) => {
  const { caregiverId, digestDate } = filter;
  let targetCaregiverId = requester.id || requester._id;
  if (caregiverId && (requester.role === 'orgAdmin' || requester.role === 'superAdmin')) {
    targetCaregiverId = caregiverId;
  } else if (caregiverId && String(caregiverId) !== String(requester.id || requester._id)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot list digests for another caregiver');
  }

  await ensureCaregiverCanAccessTarget(requester, targetCaregiverId);

  const base = { caregiver: targetCaregiverId };
  if (digestDate) {
    base.digestDate = startOfUtcDayContaining(digestDate);
  }

  const result = await CaregiverDailyDigest.paginate(base, {
    ...options,
    sortBy: options.sortBy || 'digestDate:desc',
  });
  return result;
};

const getDigestById = async (requester, digestId) => {
  const digest = await CaregiverDailyDigest.findById(digestId);
  if (!digest) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Digest not found');
  }
  if (requester.role === 'superAdmin') {
    return digest;
  }
  if (toOrgIdString(digest.org) !== toOrgIdString(requester.org)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this digest');
  }
  if (String(digest.caregiver) === String(requester.id || requester._id)) {
    return digest;
  }
  if (requester.role === 'orgAdmin') {
    return digest;
  }
  throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this digest');
};

const sendDigest = async (requester, digestId) => {
  const digest = await getDigestById(requester, digestId);
  return deliverDigestEmail(digest);
};

module.exports = {
  startOfUtcDayContaining,
  endOfUtcDay,
  buildPayloadForCaregiverDay,
  createOrUpdateDigest,
  queryDigests,
  getDigestById,
  sendDigest,
};
