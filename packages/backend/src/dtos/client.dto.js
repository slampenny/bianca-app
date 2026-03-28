const ScheduleDTO = require('./schedule.dto');
const callService = require('../services/call.service');
const clientHomeSnapshotService = require('../services/clientHomeSnapshot.service');

const toIsoOrNull = (d) => {
  if (d == null) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const ClientDTO = (client) => {
  if (!client) return null;
  const {
    _id,
    name,
    avatar,
    email,
    phone,
    preferredLanguage,
    isEmailVerified,
    consented,
    consentedAt,
    consentEmailVersion,
    org,
    caregivers,
    lastCallAttemptAt,
    lastAnsweredCallAt,
    sentimentTrendDirection,
    sentimentAnalyzedConversations,
    latestOverallHealthScore,
    latestOverallRiskScore,
    room,
    moveInDate,
    emergencyContact,
  } = client;
  // Use direct property access for populated array (destructuring can miss it on Mongoose docs)
  const schedulesRaw = client.schedules;
  const scheduleDTOs = Array.isArray(schedulesRaw) ? schedulesRaw.map(ScheduleDTO) : [];
  const id = _id;
  const orgId = org ? (typeof org === 'object' ? org._id : org) : null;
  const caregiverIds = caregivers && Array.isArray(caregivers)
    ? caregivers.map((cg) => (typeof cg === 'object' ? cg._id : cg))
    : [];
  return {
    id,
    name,
    avatar,
    email,
    phone,
    preferredLanguage,
    isEmailVerified,
    consented,
    consentedAt,
    consentEmailVersion,
    org: orgId,
    caregivers: caregiverIds,
    schedules: scheduleDTOs,
    lastCallAttemptAt: toIsoOrNull(lastCallAttemptAt),
    lastAnsweredCallAt: toIsoOrNull(lastAnsweredCallAt),
    sentimentTrendDirection: sentimentTrendDirection ?? null,
    sentimentAnalyzedConversations:
      sentimentAnalyzedConversations == null ? null : Number(sentimentAnalyzedConversations),
    latestOverallHealthScore:
      latestOverallHealthScore == null ? null : Math.round(Number(latestOverallHealthScore)),
    latestOverallRiskScore:
      latestOverallRiskScore == null ? null : Math.round(Number(latestOverallRiskScore)),
    room: room == null || room === '' ? null : String(room).trim(),
    moveInDate: toIsoOrNull(moveInDate),
    emergencyContact:
      emergencyContact &&
      typeof emergencyContact === 'object' &&
      (emergencyContact.name ||
        emergencyContact.relationship ||
        emergencyContact.phone ||
        emergencyContact.email)
        ? {
            name: emergencyContact.name || '',
            relationship: emergencyContact.relationship || '',
            phone: emergencyContact.phone || '',
            email: emergencyContact.email ? String(emergencyContact.email).trim().toLowerCase() : '',
          }
        : null,
  };
};

/**
 * @param {Array<object>} clients - Mongoose client documents or plain objects with _id
 * @returns {Promise<object[]>}
 */
const clientsToDTOsWithLastCall = async (clients) => {
  if (!clients || clients.length === 0) {
    return [];
  }
  const ids = clients.map((c) => c._id || c.id).filter(Boolean);
  const [callMap, snapshotMap] = await Promise.all([
    callService.getLastCallTimestampsForClientIds(ids),
    clientHomeSnapshotService.getHomeReportSnapshotsForClientIds(ids),
  ]);
  return clients.map((c) => {
    const plain = typeof c.toObject === 'function' ? c.toObject() : { ...c };
    const key = (plain._id || plain.id).toString();
    const ts = callMap[key] || {};
    const snap = snapshotMap[key] || {};
    return ClientDTO({ ...plain, ...ts, ...snap });
  });
};

module.exports = { ClientDTO, clientsToDTOsWithLastCall };
