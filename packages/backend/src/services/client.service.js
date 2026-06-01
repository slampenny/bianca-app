const httpStatus = require('http-status');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const { Caregiver, Client, Org, Token } = require('../models');
const ApiError = require('../utils/ApiError');
const { toOrgIdString } = require('../dtos/caregiver.dto');
const logger = require('../config/logger');
const emailService = require('./email.service');
const tokenService = require('./token.service');
const config = require('../config/config');
const { tokenTypes } = require('../config/tokens');
const { toIdString, assertCaregiverOrgAccess } = require('../utils/accessControl');
const { normalizeEmail, getFamilyDigestEmailSettings } = require('../utils/familyDigestEligibility');

const createClient = async (clientBody) => {
  return Client.create(clientBody);
};

const queryClients = async (filter, options) => {
  const clients = await Client.paginate(filter, options);
  return clients;
};

const getClientById = async (id) => {
  return Client.findById(id).populate('schedules');
};

const getClientByEmail = async (email) => {
  return Client.findOne({ email }).populate('schedules');
};

const updateClientById = async (clientId, updateBody) => {
  const client = await getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  const patch = { ...updateBody };
  if (patch.emergencyContact && typeof patch.emergencyContact === 'object') {
    const prev =
      client.emergencyContact && typeof client.emergencyContact.toObject === 'function'
        ? client.emergencyContact.toObject()
        : client.emergencyContact || {};
    if (patch.emergencyContact.familyDigestEmail && typeof patch.emergencyContact.familyDigestEmail === 'object') {
      patch.emergencyContact.familyDigestEmail = {
        ...(prev.familyDigestEmail || {}),
        ...patch.emergencyContact.familyDigestEmail,
      };
    }
    if (patch.emergencyContact.email !== undefined) {
      const prevEmail = normalizeEmail(prev.email);
      const nextEmail = normalizeEmail(patch.emergencyContact.email);
      if (nextEmail !== prevEmail) {
        patch.emergencyContact.familyDigestEmail = {
          ...(patch.emergencyContact.familyDigestEmail || prev.familyDigestEmail || {}),
          verifiedAt: null,
          verifiedEmail: null,
        };
      }
    }
    patch.emergencyContact = { ...prev, ...patch.emergencyContact };
  }
  Object.assign(client, patch);
  await client.save();
  return client;
};

const deleteClientById = async (clientId) => {
  const client = await getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  const digestCleanup = require('./caregiverDailyDigestCleanup.service');
  const familyDigestCleanup = require('./familyWeeklyDigestCleanup.service');
  await digestCleanup.cleanupDigestsForClient(clientId, 'client_deleted');
  await familyDigestCleanup.cleanupDigestsForClient(clientId, 'client_deleted');
  await client.deleteOne();
  return client;
};

const assignCaregiver = async (caregiverId, clientId) => {
  const client = await getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }
  if (!client.caregivers.includes(caregiverId)) {
    client.caregivers.push(caregiverId);
    await client.save();
  }
  if (!caregiver.clients.includes(clientId)) {
    caregiver.clients.push(clientId);
    await caregiver.save();
  }
  return client;
};

const removeCaregiver = async (caregiverId, clientId) => {
  const client = await getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }
  const caregiverIndex = client.caregivers.indexOf(caregiverId);
  if (caregiverIndex !== -1) {
    client.caregivers.splice(caregiverIndex, 1);
    await client.save();
  }
  const clientIndex = caregiver.clients.indexOf(clientId);
  if (clientIndex !== -1) {
    caregiver.clients.splice(clientIndex, 1);
    await caregiver.save();
  }
  return client;
};

const getCaregivers = async (clientId) => {
  const client = await Client.findById(clientId).populate('caregivers');
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  return client.caregivers;
};

const getActiveClients = async () => {
  try {
    return await Client.find({}).select('_id name email');
  } catch (error) {
    logger.error('Error getting active clients:', error);
    throw error;
  }
};

const getUnassignedClients = async (requestingCaregiver) => {
  try {
    const filter = {
      $or: [{ caregivers: { $exists: false } }, { caregivers: { $size: 0 } }],
    };
    if (!requestingCaregiver || requestingCaregiver.role !== 'superAdmin') {
      assertCaregiverOrgAccess(requestingCaregiver, requestingCaregiver.org, 'You do not have access to this organization');
      filter.org = toIdString(requestingCaregiver.org);
    }
    return Client.find(filter).populate('schedules');
  } catch (error) {
    logger.error('Error getting unassigned clients:', error);
    throw error;
  }
};

/**
 * Assign multiple unassigned clients to a caregiver (bulk assign from admin UI).
 * @param {string} caregiverId
 * @param {string[]} clientIds
 * @returns {Promise<import('mongoose').Document[]>}
 */
const assignUnassignedClients = async (caregiverId, clientIds, requestingCaregiver) => {
  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'clientIds must be a non-empty array');
  }
  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }
  const caregiverOrgId = toOrgIdString(caregiver.org);
  if (!requestingCaregiver || requestingCaregiver.role !== 'superAdmin') {
    assertCaregiverOrgAccess(requestingCaregiver, caregiverOrgId, 'You do not have access to this organization');
  }
  const updates = await Promise.all(
    clientIds.map(async (clientId) => {
      const client = await Client.findById(clientId);
      if (!client) {
        logger.warn(`[assignUnassignedClients] Skipping missing client ${clientId}`);
        return null;
      }
      const clientOrgId = toOrgIdString(client.org);
      if (caregiverOrgId && clientOrgId && caregiverOrgId !== clientOrgId) {
        logger.warn(
          `[assignUnassignedClients] Client ${clientId} is not in the same organization as the caregiver; skipping`
        );
        return null;
      }
      const hasNoCaregivers = !client.caregivers || client.caregivers.length === 0;
      if (!hasNoCaregivers) {
        logger.warn(`[assignUnassignedClients] Client ${clientId} already has caregivers; skipping`);
        return null;
      }
      return assignCaregiver(caregiverId, clientId);
    })
  );
  return updates.filter(Boolean);
};

const sendConsentEmailIfRequired = async (client) => {
  try {
    const clientId = client._id || client.id;
    const clientFresh = await Client.findById(clientId).select('email name consented preferredLanguage org').lean();
    if (!clientFresh || !clientFresh.org) {
      logger.warn(`[Client Service] Cannot send consent email: client ${clientId} has no org`);
      return;
    }
    if (!clientFresh.email) {
      logger.warn(`[Client Service] Cannot send consent email: client ${clientId} has no email`);
      return;
    }
    // Fresh read — populated org can be stale right after PATCH requireClientConsent (E2E / org settings).
    const orgId = clientFresh.org;
    const orgFresh = await Org.findById(orgId).lean();
    if (!orgFresh || !orgFresh.requireClientConsent) {
      logger.warn(
        `[Client Service] Skipping consent email for client ${clientId}: org ${orgId} missing or requireClientConsent=${Boolean(
          orgFresh && orgFresh.requireClientConsent
        )}`
      );
      return;
    }
    if (clientFresh.consented === true) {
      return;
    }
    const consentToken = await tokenService.generateClientConsentToken(await Client.findById(clientId));
    const consentLink = `${config.frontendUrl}/client/consent?token=${consentToken}`;
    const consentEmailVersion = '1.0';
    await emailService.sendClientConsentRequestEmail(
      clientFresh.email,
      clientFresh.name,
      orgFresh.name,
      consentLink,
      clientFresh.preferredLanguage || 'en',
      consentEmailVersion
    );
    logger.info(`[Client Service] Consent request email sent to client ${client._id} (${client.email})`);
  } catch (error) {
    logger.error(`[Client Service] Failed to send consent email to client ${client._id}:`, error);
  }
};

const checkClientConsent = async (clientId, purpose = 'recording') => {
  try {
    const client = await Client.findById(clientId).populate('org');
    if (!client || !client.org) {
      return false;
    }
    const { org } = client;
    if (!org.requireClientConsent) {
      return true;
    }
    if (purpose === 'aiAnalysis') {
      if (client.consentedPurposes && typeof client.consentedPurposes.aiAnalysis === 'boolean') {
        return client.consentedPurposes.aiAnalysis === true;
      }
      return client.consented === true;
    }
    return client.consented === true;
  } catch (error) {
    logger.error(`[Client Service] Error checking client consent for ${clientId}:`, error);
    return false;
  }
};

const verifyConsentToken = async (consentToken) => {
  try {
    const consentTokenDoc = await tokenService.verifyToken(consentToken, tokenTypes.CLIENT_CONSENT);
    const clientRef = consentTokenDoc.client;
    const clientId = clientRef && clientRef._id ? clientRef._id : clientRef;
    if (!clientId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid consent token');
    }
    const client = await Client.findById(clientId).populate('org');
    if (!client) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
    }
    if (client.consented === true) {
      await Token.deleteMany({ client: client._id, type: tokenTypes.CLIENT_CONSENT });
      return {
        success: true,
        alreadyConsented: true,
        message: 'You have already provided consent for call recording.',
        client,
      };
    }
    const idForFetch = client._id.toString ? client._id.toString() : client._id;
    await Token.deleteMany({ client: client._id, type: tokenTypes.CLIENT_CONSENT });
    await updateClientById(idForFetch, {
      consented: true,
      consentedAt: new Date(),
      consentEmailVersion: client.consentEmailVersion || '1.0',
    });
    return {
      success: true,
      alreadyConsented: false,
      message: 'Thank you for providing your consent. Your wellness check calls may now be recorded.',
      client: await getClientById(idForFetch),
    };
  } catch (error) {
    logger.error(`[Client Service] Consent verification failed:`, error);
    throw error;
  }
};

const sendFamilyDigestEmailVerification = async (caregiver, clientId) => {
  if (caregiver.role !== 'orgAdmin' && caregiver.role !== 'superAdmin') {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Only organization administrators can send family digest verification emails'
    );
  }
  const client = await Client.findById(clientId).populate('org');
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  assertCaregiverOrgAccess(caregiver, client.org);
  if (!client.org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }
  const email = normalizeEmail(client.emergencyContact?.email);
  if (!email || !validator.isEmail(email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'A valid emergency contact email is required before sending verification');
  }
  const verifyToken = await tokenService.generateFamilyDigestEmailVerifyToken(client, email);
  const verifyLink = `${config.frontendUrl}/family-digest-email/verify?token=${encodeURIComponent(verifyToken)}`;
  await emailService.sendFamilyDigestEmailVerificationEmail(
    email,
    client.org.name,
    verifyLink,
    client.preferredLanguage || 'en'
  );
  logger.info(`[Client Service] Family digest email verification sent for client ${clientId} (${email})`);
  return {
    success: true,
    message: 'Verification email sent to the emergency contact address.',
  };
};

const verifyFamilyDigestEmailToken = async (verifyToken) => {
  let payload;
  try {
    payload = jwt.verify(verifyToken, config.jwt.secret);
  } catch (err) {
    logger.warn(`[Client Service] Family digest email verification JWT failed: ${err.message}`);
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired verification token');
  }
  if (payload.type !== tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid verification token');
  }
  const tokenEmail = normalizeEmail(payload.email);
  if (!tokenEmail) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid verification token');
  }

  await tokenService.verifyToken(verifyToken, tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY);

  const clientId = payload.sub;
  const client = await Client.findById(clientId).populate('org');
  if (!client || !client.org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  const currentEmail = normalizeEmail(client.emergencyContact?.email);
  if (!currentEmail || currentEmail !== tokenEmail) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      'Emergency contact email has changed since this link was sent. Please request a new verification email.'
    );
  }

  const digestSettings = getFamilyDigestEmailSettings(client.emergencyContact);
  const alreadyVerified = Boolean(
    digestSettings.verifiedAt && digestSettings.verifiedEmail === currentEmail
  );

  await Token.deleteMany({ client: client._id, type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY });

  if (!alreadyVerified) {
    await updateClientById(client._id, {
      emergencyContact: {
        familyDigestEmail: {
          verifiedAt: new Date(),
          verifiedEmail: currentEmail,
        },
      },
    });
  }

  return {
    success: true,
    alreadyVerified,
    message: alreadyVerified
      ? 'This email address is already verified for weekly family digest emails.'
      : 'Thank you. Your email is now verified to receive weekly family digest emails.',
    client: await getClientById(client._id),
  };
};

module.exports = {
  createClient,
  queryClients,
  getClientById,
  getClientByEmail,
  updateClientById,
  deleteClientById,
  assignCaregiver,
  removeCaregiver,
  getCaregivers,
  getActiveClients,
  getUnassignedClients,
  assignUnassignedClients,
  sendConsentEmailIfRequired,
  checkClientConsent,
  verifyConsentToken,
  sendFamilyDigestEmailVerification,
  verifyFamilyDigestEmailToken,
};
