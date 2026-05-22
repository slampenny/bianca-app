const httpStatus = require('http-status');
const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { Client, Call, Alert, Caregiver, CaregiverDailyDigest, Schedule, Org } = require('../models');
const ApiError = require('../utils/ApiError');

const resolveOrgId = (caregiver, queryOrgId) => {
  if (caregiver.role === 'superAdmin') {
    if (!queryOrgId || !mongoose.Types.ObjectId.isValid(queryOrgId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Query parameter orgId is required for this account');
    }
    return new mongoose.Types.ObjectId(queryOrgId);
  }
  const o = caregiver.org?._id || caregiver.org;
  if (!o) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Caregiver has no organization');
  }
  return new mongoose.Types.ObjectId(o);
};

const parseDateRange = (dateFromInput, dateToInput) => {
  let to = dateToInput ? new Date(dateToInput) : new Date();
  let from = dateFromInput ? new Date(dateFromInput) : null;
  if (dateToInput && Number.isNaN(to.getTime())) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid dateTo');
  }
  if (dateFromInput && (!from || Number.isNaN(from.getTime()))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid dateFrom');
  }
  if (!from) {
    from = new Date(to);
    from.setUTCDate(from.getUTCDate() - 7);
    from.setUTCHours(0, 0, 0, 0);
  }
  if (from > to) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'dateFrom must be before or equal to dateTo');
  }
  return { from, to };
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

/**
 * Client ObjectIds this caregiver may include in facility reports (calls / alerts).
 */
const getAccessibleClientIds = async (caregiver, orgObjectId) => {
  if (caregiver.role === 'orgAdmin' || caregiver.role === 'superAdmin') {
    return Client.find({ org: orgObjectId }).distinct('_id');
  }
  const selfId = caregiver.id || caregiver._id;
  const caregiverObjectId = new mongoose.Types.ObjectId(selfId);
  const caregiverDoc = await Caregiver.findById(caregiverObjectId).select('clients');
  const ids = new Set();
  for (const p of caregiverDoc?.clients || []) {
    ids.add(p._id ? p._id.toString() : p.toString());
  }
  const assignedInOrg = await Client.find({
    org: orgObjectId,
    caregivers: caregiverObjectId,
  }).distinct('_id');
  for (const cid of assignedInOrg) {
    if (cid) ids.add(cid.toString());
  }
  return [...ids].map((id) => new mongoose.Types.ObjectId(id));
};

const formatOutcome = (call) => {
  if (call.callOutcome) return String(call.callOutcome).replace(/_/g, ' ');
  if (call.status === 'completed') return 'completed';
  return call.status || 'unknown';
};

const formatDuration = (call) => {
  const sec = Number(call.duration || call.callDuration || 0);
  if (sec <= 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
};

const CALL_LOG_DEFAULT_LIMIT = 50;
const CALL_LOG_MAX_LIMIT = 200;

const answeredCallsFilter = {
  $or: [
    { callOutcome: 'answered' },
    {
      status: 'completed',
      $or: [{ duration: { $gt: 0 } }, { callDuration: { $gt: 0 } }],
    },
  ],
};

/**
 * Call completion log for an org (and optional single client), date range on startTime.
 * Newest calls first. Paginated (default limit 50, max 200).
 */
const getCallCompletionLog = async (caregiver, { dateFrom, dateTo, clientId, orgId: queryOrgId, page: pageIn, limit: limitIn }) => {
  const orgObjectId = resolveOrgId(caregiver, queryOrgId);
  const { from, to } = parseDateRange(dateFrom, dateTo);

  const page = Math.max(1, parseInt(pageIn, 10) || 1);
  let limit = parseInt(limitIn, 10);
  if (!Number.isFinite(limit) || limit < 1) {
    limit = CALL_LOG_DEFAULT_LIMIT;
  }
  limit = Math.min(limit, CALL_LOG_MAX_LIMIT);

  let clientFilter;
  if (clientId) {
    const client = await Client.findById(clientId);
    await ensureCaregiverCanAccessClient(caregiver, client);
    const cOrg = client.org._id || client.org;
    if (cOrg.toString() !== orgObjectId.toString()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Client is not in the selected organization');
    }
    clientFilter = { clientId: client._id };
  } else {
    const ids = await getAccessibleClientIds(caregiver, orgObjectId);
    if (!ids.length) {
      return {
        reportType: 'call_completion_log',
        title: 'Call completion log',
        generatedAt: new Date().toISOString(),
        dateFrom: from.toISOString(),
        dateTo: to.toISOString(),
        summary: { totalCalls: 0, answeredCount: 0, orgId: orgObjectId.toString() },
        rows: [],
        pagination: { page: 1, limit, totalPages: 0, totalResults: 0 },
      };
    }
    clientFilter = { clientId: { $in: ids } };
  }

  const baseFilter = {
    ...clientFilter,
    startTime: { $gte: from, $lte: to },
  };

  const [answeredCount, paginated] = await Promise.all([
    Call.countDocuments({ ...baseFilter, ...answeredCallsFilter }),
    Call.paginate(baseFilter, {
      sortBy: 'startTime:desc',
      page,
      limit,
      populate: 'clientId',
    }),
  ]);

  const rows = paginated.results.map((c) => {
    const clientDoc = c.clientId;
    const residentLabel = clientDoc
      ? clientDoc.preferredName || clientDoc.name || '—'
      : '—';
    const t = c.startTime ? new Date(c.startTime) : null;
    return {
      startTime: t ? t.toISOString() : null,
      resident: residentLabel,
      callType: c.callType || '—',
      outcome: formatOutcome(c),
      duration: formatDuration(c),
      status: c.status || '—',
    };
  });

  return {
    reportType: 'call_completion_log',
    title: 'Call completion log',
    generatedAt: new Date().toISOString(),
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
    summary: {
      totalCalls: paginated.totalResults,
      answeredCount,
      orgId: orgObjectId.toString(),
    },
    rows,
    pagination: {
      page: paginated.page,
      limit: paginated.limit,
      totalPages: paginated.totalPages,
      totalResults: paginated.totalResults,
    },
  };
};

const truncateMessage = (msg, max = 200) => {
  const s = String(msg || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
};

/**
 * Alert audit trail: alerts in date range (by createdAt), scoped to org / staff access.
 * Does not filter by relevanceUntil — intended for governance review.
 */
const getAlertAuditTrail = async (caregiver, { dateFrom, dateTo, orgId: queryOrgId }) => {
  const orgObjectId = resolveOrgId(caregiver, queryOrgId);
  const { from, to } = parseDateRange(dateFrom, dateTo);

  const orgClientIds = await Client.find({ org: orgObjectId }).distinct('_id');
  const orgCaregiverIds = await Caregiver.find({ org: orgObjectId }).distinct('_id');

  let match;
  if (caregiver.role === 'orgAdmin' || caregiver.role === 'superAdmin') {
    match = {
      createdAt: { $gte: from, $lte: to },
      $or: [
        { relatedClient: { $in: orgClientIds } },
        { createdBy: { $in: orgCaregiverIds } },
        { createdBy: orgObjectId, createdModel: 'Org' },
      ],
    };
  } else {
    const accessibleIds = await getAccessibleClientIds(caregiver, orgObjectId);
    const selfId = new mongoose.Types.ObjectId(caregiver.id || caregiver._id);
    match = {
      createdAt: { $gte: from, $lte: to },
      $or: [{ relatedClient: { $in: accessibleIds } }, { createdBy: selfId }],
    };
  }

  const alerts = await Alert.find(match)
    .sort({ createdAt: -1 })
    .populate('relatedClient', 'name preferredName')
    .populate({ path: 'readBy', select: 'name' })
    .limit(2000)
    .lean();

  const rows = alerts.map((a) => {
    const rc = a.relatedClient;
    const resident = rc ? rc.preferredName || rc.name || '—' : '—';
    const ackNames = (a.readBy || [])
      .map((cg) => (cg && cg.name ? cg.name : null))
      .filter(Boolean);
    return {
      alertId: a._id.toString(),
      alertType: a.alertType,
      importance: a.importance,
      resident,
      message: truncateMessage(a.message),
      createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : null,
      acknowledgedBy: ackNames.length ? ackNames.join(', ') : '—',
      readCount: (a.readBy || []).length,
    };
  });

  return {
    reportType: 'alert_audit_trail',
    title: 'Alert audit trail',
    generatedAt: new Date().toISOString(),
    dateFrom: from.toISOString(),
    dateTo: to.toISOString(),
    summary: {
      totalAlerts: rows.length,
      orgId: orgObjectId.toString(),
    },
    rows,
  };
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const startOfUtcMonth = (d = new Date()) => {
  const x = new Date(d);
  x.setUTCDate(1);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};

const complianceLabelFromConsentRate = (rate) => {
  if (rate >= 0.9) return 'Strong';
  if (rate >= 0.7) return 'Moderate';
  return 'Needs attention';
};

/**
 * Rollup metrics for the facility Reports screen (stat cards + weekly volume chart).
 */
const getReportsSummary = async (caregiver, { orgId: queryOrgId } = {}) => {
  const orgObjectId = resolveOrgId(caregiver, queryOrgId);
  const accessibleIds = await getAccessibleClientIds(caregiver, orgObjectId);

  const orgDoc = await Org.findById(orgObjectId).select('name timezone').lean();
  const tz = orgDoc?.timezone && String(orgDoc.timezone).trim() ? orgDoc.timezone : 'America/New_York';

  const monthStart = startOfUtcMonth();
  const weekStart = moment.tz(tz).startOf('day').subtract(6, 'days').toDate();

  const [
    generatedThisMonth,
    scheduledDeliveries,
    residentsWithOpenFollowUps,
    lastDigest,
    consentClients,
    weeklyDigests,
  ] = await Promise.all([
    CaregiverDailyDigest.countDocuments({
      org: orgObjectId,
      createdAt: { $gte: monthStart },
    }),
    accessibleIds.length
      ? Schedule.countDocuments({ client: { $in: accessibleIds }, isActive: true })
      : Promise.resolve(0),
    accessibleIds.length
      ? Alert.distinct('relatedClient', {
          relatedClient: { $in: accessibleIds },
          readBy: { $size: 0 },
          $or: [{ relevanceUntil: { $gte: new Date() } }, { relevanceUntil: null }],
        }).then((ids) => ids.filter(Boolean).length)
      : Promise.resolve(0),
    CaregiverDailyDigest.findOne({ org: orgObjectId })
      .sort({ updatedAt: -1 })
      .select('updatedAt digestDate')
      .lean(),
    accessibleIds.length
      ? Client.find({ _id: { $in: accessibleIds } })
          .select('consented')
          .lean()
      : Promise.resolve([]),
    CaregiverDailyDigest.find({
      org: orgObjectId,
      digestDate: { $gte: weekStart },
    })
      .select('digestDate')
      .lean(),
  ]);

  const consentTotal = consentClients.length;
  const consentOnFile = consentClients.filter((c) => c.consented === true).length;
  const consentRate = consentTotal > 0 ? consentOnFile / consentTotal : 1;
  const complianceScoreLabel = consentTotal > 0 ? complianceLabelFromConsentRate(consentRate) : '—';

  let lastFacilityReportLabel = '—';
  let lastFacilityReportAt = null;
  if (lastDigest?.updatedAt) {
    lastFacilityReportAt = new Date(lastDigest.updatedAt).toISOString();
    lastFacilityReportLabel = moment(lastDigest.updatedAt).tz(tz).format('MMM D, YYYY · HH:mm');
  }

  const runsByDayIndex = new Map();
  for (let i = 0; i < 7; i += 1) {
    const d = moment.tz(tz).startOf('day').subtract(6 - i, 'days');
    runsByDayIndex.set(d.day(), 0);
  }
  for (const doc of weeklyDigests) {
    if (!doc.digestDate) continue;
    const idx = moment(doc.digestDate).tz(tz).day();
    runsByDayIndex.set(idx, (runsByDayIndex.get(idx) || 0) + 1);
  }
  const weeklyReportRuns = [];
  for (let i = 0; i < 7; i += 1) {
    const d = moment.tz(tz).startOf('day').subtract(6 - i, 'days');
    const dayIdx = d.day();
    weeklyReportRuns.push({
      day: DAY_NAMES[dayIdx],
      runs: runsByDayIndex.get(dayIdx) || 0,
    });
  }

  return {
    reportType: 'reports_summary',
    generatedAt: new Date().toISOString(),
    orgId: orgObjectId.toString(),
    generatedThisMonth,
    scheduledDeliveries,
    residentsWithOpenFollowUps,
    lastFacilityReportAt,
    lastFacilityReportLabel,
    complianceScoreLabel,
    weeklyReportRuns,
  };
};

module.exports = {
  getCallCompletionLog,
  getAlertAuditTrail,
  getReportsSummary,
  parseDateRange,
  resolveOrgId,
  getAccessibleClientIds,
  startOfUtcMonth,
  complianceLabelFromConsentRate,
};
