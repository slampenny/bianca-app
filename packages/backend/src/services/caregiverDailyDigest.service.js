const path = require('path');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const i18n = require('i18n');
const { Client, Call, Conversation, Caregiver, CaregiverDailyDigest, Org } = require('../models');
const { toOrgIdString } = require('../dtos/caregiver.dto');
const { toIdString } = require('../utils/accessControl');
const { stableStringify, canonicalizePayload, hashPayload } = require('../utils/digestPayloadHash');
const {
  resolveOrgTimezone,
  resolveOrgLocalDigestDay,
  endExclusiveOfOrgLocalDay,
} = require('../utils/digestDay.utils');
const { canReceiveDigestEmail } = require('../utils/digestEmailEligibility');
const { isUnsafeDigestText } = require('../utils/digestContentSafety');
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

const SEND_IN_PROGRESS_TIMEOUT_MS = 10 * 60 * 1000;

const TX_FALLBACKS = {
  'caregiverDailyDigest.safeNoSummaryFallback': 'Check-in completed; no written summary is available yet.',
  'caregiverDailyDigest.emailAiDisclaimer':
    'This digest is automatically generated from wellness check-in calls. It is not clinical advice and should be reviewed alongside the original call record when decisions are needed.',
  'caregiverDailyDigest.emailConfidentialFooter':
    'Confidential — for the intended caregiver only. Do not forward.',
};

const truncate = (s, max) => {
  const t = String(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
};

const sanitizeDigestText = (locale, value) => {
  if (!value || typeof value !== 'string') {
    return value;
  }
  if (isUnsafeDigestText(value)) {
    return tx(locale, 'caregiverDailyDigest.safeNoSummaryFallback');
  }
  return value;
};

const resolveDigestDayForOrg = (orgTimezone, input) => {
  try {
    return resolveOrgLocalDigestDay(orgTimezone, input);
  } catch (err) {
    throw new ApiError(httpStatus.BAD_REQUEST, err.message || 'Invalid digestDate');
  }
};

const isCallAnswered = (call) =>
  call.callOutcome === 'answered' || (Number(call.duration) > 0 && call.status === 'completed');

const tx = (locale, phrase, ...args) => {
  const localesToTry = [locale || 'en', 'en'];
  for (const loc of localesToTry) {
    let result;
    if (args.length) {
      result = i18n.__({ phrase, locale: loc }, ...args);
    } else {
      result = i18n.__({ phrase, locale: loc });
    }
    if (typeof result === 'string' && !result.startsWith('caregiverDailyDigest.')) {
      return result;
    }
  }
  const fallback = TX_FALLBACKS[phrase];
  if (fallback) {
    return fallback;
  }
  return phrase;
};

const conversationBriefLocalized = (locale, call, conv, answered) => {
  if (!answered) {
    return null;
  }
  if (conv?.summary && String(conv.summary).trim()) {
    const safe = sanitizeDigestText(locale, String(conv.summary).trim());
    return truncate(safe, 160);
  }
  if (conv?.history && String(conv.history).trim()) {
    const safe = sanitizeDigestText(locale, String(conv.history).trim());
    return truncate(safe, 160);
  }
  const sec = Number(call.duration || call.callDuration || 0);
  if (sec > 0) {
    const min = Math.max(1, Math.round(sec / 60));
    return tx(locale, 'caregiverDailyDigest.completedMinutes', min);
  }
  return tx(locale, 'caregiverDailyDigest.completedNoTranscript');
};

const pickSentimentSubset = (sentiment, locale) => {
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
    if (sentiment[k] === undefined) return;
    if (typeof sentiment[k] === 'string') {
      const safe = sanitizeDigestText(locale, sentiment[k]);
      if (safe) out[k] = safe;
    } else {
      out[k] = sentiment[k];
    }
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

const findLatestDigestForDay = async (caregiverId, digestDate) =>
  CaregiverDailyDigest.findOne({ caregiver: caregiverId, digestDate }).sort({ version: -1 });

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
const updateDraftDigest = async (digestDoc, { payload, locale }) => {
  assertDigestIsDraft(digestDoc);
  digestDoc.payload = payload;
  digestDoc.locale = locale;
  digestDoc.builtAt = new Date();
  digestDoc.payloadHash = hashPayload(payload);
  clearDraftEmailMetadata(digestDoc);
  await digestDoc.save();
  return digestDoc;
};

/** Create a new draft digest version. Sent records are never modified. */
const createDigestVersion = async ({
  caregiverDoc,
  digestDate,
  localDateKey,
  timezoneAtBuild,
  payload,
  locale,
  version,
  previousDigest,
  supersedesDigest,
}) => {
  const now = new Date();
  const payloadHash = hashPayload(payload);
  return CaregiverDailyDigest.create({
    org: caregiverDoc.org,
    caregiver: caregiverDoc._id,
    digestDate,
    localDateKey,
    timezoneAtBuild,
    legacyUtcDay: false,
    version,
    builtAt: now,
    locale,
    status: 'draft',
    payload,
    payloadHash,
    previousDigest: previousDigest || null,
    supersedesDigest: supersedesDigest || null,
  });
};

/** Mark a draft digest as sent after successful email delivery. */
const markDigestSent = async (digestDoc, { email, subject, messageId, payloadHashAtSend }) => {
  assertDigestIsDraft(digestDoc);
  digestDoc.status = 'sent';
  digestDoc.sentAt = new Date();
  digestDoc.sentPayloadHash = payloadHashAtSend;
  digestDoc.payloadHash = payloadHashAtSend;
  digestDoc.emailRecipient = email;
  digestDoc.emailSubject = subject;
  digestDoc.emailMessageId = messageId;
  digestDoc.sendInProgressAt = null;
  await digestDoc.save();
  return digestDoc;
};

/**
 * Build localized digest payload for one caregiver and org-local calendar day.
 */
const buildPayloadForCaregiverDay = async (caregiverDoc, { digestDateStart, orgTimezone, localDateKey }) => {
  const locale = normalizeLang(caregiverDoc.preferredLanguage) || 'en';
  const timezone = resolveOrgTimezone(orgTimezone);
  const dayStart = digestDateStart;
  const dayEndExclusive = endExclusiveOfOrgLocalDay(timezone, localDateKey);
  const org = await Org.findById(caregiverDoc.org);
  const orgName = org?.name || '';

  const clients = await findClientsForDailyDigest(caregiverDoc);

  const dateLabel = dayStart.toLocaleDateString(locale === 'en' ? 'en-US' : locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
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
      startTime: { $gte: dayStart, $lt: dayEndExclusive },
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
      sentiment = pickSentimentSubset(primaryConv.analyzedData?.sentiment, locale);
    } else if (calls.length > 0) {
      const last = calls[0];
      const conv = convByCallId.get(last._id.toString());
      if (conv) {
        sentiment = pickSentimentSubset(conv.analyzedData?.sentiment, locale);
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

    const { pickAnswersForDigest } = require('./requiredCallQuestions.service');
    const requiredQuestionAnswers =
      primaryConv && !languageMismatch ? pickAnswersForDigest(primaryConv.analyzedData) : [];

    entries.push({
      clientId: cl._id.toString(),
      clientName: displayName,
      clientPreferredLanguage: clientLang,
      caregiverPreferredLanguage: locale,
      languageMismatch,
      languageMismatchExplanation,
      conversationSummaryShort,
      requiredQuestionAnswers,
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
    digestDayStartIso: dayStart.toISOString(),
    localDateKey,
    timezone,
    labels: {
      conversationSummary: tx(locale, 'caregiverDailyDigest.labelConversationSummary'),
      requiredQuestions: tx(locale, 'caregiverDailyDigest.labelRequiredQuestions'),
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
  const loc = payload.localeHint || 'en';
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
      const reqRows = Array.isArray(e.requiredQuestionAnswers) ? e.requiredQuestionAnswers : [];
      const reqBlock =
        reqRows.length > 0
          ? `<p style="margin:8px 0 4px"><strong>${escapeHtml(labels.requiredQuestions)}</strong></p><ul style="margin:0;padding-left:1.2rem">${reqRows
              .map((r) => `<li>${escapeHtml(r.question)}: ${escapeHtml(r.answer || '(not answered)')}</li>`)
              .join('')}</ul>`
          : '';
      return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px">
<h3 style="margin:0 0 8px;font-size:1rem">${escapeHtml(e.clientName)}</h3>
<p style="margin:0 0 8px;font-size:0.8rem;color:#64748b">${escapeHtml(labels.callsToday)}: ${e.callsPlaced} · ${e.answeredCalls} answered</p>
${mismatch}${summary}${reqBlock}${sentBlock}
</div>`;
    })
    .join('');
  const confidentialFooter = escapeHtml(tx(loc, 'caregiverDailyDigest.emailConfidentialFooter'));
  const aiDisclaimer = escapeHtml(tx(loc, 'caregiverDailyDigest.emailAiDisclaimer'));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;max-width:640px;line-height:1.5;color:#0f172a">
<p style="font-weight:700">bianca<span style="color:#14b8a6">.</span></p>
<h1 style="font-size:1.25rem">${escapeHtml(payload.title)}</h1>
<p style="color:#64748b;font-size:0.9rem">${escapeHtml(payload.subtitle)} · ${escapeHtml(payload.dateLabel)}</p>
${rows}
<p style="margin-top:24px;font-size:0.75rem;color:#94a3b8">${aiDisclaimer}</p>
<p style="margin-top:8px;font-size:0.75rem;color:#94a3b8">${confidentialFooter}</p>
</body></html>`;
};

const payloadToPlainText = (payload) => {
  const loc = payload.localeHint || 'en';
  const lines = [
    payload.title,
    `${payload.subtitle} · ${payload.dateLabel}`,
    '',
    tx(loc, 'caregiverDailyDigest.emailPlainIntro'),
    '',
  ];
  (payload.entries || []).forEach((e) => {
    lines.push(`— ${e.clientName} —`);
    lines.push(`${payload.labels.callsToday}: ${e.callsPlaced}, answered: ${e.answeredCalls}`);
    if (e.languageMismatchExplanation) lines.push(e.languageMismatchExplanation);
    if (e.conversationSummaryShort) lines.push(`${payload.labels.conversationSummary}: ${e.conversationSummaryShort}`);
    if (Array.isArray(e.requiredQuestionAnswers) && e.requiredQuestionAnswers.length > 0) {
      e.requiredQuestionAnswers.forEach((r) => {
        lines.push(`${payload.labels.requiredQuestions}: ${r.question} — ${r.answer || '(not answered)'}`);
      });
    }
    const s = formatSentimentPlain(e.sentiment);
    if (s) lines.push(`${payload.labels.sentiment}: ${s}`);
    lines.push('');
  });
  lines.push(tx(loc, 'caregiverDailyDigest.emailAiDisclaimer'));
  lines.push(tx(loc, 'caregiverDailyDigest.emailConfidentialFooter'));
  return lines.join('\n');
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

const enrichDigestListRows = async (rows) => {
  if (!rows?.length) {
    return rows;
  }
  const priorIds = rows.map((r) => r.supersedesDigest).filter(Boolean);
  const priors =
    priorIds.length > 0
      ? await CaregiverDailyDigest.find({ _id: { $in: priorIds } })
          .select('_id version status')
          .lean()
      : [];
  const priorById = new Map(priors.map((p) => [String(p._id), p]));

  return rows.map((row) => {
    const plain = typeof row.toObject === 'function' ? row.toObject() : { ...row };
    if (plain._id != null && plain.id == null) {
      plain.id = String(plain._id);
    }
    if (plain.caregiver != null && typeof plain.caregiver !== 'string') {
      plain.caregiver = String(plain.caregiver._id || plain.caregiver);
    }
    if (plain.org != null && typeof plain.org !== 'string') {
      plain.org = String(plain.org._id || plain.org);
    }
    if (plain.supersedesDigest) {
      const prior = priorById.get(String(plain.supersedesDigest));
      if (prior) {
        plain.supersedesDigestMeta = {
          id: String(prior._id),
          version: prior.version,
          status: prior.status,
        };
      }
    }
    plain.listScope = 'latestPerDigestDate';
    return plain;
  });
};

/**
 * Send digest email to the caregiver on file. Updates status to sent.
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

  const caregiver = await Caregiver.findById(digest.caregiver).select(
    'email name preferredLanguage isEmailVerified active'
  );
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }
  const eligibility = canReceiveDigestEmail(caregiver);
  if (!eligibility.ok) {
    throw new ApiError(httpStatus.BAD_REQUEST, eligibility.reasons[0]);
  }
  const email = caregiver.email;

  const loc = normalizeLang(digest.locale || caregiver.preferredLanguage);
  const payloadForSend = { ...digest.payload, localeHint: loc };
  const html = payloadToEmailHtml(payloadForSend);
  const text = payloadToPlainText(payloadForSend);
  const subject = tx(loc, 'caregiverDailyDigest.emailSubject', payloadForSend.dateLabel || '');
  const payloadHashAtSend = hashPayload(digest.payload);

  digest.sendInProgressAt = new Date();
  await digest.save();

  let sendResult;
  try {
    sendResult = await emailService.sendEmail(email, subject, text, html);
  } catch (err) {
    digest.sendInProgressAt = null;
    await digest.save();
    throw err;
  }

  const messageId = extractEmailMessageId(sendResult);

  try {
    await markDigestSent(digest, { email, subject, messageId, payloadHashAtSend });
  } catch (saveErr) {
    logger.error('[CaregiverDailyDigest] CRITICAL: SES succeeded but Mongo save failed', {
      digestId: digest.id,
      caregiverId: String(digest.caregiver),
      orgId: String(digest.org),
      emailMessageId: messageId,
      error: saveErr.message,
    });
    throw saveErr;
  }

  logger.info(`[CaregiverDailyDigest] Sent digest ${digest.id} v${digest.version} to ${email}`);
  return digest;
};

const createOrUpdateDigest = async (requester, digestDateInput, options = {}) => {
  const sendEmail = Boolean(options.sendEmail);
  const requesterId = requester.id || requester._id;
  let targetId = requesterId;
  if (options.caregiverId) {
    const requestedTarget = String(options.caregiverId);
    if (
      requestedTarget !== String(requesterId) &&
      requester.role !== 'orgAdmin' &&
      requester.role !== 'superAdmin'
    ) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You cannot build a digest for another caregiver');
    }
    targetId = requestedTarget;
  }
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

  const org = await Org.findById(caregiverDoc.org).select('timezone');
  const { localDateKey, digestDate, timezone } = resolveDigestDayForOrg(org?.timezone, digestDateInput);
  const { payload, locale } = await buildPayloadForCaregiverDay(caregiverDoc, {
    digestDateStart: digestDate,
    orgTimezone: timezone,
    localDateKey,
  });
  const latest = await findLatestDigestForDay(caregiverDoc._id, digestDate);

  let doc;
  if (!latest) {
    doc = await createDigestVersion({
      caregiverDoc,
      digestDate,
      localDateKey,
      timezoneAtBuild: timezone,
      payload,
      locale,
      version: 1,
    });
    logger.info(`[CaregiverDailyDigest] Created digest ${doc.id} v1 for caregiver ${caregiverDoc._id}`);
  } else if (latest.status !== 'sent') {
    doc = await updateDraftDigest(latest, { payload, locale });
    logger.info(`[CaregiverDailyDigest] Refreshed draft digest ${doc.id} v${doc.version} for caregiver ${caregiverDoc._id}`);
  } else {
    const nextVersion = latest.version + 1;
    doc = await createDigestVersion({
      caregiverDoc,
      digestDate,
      localDateKey,
      timezoneAtBuild: timezone,
      payload,
      locale,
      version: nextVersion,
      previousDigest: latest._id,
      supersedesDigest: latest._id,
    });
    logger.info(
      `[CaregiverDailyDigest] Created digest ${doc.id} v${nextVersion} (supersedes sent v${latest.version}) for caregiver ${caregiverDoc._id}`
    );
  }

  if (sendEmail) {
    const reloaded = await CaregiverDailyDigest.findById(doc._id);
    return deliverDigestEmail(reloaded);
  }
  return doc;
};

const paginateLatestDigestsPerDate = async (filter, options) => {
  const limit = options.limit && parseInt(options.limit, 10) > 0 ? parseInt(options.limit, 10) : 10;
  const page = options.page && parseInt(options.page, 10) > 0 ? parseInt(options.page, 10) : 1;
  const skip = (page - 1) * limit;

  const pipeline = [
    { $match: filter },
    { $sort: { digestDate: -1, version: -1 } },
    {
      $group: {
        _id: { caregiver: '$caregiver', digestDate: '$digestDate' },
        doc: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$doc' } },
    { $sort: { digestDate: -1 } },
    {
      $facet: {
        metadata: [{ $count: 'totalResults' }],
        results: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ];

  const [agg] = await CaregiverDailyDigest.aggregate(pipeline);
  const totalResults = agg.metadata[0]?.totalResults || 0;
  const totalPages = Math.ceil(totalResults / limit) || 0;

  return {
    results: await enrichDigestListRows(agg.results),
    page,
    limit,
    totalPages,
    totalResults,
  };
};

const queryOrgDigestsForDay = async (requester, digestDateInput, options) => {
  if (requester.role !== 'orgAdmin' && requester.role !== 'superAdmin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only org admins can list digests for the organization');
  }
  if (!digestDateInput) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'digestDate is required when scope=org');
  }
  const orgId = toOrgIdString(requester.org);
  if (!orgId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this digest');
  }
  const org = await Org.findById(orgId).select('timezone');
  if (!org && requester.role !== 'superAdmin') {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }
  const resolved = resolveDigestDayForOrg(org?.timezone, digestDateInput);
  const orgObjectId =
    typeof orgId === 'string' && mongoose.Types.ObjectId.isValid(orgId)
      ? new mongoose.Types.ObjectId(orgId)
      : requester.org;

  return paginateLatestDigestsPerDate(
    { org: orgObjectId, digestDate: resolved.digestDate },
    {
      ...options,
      limit: options.limit || 200,
      page: options.page || 1,
    }
  );
};

const queryDigests = async (requester, filter, options) => {
  const { caregiverId, digestDate, includeAllVersions, scope } = filter;

  if (scope === 'org') {
    if (includeAllVersions) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'includeAllVersions is not supported with scope=org');
    }
    if (caregiverId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'caregiverId cannot be combined with scope=org');
    }
    return queryOrgDigestsForDay(requester, digestDate, options);
  }

  let targetCaregiverId = requester.id || requester._id;
  if (caregiverId && (requester.role === 'orgAdmin' || requester.role === 'superAdmin')) {
    targetCaregiverId = caregiverId;
  } else if (caregiverId && String(caregiverId) !== String(requester.id || requester._id)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot list digests for another caregiver');
  }

  await ensureCaregiverCanAccessTarget(requester, targetCaregiverId);

  const caregiverObjectId =
    typeof targetCaregiverId === 'string' && mongoose.Types.ObjectId.isValid(targetCaregiverId)
      ? new mongoose.Types.ObjectId(targetCaregiverId)
      : targetCaregiverId;

  const base = { caregiver: caregiverObjectId };
  if (digestDate) {
    const org = await Org.findById(
      (await Caregiver.findById(caregiverObjectId).select('org').lean())?.org
    ).select('timezone');
    const resolved = resolveDigestDayForOrg(org?.timezone, digestDate);
    base.digestDate = resolved.digestDate;
  }

  if (includeAllVersions) {
    if (requester.role !== 'orgAdmin' && requester.role !== 'superAdmin') {
      throw new ApiError(httpStatus.FORBIDDEN, 'Only org admins can list all digest versions');
    }
    const result = await CaregiverDailyDigest.paginate(base, {
      limit: options.limit || 10,
      page: options.page || 1,
      sortBy: options.sortBy || 'digestDate:desc,version:desc',
    });
    result.results = result.results.map((row) => {
      const plain = typeof row.toObject === 'function' ? row.toObject() : { ...row };
      plain.listScope = 'allVersions';
      return plain;
    });
    return result;
  }

  return paginateLatestDigestsPerDate(base, {
    ...options,
    limit: options.limit || 10,
    page: options.page || 1,
  });
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
  resolveDigestDayForOrg,
  stableStringify,
  canonicalizePayload,
  hashPayload,
  isUnsafeDigestText,
  sanitizeDigestText,
  buildPayloadForCaregiverDay,
  createOrUpdateDigest,
  queryDigests,
  getDigestById,
  sendDigest,
  deliverDigestEmail,
  updateDraftDigest,
  createDigestVersion,
  markDigestSent,
  extractEmailMessageId,
  enrichDigestListRows,
  SEND_IN_PROGRESS_TIMEOUT_MS,
};
