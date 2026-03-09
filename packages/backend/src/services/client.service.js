const httpStatus = require('http-status');
const { Caregiver, Client, Org, Token } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const emailService = require('./email.service');
const tokenService = require('./token.service');
const config = require('../config/config');
const { tokenTypes } = require('../config/tokens');

const createClient = async (clientBody) => {
  return await Client.create(clientBody);
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
  Object.assign(client, updateBody);
  await client.save();
  return client;
};

const deleteClientById = async (clientId) => {
  const client = await getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
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

const getUnassignedClients = async () => {
  try {
    return await Client.find({
      $or: [
        { caregivers: { $exists: false } },
        { caregivers: { $size: 0 } },
      ],
    }).populate('schedules');
  } catch (error) {
    logger.error('Error getting unassigned clients:', error);
    throw error;
  }
};

const sendConsentEmailIfRequired = async (client) => {
  try {
    const clientWithOrg = await Client.findById(client._id).populate('org');
    if (!clientWithOrg || !clientWithOrg.org) {
      logger.warn(`[Client Service] Cannot send consent email: client ${client._id} has no org`);
      return;
    }
    const org = clientWithOrg.org;
    if (!org.requirePatientConsent) {
      return;
    }
    if (client.consented === true) {
      return;
    }
    const consentToken = await tokenService.generateClientConsentToken(client);
    const consentLink = `${config.frontendUrl}/client/consent?token=${consentToken}`;
    const consentEmailVersion = '1.0';
    await emailService.sendPatientConsentRequestEmail(
      client.email,
      client.name,
      org.name,
      consentLink,
      client.preferredLanguage || 'en',
      consentEmailVersion
    );
    logger.info(`[Client Service] Consent request email sent to client ${client._id} (${client.email})`);
  } catch (error) {
    logger.error(`[Client Service] Failed to send consent email to client ${client._id}:`, error);
  }
};

const checkClientConsent = async (clientId) => {
  try {
    const client = await Client.findById(clientId).populate('org');
    if (!client || !client.org) {
      return false;
    }
    const org = client.org;
    if (!org.requirePatientConsent) {
      return true;
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
    const clientId = (clientRef && clientRef._id) ? clientRef._id : clientRef;
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
  sendConsentEmailIfRequired,
  checkClientConsent,
  verifyConsentToken,
};
