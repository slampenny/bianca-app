const path = require('path');
const httpStatus = require('http-status');
const i18n = require('i18n');
const { Client, Call, Conversation, Caregiver, CaregiverDailyDigest, Org } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

i18n.configure({
  locales: ['en', 'es', 'fr', 'de', 'zh', 'ja', 'pt', 'it', 'ru', 'ko', 'ar'],
  directory: path.join(__dirname, '../locales'),
  defaultLocale: 'en',
  updateFiles: false,
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
    if (target.org.toString() !== requester.org.toString()) {
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
  const clientOrg = client.org?._id ? client.org._id.toString() : client.org.toString();
  if (requester.org.toString() !== clientOrg) {
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
 * Build localized digest payload for one caregiver and UTC calendar day.
 */
const buildPayloadForCaregiverDay = async (caregiverDoc, digestDateStart) => {
  const locale = normalizeLang(caregiverDoc.preferredLanguage) || 'en';
  const dayStart = digestDateStart;
  const dayEnd = endOfUtcDay(dayStart);
  const org = await Org.findById(caregiverDoc.org);
  const orgName = org?.name || '';

  const clientIds = (caregiverDoc.clients || []).map((c) => (c._id ? c._id : c));
  const clients = await Client.find({ _id: { $in: clientIds } })
    .select('name preferredName preferredLanguage org caregivers')
    .lean();

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

    entries.push({
      clientId: cl._id.toString(),
      clientName: displayName,
      clientPreferredLanguage: clientLang,
      caregiverPreferredLanguage: locale,
      languageMismatch,
      languageMismatchExplanation: languageMismatch
        ? tx(locale, 'caregiverDailyDigest.languageMismatchExplanation', clientLangName, caregiverLangName)
        : null,
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
      emailSoon: tx(locale, 'caregiverDailyDigest.emailSoon'),
    },
    entries,
    generatedAt: new Date().toISOString(),
  };

  return { payload, locale };
};

const createOrUpdateDigest = async (requester, digestDateInput) => {
  const targetId = requester.id || requester._id;
  const caregiverDoc = await ensureCaregiverCanAccessTarget(requester, targetId);
  if (!caregiverDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  if (requester.role === 'staff') {
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
    return existing;
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
  if (digest.org.toString() !== requester.org.toString()) {
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

module.exports = {
  startOfUtcDayContaining,
  endOfUtcDay,
  buildPayloadForCaregiverDay,
  createOrUpdateDigest,
  queryDigests,
  getDigestById,
};
