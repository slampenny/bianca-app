const httpStatus = require('http-status');
const mongoose = require('mongoose');
const validator = require('validator');
const { FamilyResidentLink, Client, Org, Caregiver } = require('../models');
const ApiError = require('../utils/ApiError');
const { toIdString } = require('../utils/accessControl');
const { normalizeEmail } = require('../utils/familyDigestEligibility');
const {
  findFamilyDigestRecipientById,
  resolveFamilyDigestRecipients,
} = require('../utils/clientContacts.util');

const toObjectId = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(String(value))) {
    return new mongoose.Types.ObjectId(String(value));
  }
  return null;
};

const linkToPlain = (doc) => {
  if (!doc) return null;
  const row = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(row._id || row.id),
    caregiverId: toIdString(row.caregiver),
    orgId: toIdString(row.org),
    clientId: toIdString(row.client),
    recipientId: String(row.recipientId),
    portalEnabled: row.portalEnabled !== false,
    invitedAt: row.invitedAt,
    revokedAt: row.revokedAt || null,
  };
};

const isRecipientVerified = (recipient) => {
  const fd = recipient?.familyDigestEmail;
  if (!fd?.verifiedAt || !fd?.verifiedEmail) return false;
  return normalizeEmail(fd.verifiedEmail) === normalizeEmail(recipient.email);
};

const validateRecipientOnClient = (client, recipientId, expectedEmail) => {
  const recipient = findFamilyDigestRecipientById(client, recipientId);
  if (!recipient) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Family digest recipient not found on this resident');
  }
  const email = normalizeEmail(recipient.email);
  if (!email || !validator.isEmail(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Recipient must have a valid email before portal access');
  }
  if (expectedEmail && email !== normalizeEmail(expectedEmail)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Recipient email does not match this account');
  }
  if (!isRecipientVerified(recipient)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Recipient email must be verified before portal access');
  }
  return recipient;
};

const assertOrgPortalEnabled = async (orgId) => {
  const org = await Org.findById(orgId).select('familyPortalSettings').lean();
  if (!org?.familyPortalSettings?.enabled) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Family mobile access is not enabled for this organization');
  }
};

const listActiveLinksForCaregiver = async (caregiverId) => {
  const cid = toObjectId(caregiverId);
  if (!cid) return [];
  const rows = await FamilyResidentLink.find({ caregiver: cid, revokedAt: null, portalEnabled: true }).lean();
  return rows.map(linkToPlain);
};

const getActiveLink = async (caregiverId, clientId) => {
  const rows = await FamilyResidentLink.find({
    caregiver: toObjectId(caregiverId),
    client: toObjectId(clientId),
    revokedAt: null,
    portalEnabled: true,
  }).lean();
  return rows.length ? linkToPlain(rows[0]) : null;
};

const upsertLink = async ({ caregiverId, orgId, clientId, recipientId, invitedBy }) => {
  const caregiverOid = toObjectId(caregiverId);
  const clientOid = toObjectId(clientId);
  const recipientOid = toObjectId(recipientId);
  const orgOid = toObjectId(orgId);

  const existing = await FamilyResidentLink.findOne({
    caregiver: caregiverOid,
    client: clientOid,
    recipientId: recipientOid,
    revokedAt: null,
  });
  if (existing) {
    existing.portalEnabled = true;
    existing.invitedBy = invitedBy ? toObjectId(invitedBy) : existing.invitedBy;
    existing.invitedAt = existing.invitedAt || new Date();
    await existing.save();
    return linkToPlain(existing);
  }

  const revoked = await FamilyResidentLink.findOne({
    caregiver: caregiverOid,
    client: clientOid,
    recipientId: recipientOid,
    revokedAt: { $ne: null },
  });
  if (revoked) {
    revoked.revokedAt = null;
    revoked.portalEnabled = true;
    revoked.invitedBy = invitedBy ? toObjectId(invitedBy) : revoked.invitedBy;
    revoked.invitedAt = new Date();
    await revoked.save();
    return linkToPlain(revoked);
  }

  const created = await FamilyResidentLink.create({
    caregiver: caregiverOid,
    org: orgOid,
    client: clientOid,
    recipientId: recipientOid,
    invitedBy: invitedBy ? toObjectId(invitedBy) : null,
  });
  return linkToPlain(created);
};

const revokeLink = async ({ caregiverId, clientId, recipientId }) => {
  const query = {
    caregiver: toObjectId(caregiverId),
    client: toObjectId(clientId),
    revokedAt: null,
  };
  if (recipientId) {
    query.recipientId = toObjectId(recipientId);
  }
  const link = await FamilyResidentLink.findOne(query);
  if (!link) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Family portal link not found');
  }
  link.revokedAt = new Date();
  link.portalEnabled = false;
  await link.save();
  return linkToPlain(link);
};

/**
 * Validates live link + recipient; throws if family user may not access client.
 */
const assertFamilyAccess = async (caregiver, clientId) => {
  if (!caregiver || caregiver.role !== 'family') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Family access required');
  }
  const link = await getActiveLink(caregiver.id || caregiver._id, clientId);
  if (!link) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this resident');
  }
  const client = await Client.findById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  if (client.consented === false) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Resident consent is required');
  }
  await assertOrgPortalEnabled(client.org);
  validateRecipientOnClient(client, link.recipientId, caregiver.email);
  return { link, client };
};

const buildLinkedResidentsForCaregiver = async (caregiver) => {
  if (!caregiver || caregiver.role !== 'family') {
    return [];
  }
  const links = await listActiveLinksForCaregiver(caregiver.id || caregiver._id);
  const results = [];
  for (const link of links) {
    try {
      const client = await Client.findById(link.clientId).select('name preferredName org consented familyDigestRecipients').lean();
      if (!client) continue;
      const org = await Org.findById(client.org).select('familyPortalSettings').lean();
      if (!org?.familyPortalSettings?.enabled) continue;
      const recipient = validateRecipientOnClient(client, link.recipientId, caregiver.email);
      const displayName =
        (client.preferredName && String(client.preferredName).trim()) ||
        (client.name && String(client.name).trim()) ||
        'Resident';
      results.push({
        clientId: link.clientId,
        displayName,
        recipientId: link.recipientId,
        relationship: recipient.relationship || '',
      });
    } catch {
      /* stale link — omit until staff re-invites */
    }
  }
  return results;
};

const listPortalStatusForClient = async (client) => {
  const recipients = resolveFamilyDigestRecipients(client);
  const links = await FamilyResidentLink.find({ client: client._id, revokedAt: null })
    .populate('caregiver', 'email role')
    .lean();
  const linkByRecipient = new Map(links.map((l) => [String(l.recipientId), l]));

  return recipients.map((recipient) => {
    const rid = recipient.id ? String(recipient.id) : null;
    const link = rid ? linkByRecipient.get(rid) : null;
    const linkCaregiver = link?.caregiver;
    let status = 'not_invited';
    if (link && link.portalEnabled) {
      if (linkCaregiver?.role === 'family') status = 'active';
      else if (linkCaregiver?.role === 'invited') status = 'invited';
      else status = 'active';
    }
    return {
      recipientId: rid,
      name: recipient.name,
      email: recipient.email,
      relationship: recipient.relationship,
      emailVerified: isRecipientVerified(recipient),
      portalStatus: status,
      linkId: link ? String(link._id) : null,
    };
  });
};

module.exports = {
  linkToPlain,
  isRecipientVerified,
  validateRecipientOnClient,
  assertOrgPortalEnabled,
  listActiveLinksForCaregiver,
  getActiveLink,
  upsertLink,
  revokeLink,
  assertFamilyAccess,
  buildLinkedResidentsForCaregiver,
  listPortalStatusForClient,
  enrichAuthSession: async (caregiver, clients) => {
    const { accountModeForRole } = require('../utils/familyAccess.util');
    const accountMode = accountModeForRole(caregiver.role);
    const linkedResidents = await buildLinkedResidentsForCaregiver(caregiver);
    if (caregiver.role !== 'family') {
      return { accountMode, linkedResidents: [], clients: clients || [] };
    }
    const allowed = new Set(linkedResidents.map((r) => r.clientId));
    const filteredClients = (clients || []).filter((c) => allowed.has(String(c._id || c.id)));
    return { accountMode, linkedResidents, clients: filteredClients };
  },
};
