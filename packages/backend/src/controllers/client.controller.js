const httpStatus = require('http-status');
const path = require('path');
const pick = require('../utils/pick');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { caregiverService, conversationService, clientService, scheduleService } = require('../services');
const { ConversationDTO, ClientDTO } = require('../dtos');
const { toOrgIdString } = require('../dtos/caregiver.dto');

const createClient = catchAsync(async (req, res) => {
  const { schedules, ...clientData } = req.body;
  const { file } = req;
  if (file) {
    clientData.avatar = file.path;
  }
  if (!req.caregiver?.org) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Your caregiver account does not have an organization assigned. Please contact support.');
  }
  if (!clientData.org) {
    let orgId = req.caregiver.org;
    if (orgId && orgId._id) orgId = orgId._id;
    const mongoose = require('mongoose');
    if (orgId instanceof mongoose.Types.ObjectId) orgId = orgId.toString();
    else if (typeof orgId === 'object' && orgId && orgId.toString) orgId = orgId.toString();
    clientData.org = orgId;
  }
  if (!clientData.org) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to assign organization to client. Please contact support.');
  }
  let client = await clientService.createClient(clientData);
  if (schedules) {
    for (const schedule of schedules) {
      await scheduleService.createSchedule(client.id, schedule);
    }
  }
  client = await caregiverService.addClient(req.caregiver._id || req.caregiver.id, client.id);
  try {
    await clientService.sendConsentEmailIfRequired(client);
  } catch (err) {
    logger.error('Failed to send consent email after client creation:', err);
  }
  res.status(httpStatus.CREATED).send(ClientDTO(client));
});

const getClients = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'role']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await clientService.queryClients(filter, options);
  res.send(result);
});

const getClient = catchAsync(async (req, res) => {
  const client = await clientService.getClientById(req.params.clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  res.send(ClientDTO(client));
});

const updateClient = catchAsync(async (req, res) => {
  const { schedules, ...clientData } = req.body;
  const client = await clientService.updateClientById(req.params.clientId, clientData);
  if (schedules) {
    for (const schedule of schedules) {
      await scheduleService.updateSchedule(schedule.id, { ...schedule });
    }
  }
  if (clientData.email || clientData.consented === undefined) {
    clientService.sendConsentEmailIfRequired(client).catch((err) => logger.error('Failed to send consent email after client update:', err));
  }
  res.send(ClientDTO(client));
});

const uploadClientAvatar = catchAsync(async (req, res) => {
  const { file } = req;
  if (!file) throw new Error('No file uploaded');
  const filename = path.basename(file.path);
  const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
  const client = await clientService.updateClientById(req.params.clientId, { avatar: avatarUrl });
  res.send(client);
});

const deleteClient = catchAsync(async (req, res) => {
  await clientService.deleteClientById(req.params.clientId);
  res.status(httpStatus.NO_CONTENT).send();
});

const assignCaregiver = catchAsync(async (req, res) => {
  const { clientId, caregiverId } = req.params;
  const updatedClient = await clientService.assignCaregiver(caregiverId, clientId);
  res.status(httpStatus.OK).send(ClientDTO(updatedClient));
});

const removeCaregiver = catchAsync(async (req, res) => {
  const { clientId, caregiverId } = req.params;
  const updatedClient = await clientService.removeCaregiver(caregiverId, clientId);
  res.status(httpStatus.OK).send(ClientDTO(updatedClient));
});

const getClientsByCaregiver = catchAsync(async (req, res) => {
  const { caregiverId } = req.params;
  const clients = await caregiverService.getClients(caregiverId);
  res.status(httpStatus.OK).send(clients);
});

const getConversationsByClient = catchAsync(async (req, res) => {
  const { clientId } = req.params;
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const caregiver = req.caregiver;
  const client = await clientService.getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid client ID');
  }
  if (caregiver.role === 'staff') {
    const caregiverDoc = await caregiverService.getCaregiverById(caregiver.id);
    const hasClientAccess = caregiverDoc.clients.some((p) => (p._id ? p._id.toString() : p.toString()) === clientId.toString())
      || (client.caregivers && client.caregivers.some((c) => (c._id ? c._id.toString() : c.toString()) === caregiver.id.toString()));
    if (!hasClientAccess) {
      const { Conversation } = require('../models');
      const conversationCount = await Conversation.countDocuments({ clientId, agentId: caregiver.id });
      if (conversationCount === 0) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this client\'s conversations');
      }
    }
  } else if (caregiver.role === 'orgAdmin') {
    const clientOrgId = toOrgIdString(client.org);
    const caregiverOrgId = toOrgIdString(caregiver.org);
    if (clientOrgId && caregiverOrgId && clientOrgId !== caregiverOrgId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this client\'s conversations');
    }
  }
  if (!options.sortBy) options.sortBy = 'startTime:desc';
  const result = await conversationService.queryConversationsByClient(clientId, options);
  const transformedResults = [];
  for (const conversation of result.results) {
    try {
      if (!conversation._id && !conversation.id) continue;
      transformedResults.push(ConversationDTO(conversation));
    } catch (error) {
      logger.error('[ClientController] Error transforming conversation with DTO', { error: error.message });
    }
  }
  res.status(httpStatus.OK).send({ ...result, results: transformedResults, totalResults: transformedResults.length });
});

const getCaregivers = catchAsync(async (req, res) => {
  const { clientId } = req.params;
  const caregivers = await clientService.getCaregivers(clientId);
  if (!caregivers) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregivers not found');
  }
  res.status(httpStatus.OK).send(caregivers);
});

const getUnassignedClients = catchAsync(async (req, res) => {
  const clients = await clientService.getUnassignedClients();
  res.status(httpStatus.OK).send(clients.map((c) => ClientDTO(c)));
});

const assignUnassignedClients = catchAsync(async (req, res) => {
  const { caregiverId, clientIds } = req.body;
  const clients = await clientService.assignUnassignedClients(caregiverId, clientIds);
  res.status(httpStatus.OK).send(clients.map((c) => ClientDTO(c)));
});

const verifyConsent = catchAsync(async (req, res) => {
  const wantsJson = req.headers.accept?.includes('application/json') || req.query.format === 'json';
  const token = req.query.token || req.body.token;
  if (!token) {
    if (wantsJson) return res.status(httpStatus.BAD_REQUEST).json({ success: false, error: 'Consent token is required' });
    return res.status(httpStatus.BAD_REQUEST).send('Consent token is required');
  }
  try {
    const result = await clientService.verifyConsentToken(token);
    if (wantsJson) {
      return res.status(httpStatus.OK).json({
        success: true,
        message: result.message,
        alreadyConsented: result.alreadyConsented,
        client: ClientDTO(result.client),
      });
    }
    const html = `<!DOCTYPE html><html><head><title>Consent Confirmed</title></head><body><h1>✓ Consent Confirmed</h1><p>${result.message}</p></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(httpStatus.OK).send(html);
  } catch (error) {
    if (wantsJson) {
      return res.status(error.statusCode || httpStatus.UNAUTHORIZED).json({ success: false, error: error.message || 'Invalid or expired consent token' });
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(error.statusCode || httpStatus.UNAUTHORIZED).send(error.message || 'Invalid or expired consent token');
  }
});

module.exports = {
  createClient,
  getClients,
  getClient,
  getConversationsByClient,
  updateClient,
  verifyConsent,
  uploadClientAvatar,
  deleteClient,
  assignCaregiver,
  removeCaregiver,
  getClientsByCaregiver,
  getCaregivers,
  getUnassignedClients,
  assignUnassignedClients,
};
