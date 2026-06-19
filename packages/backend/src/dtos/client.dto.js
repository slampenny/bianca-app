const ScheduleDTO = require('./schedule.dto');
const callService = require('../services/call.service');
const clientHomeSnapshotService = require('../services/clientHomeSnapshot.service');
const { splitFullName, fullNameFromParts } = require('../utils/clientName.util');
const { normalizeEmail, getFamilyDigestEmailSettings } = require('../utils/familyDigestEligibility');
const {
  resolveEmergencyContacts,
  resolveFamilyDigestRecipients,
} = require('../utils/clientContacts.util');

const toIsoOrNull = (d) => {
  if (d == null) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const formatEmergencyContactDto = (emergencyContact) =>
  emergencyContact &&
  typeof emergencyContact === 'object' &&
  (emergencyContact.name ||
    emergencyContact.relationship ||
    emergencyContact.phone ||
    emergencyContact.email ||
    emergencyContact.familyDigestEmail)
    ? {
        name: emergencyContact.name || '',
        relationship: emergencyContact.relationship || '',
        phone: emergencyContact.phone || '',
        email: emergencyContact.email ? String(emergencyContact.email).trim().toLowerCase() : '',
        familyDigestEmail: emergencyContact.familyDigestEmail
          ? {
              enabled: emergencyContact.familyDigestEmail.enabled === true,
              verifiedAt: toIsoOrNull(emergencyContact.familyDigestEmail.verifiedAt),
              verifiedEmail: emergencyContact.familyDigestEmail.verifiedEmail
                ? normalizeEmail(emergencyContact.familyDigestEmail.verifiedEmail)
                : null,
            }
          : { enabled: false, verifiedAt: null, verifiedEmail: null },
      }
    : null;

const formatFamilyDigestRecipientDto = (recipient) => {
  const digest = getFamilyDigestEmailSettings(recipient);
  return {
    id: recipient.id || recipient._id || null,
    name: recipient.name || '',
    relationship: recipient.relationship || '',
    email: recipient.email ? normalizeEmail(recipient.email) : '',
    familyDigestEmail: {
      enabled: digest.enabled,
      verifiedAt: toIsoOrNull(digest.verifiedAt),
      verifiedEmail: digest.verifiedEmail,
    },
  };
};

const ClientDTO = (client) => {
  if (!client) return null;
  const source = typeof client.toObject === 'function' ? client.toObject() : client;
  const {
    _id,
    name,
    firstName: rawFirst,
    lastName: rawLast,
    preferredName,
    age,
    notes,
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
  } = source;
  let firstName = rawFirst;
  let lastName = rawLast;
  if ((firstName == null || firstName === '') && (lastName == null || lastName === '') && name) {
    const s = splitFullName(String(name));
    firstName = s.firstName;
    lastName = s.lastName;
  } else {
    if (firstName == null) firstName = '';
    if (lastName == null) lastName = '';
  }
  const combinedName = fullNameFromParts(firstName, lastName) || (name && String(name).trim()) || '';
  // Use direct property access for populated array (destructuring can miss it on Mongoose docs)
  const schedulesRaw = source.schedules;
  const scheduleDTOs = Array.isArray(schedulesRaw) ? schedulesRaw.map(ScheduleDTO) : [];
  const id = _id;
  let orgId = null;
  if (org) {
    orgId = typeof org === 'object' ? org._id : org;
  }
  const caregiverIds =
    caregivers && Array.isArray(caregivers) ? caregivers.map((cg) => (typeof cg === 'object' ? cg._id : cg)) : [];
  return {
    id,
    name: combinedName,
    firstName: (firstName && String(firstName).trim()) || '',
    lastName: (lastName && String(lastName).trim()) || '',
    preferredName: preferredName || null,
    age: age == null ? null : Number(age),
    notes: notes || null,
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
    sentimentTrendDirection: sentimentTrendDirection == null ? null : sentimentTrendDirection,
    sentimentAnalyzedConversations: sentimentAnalyzedConversations == null ? null : Number(sentimentAnalyzedConversations),
    latestOverallHealthScore: latestOverallHealthScore == null ? null : Math.round(Number(latestOverallHealthScore)),
    latestOverallRiskScore: latestOverallRiskScore == null ? null : Math.round(Number(latestOverallRiskScore)),
    room: room == null || room === '' ? null : String(room).trim(),
    moveInDate: toIsoOrNull(moveInDate),
    emergencyContact: formatEmergencyContactDto(emergencyContact),
    emergencyContacts: resolveEmergencyContacts(source).map((entry) => ({
      id: entry.id || null,
      name: entry.name,
      relationship: entry.relationship,
      phone: entry.phone,
      email: entry.email,
    })),
    familyDigestRecipients: resolveFamilyDigestRecipients(source).map(formatFamilyDigestRecipientDto),
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
