const { normalizeEmail, getFamilyDigestEmailSettings, buildFamilyDigestEligibility } = require('./familyDigestEligibility');

const toPlain = (value) => {
  if (value == null) return value;
  if (typeof value.toObject === 'function') return value.toObject();
  return value;
};

const hasContactFields = (entry) => {
  if (!entry || typeof entry !== 'object') return false;
  return Boolean(
    String(entry.name || '').trim() ||
      String(entry.relationship || '').trim() ||
      String(entry.phone || '').trim() ||
      String(entry.email || '').trim()
  );
};

const normalizeEmergencyContactEntry = (entry) => ({
  id: entry._id ? String(entry._id) : entry.id ? String(entry.id) : undefined,
  name: entry.name ? String(entry.name).trim() : '',
  relationship: entry.relationship ? String(entry.relationship).trim() : '',
  phone: entry.phone ? String(entry.phone).trim() : '',
  email: entry.email ? normalizeEmail(entry.email) : '',
});

const normalizeFamilyDigestRecipient = (entry) => ({
  id: entry._id ? String(entry._id) : entry.id ? String(entry.id) : undefined,
  name: entry.name ? String(entry.name).trim() : '',
  relationship: entry.relationship ? String(entry.relationship).trim() : '',
  email: entry.email ? normalizeEmail(entry.email) : '',
  familyDigestEmail: getFamilyDigestEmailSettings(entry),
});

/**
 * Emergency contacts for phone / directory (may be multiple).
 */
const resolveEmergencyContacts = (client) => {
  const source = toPlain(client);
  if (Array.isArray(source.emergencyContacts) && source.emergencyContacts.length > 0) {
    return source.emergencyContacts.filter(hasContactFields).map(normalizeEmergencyContactEntry);
  }
  const legacy = source.emergencyContact;
  if (hasContactFields(legacy)) {
    return [normalizeEmergencyContactEntry(legacy)];
  }
  return [];
};

/**
 * Family members who may receive the weekly digest (separate from emergency contacts).
 */
const resolveFamilyDigestRecipients = (client) => {
  const source = toPlain(client);
  if (Array.isArray(source.familyDigestRecipients) && source.familyDigestRecipients.length > 0) {
    return source.familyDigestRecipients
      .filter(
        (entry) =>
          hasContactFields(entry) ||
          entry?.familyDigestEmail?.enabled === true ||
          entry?.familyDigestEmail?.verifiedAt
      )
      .map(normalizeFamilyDigestRecipient);
  }
  const legacy = source.emergencyContact;
  if (
    legacy &&
    (normalizeEmail(legacy.email) ||
      legacy.familyDigestEmail?.enabled === true ||
      legacy.familyDigestEmail?.verifiedAt)
  ) {
    return [normalizeFamilyDigestRecipient(legacy)];
  }
  return [];
};

const findFamilyDigestRecipientById = (client, recipientId) => {
  if (!recipientId) return null;
  const idStr = String(recipientId);
  const source = toPlain(client);
  const list = source.familyDigestRecipients;
  if (Array.isArray(list)) {
    const match = list.find((entry) => String(entry._id || entry.id) === idStr);
    if (match) return normalizeFamilyDigestRecipient(match);
  }
  const legacy = resolveFamilyDigestRecipients(client);
  return legacy.find((entry) => entry.id === idStr) || null;
};

const getPrimaryFamilyDigestRecipient = (client) => {
  const recipients = resolveFamilyDigestRecipients(client);
  const eligible = recipients.find((recipient) => buildFamilyDigestEligibility(client, recipient).ok);
  return eligible || recipients[0] || { name: '', relationship: '', email: '', familyDigestEmail: getFamilyDigestEmailSettings(null) };
};

const getEligibleFamilyDigestRecipients = (client) =>
  resolveFamilyDigestRecipients(client).filter((recipient) => buildFamilyDigestEligibility(client, recipient).ok);

const buildAggregateFamilyDigestEligibility = (client) => {
  const recipients = resolveFamilyDigestRecipients(client);
  if (recipients.length === 0) {
    return {
      ok: false,
      reasons: ['Add at least one family digest recipient with a valid email.'],
      warnings: [],
      recipients: [],
    };
  }
  const perRecipient = recipients.map((recipient) => ({
    recipient,
    eligibility: buildFamilyDigestEligibility(client, recipient),
  }));
  const eligible = perRecipient.filter((row) => row.eligibility.ok);
  if (eligible.length === 0) {
    const reasons = [...new Set(perRecipient.flatMap((row) => row.eligibility.reasons))];
    return { ok: false, reasons, warnings: [], recipients: perRecipient };
  }
  const warnings = [...new Set(perRecipient.flatMap((row) => row.eligibility.warnings))];
  return { ok: true, reasons: [], warnings, recipients: perRecipient };
};

/** Keep legacy emergencyContact in sync for older clients and migrations. */
const syncLegacyEmergencyContactFields = (clientDoc) => {
  const contacts = resolveEmergencyContacts(clientDoc);
  const recipients = resolveFamilyDigestRecipients(clientDoc);
  const firstContact = contacts[0] || { name: '', relationship: '', phone: '', email: '' };
  const matchingRecipient =
    recipients.find((recipient) => normalizeEmail(recipient.email) === normalizeEmail(firstContact.email)) ||
    recipients[0];
  clientDoc.emergencyContact = {
    name: firstContact.name || '',
    relationship: firstContact.relationship || '',
    phone: firstContact.phone || '',
    email: firstContact.email || '',
    familyDigestEmail: matchingRecipient
      ? {
          enabled: matchingRecipient.familyDigestEmail.enabled === true,
          verifiedAt: matchingRecipient.familyDigestEmail.verifiedAt,
          verifiedEmail: matchingRecipient.familyDigestEmail.verifiedEmail,
        }
      : { enabled: false, verifiedAt: null, verifiedEmail: null },
  };
};

const recipientSnapshot = (recipient) => ({
  name: recipient?.name ? String(recipient.name).trim() : '',
  relationship: recipient?.relationship ? String(recipient.relationship).trim() : '',
  email: normalizeEmail(recipient?.email),
});

const personalizePayloadForRecipient = (payload, recipient) => {
  const name = recipient?.name ? String(recipient.name).trim() : '';
  const relationship = recipient?.relationship ? String(recipient.relationship).trim() : '';
  const recipientLine = name
    ? `For ${name}${relationship ? ` (${relationship})` : ''}`
    : relationship
      ? `For ${relationship}`
      : 'For authorized contact on file';
  return {
    ...payload,
    subtitleParts: {
      ...(payload.subtitleParts || {}),
      recipientLine,
    },
  };
};

module.exports = {
  resolveEmergencyContacts,
  resolveFamilyDigestRecipients,
  findFamilyDigestRecipientById,
  getPrimaryFamilyDigestRecipient,
  getEligibleFamilyDigestRecipients,
  buildAggregateFamilyDigestEligibility,
  syncLegacyEmergencyContactFields,
  recipientSnapshot,
  personalizePayloadForRecipient,
  normalizeEmergencyContactEntry,
  normalizeFamilyDigestRecipient,
};
