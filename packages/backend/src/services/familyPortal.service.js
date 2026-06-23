const httpStatus = require('http-status');
const config = require('../config/config');
const { Caregiver, Client, Org } = require('../models');
const ApiError = require('../utils/ApiError');
const { assertCaregiverOrgAccess, toIdString } = require('../utils/accessControl');
const { normalizeEmail } = require('../utils/familyDigestEligibility');
const { findFamilyDigestRecipientById } = require('../utils/clientContacts.util');
const caregiverService = require('./caregiver.service');
const clientService = require('./client.service');
const tokenService = require('./token.service');
const emailService = require('./email.service');
const familyResidentLinkService = require('./familyResidentLink.service');
const logger = require('../config/logger');

const inviteFamilyRecipient = async (requester, clientId, recipientId) => {
  if (requester.role !== 'orgAdmin' && requester.role !== 'superAdmin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only organization administrators can invite family app users');
  }

  const client = await clientService.getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  assertCaregiverOrgAccess(requester, client.org);

  const org = await Org.findById(client.org);
  await familyResidentLinkService.assertOrgPortalEnabled(org._id);

  const recipient = familyResidentLinkService.validateRecipientOnClient(client, recipientId);
  const email = normalizeEmail(recipient.email);
  const orgId = toIdString(client.org);
  const displayFirst =
    (client.preferredName && String(client.preferredName).trim().split(/\s+/)[0]) ||
    (client.name && String(client.name).trim().split(/\s+/)[0]) ||
    'your loved one';

  let familyCaregiver = await Caregiver.findOne({ email, org: client.org });

  if (!familyCaregiver) {
    familyCaregiver = await Caregiver.create({
      org: client.org,
      name: recipient.name || email,
      email,
      role: 'invited',
      pendingRole: 'family',
      isEmailVerified: true,
      onboardingComplete: true,
      clients: [client._id],
    });
    const orgDoc = await Org.findById(client.org);
    if (orgDoc && !orgDoc.caregivers.some((id) => toIdString(id) === toIdString(familyCaregiver._id))) {
      orgDoc.caregivers.push(familyCaregiver._id);
      await orgDoc.save();
    }
  } else if (familyCaregiver.org.toString() !== orgId) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'This email is already registered with another organization. Use a different email for this resident.'
    );
  } else if (familyCaregiver.role === 'staff' || familyCaregiver.role === 'orgAdmin') {
    throw new ApiError(httpStatus.CONFLICT, 'This email belongs to a staff account and cannot be used for family access');
  } else if (familyCaregiver.role === 'invited') {
    familyCaregiver.pendingRole = 'family';
    if (!familyCaregiver.clients.some((id) => toIdString(id) === toIdString(client._id))) {
      familyCaregiver.clients.push(client._id);
    }
    await familyCaregiver.save();
  } else if (familyCaregiver.role === 'family') {
    if (!familyCaregiver.clients.some((id) => toIdString(id) === toIdString(client._id))) {
      await caregiverService.addClient(familyCaregiver.id, client.id);
    }
  }

  await familyResidentLinkService.upsertLink({
    caregiverId: familyCaregiver._id,
    orgId: client.org,
    clientId: client._id,
    recipientId,
    invitedBy: requester.id || requester._id,
  });

  if (!client.caregivers.some((id) => toIdString(id) === toIdString(familyCaregiver._id))) {
    await clientService.assignCaregiver(familyCaregiver.id, client.id);
  }

  if (familyCaregiver.role === 'invited') {
    const inviteToken = await tokenService.generateInviteToken(familyCaregiver);
    const mobileBase = (config.mobileAppUrl || config.frontendUrl).replace(/\/$/, '');
    const inviteLink = `${mobileBase}/signup?token=${encodeURIComponent(inviteToken)}&family=1`;
    const locale = familyCaregiver.preferredLanguage || 'en';
    await emailService.sendFamilyPortalInviteEmail(
      email,
      org.name,
      displayFirst,
      inviteLink,
      locale
    );
    logger.info(`[FamilyPortal] Invite sent to ${email} for client ${clientId}`);
  }

  return {
    success: true,
    message:
      familyCaregiver.role === 'family'
        ? 'Family app access linked for this resident.'
        : 'Invitation email sent.',
    recipientId: String(recipientId),
    caregiverId: String(familyCaregiver._id),
  };
};

const revokeFamilyRecipient = async (requester, clientId, recipientId) => {
  if (requester.role !== 'orgAdmin' && requester.role !== 'superAdmin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only organization administrators can revoke family app access');
  }
  const client = await clientService.getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  assertCaregiverOrgAccess(requester, client.org);

  const recipient = findFamilyDigestRecipientById(client, recipientId);
  if (!recipient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Recipient not found');
  }
  const email = normalizeEmail(recipient.email);
  const familyCaregiver = await Caregiver.findOne({ email, org: client.org, role: { $in: ['family', 'invited'] } });
  if (!familyCaregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No family app account found for this recipient');
  }

  await familyResidentLinkService.revokeLink({
    caregiverId: familyCaregiver._id,
    clientId,
    recipientId,
  });

  return { success: true, message: 'Family app access revoked for this resident.' };
};

const getPortalStatus = async (requester, clientId) => {
  if (requester.role !== 'orgAdmin' && requester.role !== 'superAdmin' && requester.role !== 'staff') {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to family portal status');
  }
  const client = await clientService.getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  assertCaregiverOrgAccess(requester, client.org);
  const org = await Org.findById(client.org).select('familyPortalSettings').lean();
  const recipients = await familyResidentLinkService.listPortalStatusForClient(client);
  return {
    enabled: org?.familyPortalSettings?.enabled === true,
    recipients,
  };
};

module.exports = {
  inviteFamilyRecipient,
  revokeFamilyRecipient,
  getPortalStatus,
};
