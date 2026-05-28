const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { Caregiver, Client, Org, Token } = require('../models');
const ApiError = require('../utils/ApiError');
const { toOrgIdString } = require('../dtos/caregiver.dto');
const logger = require('../config/logger');
const emailService = require('./email.service');
const tokenService = require('./token.service');
const privacyService = require('./privacy.service');
const config = require('../config/config');
const { tokenTypes } = require('../config/tokens');
const { toIdString, assertCaregiverOrgAccess } = require('../utils/accessControl');
const {
  CLIENT_CONSENT_VERSION,
  REQUIRED_CLIENT_CONSENT_PURPOSES,
  normalizePurposes,
  isFullyConsented,
  hasPurposeConsent,
} = require('../constants/clientConsent.constants');
const { hardDeleteFactsForClient } = require('./clientMemory.service');
const { createManualAuditLog } = require('../middlewares/auditLog');

const SYSTEM_AUDIT_USER_ID = new mongoose.Types.ObjectId('000000000000000000000000');

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
  await client.deleteOne();

  const factsDeleted = await hardDeleteFactsForClient(clientId);
  try {
    await createManualAuditLog({
      timestamp: new Date(),
      userId: SYSTEM_AUDIT_USER_ID,
      userRole: 'system',
      action: 'DELETE',
      resource: 'client',
      resourceId: clientId.toString(),
      outcome: 'SUCCESS',
      ipAddress: 'internal',
      metadata: {
        cascade: 'clientMemory',
        factsDeleted: String(factsDeleted),
      },
      complianceFlags: {
        phiAccessed: true,
        highRiskAction: true,
        requiresReview: false,
      },
    });
  } catch (auditError) {
    logger.error('[Client Service] Failed to audit clientMemory cascade delete:', auditError);
  }

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
    const clientFresh = await Client.findById(clientId)
      .select('email name consentedPurposes preferredLanguage org')
      .lean();
    if (!clientFresh || !clientFresh.org) {
      logger.warn(`[Client Service] Cannot send consent email: client ${clientId} has no org`);
      return;
    }
    if (!clientFresh.email) {
      logger.warn(`[Client Service] Cannot send consent email: client ${clientId} has no email`);
      return;
    }
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
    if (isFullyConsented(clientFresh.consentedPurposes)) {
      return;
    }
    const consentToken = await tokenService.generateClientConsentToken(await Client.findById(clientId));
    const consentLink = `${config.frontendUrl}/client/consent?token=${consentToken}`;
    await emailService.sendClientConsentRequestEmail(
      clientFresh.email,
      clientFresh.name,
      orgFresh.name,
      consentLink,
      clientFresh.preferredLanguage || 'en',
      CLIENT_CONSENT_VERSION
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
    return hasPurposeConsent(client.consentedPurposes, purpose);
  } catch (error) {
    logger.error(`[Client Service] Error checking client consent for ${clientId}:`, error);
    return false;
  }
};

const applyClientPurposeGrants = async (client, purposes, consentVersion) => {
  const now = new Date();
  for (const purpose of purposes) {
    client.consentedPurposes[purpose] = true;
    client.consentedAtByPurpose[purpose] = now;
    client.consentVersionByPurpose[purpose] = consentVersion;
  }
  client.markModified('consentedPurposes');
  client.markModified('consentedAtByPurpose');
  client.markModified('consentVersionByPurpose');
  await client.save();
  return client;
};

const verifyConsentToken = async (consentToken, { purposes = [], ipAddress, userAgent } = {}) => {
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

    const normalizedPurposes = normalizePurposes(purposes);
    if (normalizedPurposes.length === 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'At least one consent purpose must be selected');
    }

    const alreadyGranted = normalizedPurposes.filter((purpose) => hasPurposeConsent(client.consentedPurposes, purpose));
    if (alreadyGranted.length === normalizedPurposes.length && isFullyConsented(client.consentedPurposes)) {
      await Token.deleteMany({ client: client._id, type: tokenTypes.CLIENT_CONSENT });
      return {
        success: true,
        alreadyConsented: true,
        message: 'You have already provided consent for all selected purposes.',
        client,
        grantedPurposes: normalizedPurposes,
      };
    }

    const purposesToGrant = normalizedPurposes.filter((purpose) => !hasPurposeConsent(client.consentedPurposes, purpose));
    const consentVersion = CLIENT_CONSENT_VERSION;

    await privacyService.createClientGdprConsentRecord({
      clientId: client._id,
      org: client.org,
      recordType: 'grant',
      purposes: purposesToGrant.length > 0 ? purposesToGrant : normalizedPurposes,
      ipAddress,
      userAgent,
      consentVersion,
    });

    if (purposesToGrant.length > 0) {
      await applyClientPurposeGrants(client, purposesToGrant, consentVersion);
    }

    await Token.deleteMany({ client: client._id, type: tokenTypes.CLIENT_CONSENT });

    const idForFetch = client._id.toString ? client._id.toString() : client._id;
    const updatedClient = await getClientById(idForFetch);
    const fullyConsented = isFullyConsented(updatedClient.consentedPurposes);

    return {
      success: true,
      alreadyConsented: false,
      message: fullyConsented
        ? 'Thank you for providing your consent. Your wellness check calls may now be recorded and processed as selected.'
        : 'Your selected consents have been recorded. Some purposes still require consent before all services can proceed.',
      client: updatedClient,
      grantedPurposes: purposesToGrant.length > 0 ? purposesToGrant : normalizedPurposes,
      fullyConsented,
    };
  } catch (error) {
    logger.error(`[Client Service] Consent verification failed:`, error);
    throw error;
  }
};

/** Validate token without granting consent — used to render the consent form. */
const validateConsentToken = async (consentToken) => {
  const consentTokenDoc = await tokenService.verifyToken(consentToken, tokenTypes.CLIENT_CONSENT);
  const clientRef = consentTokenDoc.client;
  const clientId = clientRef && clientRef._id ? clientRef._id : clientRef;
  if (!clientId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid consent token');
  }
  const client = await Client.findById(clientId).populate('org', 'name country requireClientConsent');
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  return {
    valid: true,
    clientName: client.name,
    orgName: client.org?.name || 'Your care organization',
    consentedPurposes: client.consentedPurposes,
    purposes: REQUIRED_CLIENT_CONSENT_PURPOSES,
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
  validateConsentToken,
};
