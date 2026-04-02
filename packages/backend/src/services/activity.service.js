const mongoose = require('mongoose');
const moment = require('moment-timezone');
const { Call, Alert, Client, Caregiver, Org } = require('../models');
const { resolveOrgId, getAccessibleClientIds } = require('./facilityReports.service');

const truncateMessage = (msg, max = 200) => {
  const s = String(msg || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
};

const residentLabelFromClientDoc = (doc) => {
  if (!doc) return '—';
  return doc.preferredName || doc.name || '—';
};

/**
 * Recent operational events (calls + alerts) for the dashboard feed.
 * Scoped the same way as facility reports: staff see accessible clients; orgAdmin/superAdmin see the org.
 */
const getRecentActivity = async (caregiver, { limit = 25, orgId: queryOrgId, sinceDays = 30 } = {}) => {
  const orgObjectId = resolveOrgId(caregiver, queryOrgId);
  const cap = Math.min(Math.max(Number(limit) || 25, 1), 100);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - Math.min(Math.max(Number(sinceDays) || 30, 1), 90));

  const accessibleIds = await getAccessibleClientIds(caregiver, orgObjectId);
  if (!accessibleIds.length) {
    return { results: [] };
  }

  const orgClientIds = await Client.find({ org: orgObjectId }).distinct('_id');
  const orgCaregiverIds = await Caregiver.find({ org: orgObjectId }).distinct('_id');

  let alertMatch;
  if (caregiver.role === 'orgAdmin' || caregiver.role === 'superAdmin') {
    alertMatch = {
      createdAt: { $gte: since },
      $or: [
        { relatedClient: { $in: orgClientIds } },
        { createdBy: { $in: orgCaregiverIds } },
        { createdBy: orgObjectId, createdModel: 'Org' },
      ],
    };
  } else {
    const selfId = new mongoose.Types.ObjectId(caregiver.id || caregiver._id);
    alertMatch = {
      createdAt: { $gte: since },
      $or: [{ relatedClient: { $in: accessibleIds } }, { createdBy: selfId }],
    };
  }

  const fetchN = Math.min(cap * 3, 300);

  const [calls, alerts] = await Promise.all([
    Call.find({
      clientId: { $in: accessibleIds },
      startTime: { $gte: since },
    })
      .sort({ startTime: -1 })
      .limit(fetchN)
      .populate('clientId', 'name preferredName')
      .lean(),
    Alert.find(alertMatch)
      .sort({ createdAt: -1 })
      .limit(fetchN)
      .populate('relatedClient', 'name preferredName')
      .lean(),
  ]);

  const callRows = calls.map((c) => {
    const clientDoc = c.clientId;
    const t = c.startTime ? new Date(c.startTime) : new Date();
    return {
      id: `call:${c._id}`,
      type: 'call',
      occurredAt: t.toISOString(),
      clientId: clientDoc?._id ? clientDoc._id.toString() : String(c.clientId),
      residentName: residentLabelFromClientDoc(clientDoc),
      callOutcome: c.callOutcome || null,
      callType: c.callType || null,
      status: c.status || null,
      durationSec: Number(c.duration || c.callDuration || 0) || 0,
      alertSummary: null,
    };
  });

  const alertRows = alerts.map((a) => {
    const rc = a.relatedClient;
    const t = a.createdAt ? new Date(a.createdAt) : new Date();
    const clientId = rc?._id ? rc._id.toString() : a.relatedClient ? String(a.relatedClient) : '';
    return {
      id: `alert:${a._id}`,
      type: 'alert',
      occurredAt: t.toISOString(),
      clientId,
      residentName: residentLabelFromClientDoc(rc),
      callOutcome: null,
      callType: null,
      status: null,
      durationSec: 0,
      alertSummary: truncateMessage(a.message),
    };
  });

  const merged = [...callRows, ...alertRows].sort(
    (x, y) => new Date(y.occurredAt).getTime() - new Date(x.occurredAt).getTime()
  );

  return { results: merged.slice(0, cap) };
};

function formatHourLabel12h(hour24) {
  if (hour24 === 0) return '12am';
  if (hour24 < 12) return `${hour24}am`;
  if (hour24 === 12) return '12pm';
  return `${hour24 - 12}pm`;
}

/**
 * Call counts per clock hour (org-local "today") for dashboard chart.
 * Hours 7–17 inclusive match typical facility calling-window UI.
 */
const getCallsByHourToday = async (caregiver, { orgId: queryOrgId } = {}) => {
  const orgObjectId = resolveOrgId(caregiver, queryOrgId);
  const orgDoc = await Org.findById(orgObjectId).select('timezone').lean();
  const tz = orgDoc?.timezone && String(orgDoc.timezone).trim() ? orgDoc.timezone : 'America/New_York';

  const accessibleIds = await getAccessibleClientIds(caregiver, orgObjectId);
  const emptyBuckets = () =>
    Array.from({ length: 11 }, (_, i) => {
      const hour = 7 + i;
      return { hour, label: formatHourLabel12h(hour), calls: 0 };
    });

  if (!accessibleIds.length) {
    const start = moment.tz(tz).startOf('day');
    return {
      timezone: tz,
      dateLabel: start.format('MMM D, YYYY'),
      buckets: emptyBuckets(),
    };
  }

  const start = moment.tz(tz).startOf('day');
  const dayStart = start.toDate();
  const dayEnd = start.clone().add(1, 'day').toDate();

  const agg = await Call.aggregate([
    {
      $match: {
        clientId: { $in: accessibleIds },
        startTime: { $gte: dayStart, $lt: dayEnd, $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: { $hour: { date: '$startTime', timezone: tz } },
        calls: { $sum: 1 },
      },
    },
  ]);

  const byHour = new Map(agg.map((row) => [row._id, row.calls]));
  const buckets = [];
  for (let h = 7; h <= 17; h += 1) {
    buckets.push({
      hour: h,
      label: formatHourLabel12h(h),
      calls: byHour.get(h) || 0,
    });
  }

  return {
    timezone: tz,
    dateLabel: start.format('MMM D, YYYY'),
    buckets,
  };
};

module.exports = {
  getRecentActivity,
  getCallsByHourToday,
};
