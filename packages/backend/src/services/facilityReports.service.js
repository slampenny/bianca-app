const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { Client, Call, Alert, Caregiver } = require('../models');
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
  const caregiverDoc = await Caregiver.findById(caregiver.id || caregiver._id).select('clients');
  const ids = new Set();
  for (const p of caregiverDoc?.clients || []) {
    ids.add(p._id ? p._id.toString() : p.toString());
  }
  const fromCalls = await Call.distinct('clientId', { caregiverId: caregiver.id });
  for (const cid of fromCalls) {
    if (cid) ids.add(cid.toString());
  }
  const list = [...ids].map((id) => new mongoose.Types.ObjectId(id));
  const inOrg = await Client.find({ _id: { $in: list }, org: orgObjectId }).distinct('_id');
  return inOrg;
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

/**
 * Call completion log for an org (and optional single client), date range on startTime.
 */
const getCallCompletionLog = async (caregiver, { dateFrom, dateTo, clientId, orgId: queryOrgId }) => {
  const orgObjectId = resolveOrgId(caregiver, queryOrgId);
  const { from, to } = parseDateRange(dateFrom, dateTo);

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
      };
    }
    clientFilter = { clientId: { $in: ids } };
  }

  const calls = await Call.find({
    ...clientFilter,
    startTime: { $gte: from, $lte: to },
  })
    .sort({ startTime: 1 })
    .populate('clientId', 'name preferredName')
    .lean();

  let answeredCount = 0;
  const rows = calls.map((c) => {
    const answered = c.callOutcome === 'answered' || (Number(c.duration) > 0 && c.status === 'completed');
    if (answered) answeredCount += 1;
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
      totalCalls: rows.length,
      answeredCount,
      orgId: orgObjectId.toString(),
    },
    rows,
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

module.exports = {
  getCallCompletionLog,
  getAlertAuditTrail,
  parseDateRange,
  resolveOrgId,
};
