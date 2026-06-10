const httpStatus = require('http-status');
const jwt = require('jsonwebtoken');
const path = require('path');
const pick = require('../utils/pick');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const onboardingService = require('../services/onboarding.service');
const { caregiverService, conversationService, clientService, scheduleService, callService } = require('../services');
const { Client } = require('../models');
const { ConversationDTO, ClientDTO, clientsToDTOsWithLastCall, CallListItemDTO } = require('../dtos');
const { toOrgIdString } = require('../dtos/caregiver.dto');
const {
  toIdString,
  assertCaregiverOrgAccess,
  assertCaregiverClientAccess,
  restrictsClientListingToCaregiverRoster,
} = require('../utils/accessControl');
const {
  logVerificationSucceeded,
  logVerificationFailed,
} = require('../utils/familyDigestVerificationAudit');

/**
 * Staff may access a client's nested data if the client is on their roster, lists them as caregiver,
 * or they have at least one Call with them as caregiverId (stored on Call, not Conversation).
 */
const assertStaffHasClientAccess = async (caregiver, clientId, client, denyMessage) => {
  const caregiverDoc = await caregiverService.getCaregiverById(caregiver._id || caregiver.id);
  if (!caregiverDoc) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Caregiver not found');
  }
  const idStr = clientId.toString();
  const onRoster = (caregiverDoc.clients || []).some((p) => (p._id ? p._id.toString() : p.toString()) === idStr);
  const assignedOnClient =
    Array.isArray(client.caregivers) &&
    client.caregivers.some((c) => (c._id ? c._id.toString() : c.toString()) === caregiver.id.toString());
  if (onRoster || assignedOnClient) {
    return;
  }
  const { Call } = require('../models');
  const callCount = await Call.countDocuments({ clientId, caregiverId: caregiver.id });
  if (callCount === 0) {
    throw new ApiError(httpStatus.FORBIDDEN, denyMessage);
  }
};

const createClient = catchAsync(async (req, res) => {
  const { schedules, ...clientData } = req.body;
  const { file } = req;
  if (file) {
    clientData.avatar = file.path;
  }
  if (!req.caregiver || !req.caregiver.org) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Your caregiver account does not have an organization assigned. Please contact support.'
    );
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
  try {
    await clientService.sendConsentEmailIfRequired(client);
  } catch (err) {
    logger.error('Failed to send consent email after client creation:', err);
  }
  res.status(httpStatus.CREATED).send(ClientDTO(client));
});

const getClients = catchAsync(async (req, res) => {
  const { caregiver } = req;
  // Do not pass `role` from query into the Mongo filter — Client has no `role` field; doing so returns zero rows.
  const filter = pick(req.query, ['name']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  if (caregiver.role !== 'superAdmin') {
    assertCaregiverOrgAccess(caregiver, caregiver.org, 'You do not have access to this organization');
    filter.org = toIdString(caregiver.org);
  }
  if (restrictsClientListingToCaregiverRoster(caregiver)) {
    const caregiverDoc = await caregiverService.getCaregiverById(caregiver._id || caregiver.id);
    const rosterIds = ((caregiverDoc && caregiverDoc.clients) || []).map((c) => toIdString(c)).filter(Boolean);
    filter.$or = [{ caregivers: toIdString(caregiver._id || caregiver.id) }, { _id: { $in: rosterIds } }];
  }
  const result = await clientService.queryClients(filter, options);
  const clientDTOs = await clientsToDTOsWithLastCall(result.results);
  res.status(httpStatus.OK).json({ ...result, results: clientDTOs });
});

const getClientsOnboardingRollups = catchAsync(async (req, res) => {
  const { caregiver } = req;
  const filter = {};
  if (caregiver.role !== 'superAdmin') {
    assertCaregiverOrgAccess(caregiver, caregiver.org, 'You do not have access to this organization');
    filter.org = toIdString(caregiver.org);
  }
  if (restrictsClientListingToCaregiverRoster(caregiver)) {
    const caregiverDoc = await caregiverService.getCaregiverById(caregiver._id || caregiver.id);
    const rosterIds = ((caregiverDoc && caregiverDoc.clients) || []).map((c) => toIdString(c)).filter(Boolean);
    filter.$or = [{ caregivers: toIdString(caregiver._id || caregiver.id) }, { _id: { $in: rosterIds } }];
  }
  const docs = await Client.find(filter).select('_id').lean();
  const ids = docs.map((d) => d._id);
  const rollups = await onboardingService.getJourneyRollupsForClientIds(ids);
  res.status(httpStatus.OK).json({ rollups });
});

const getClient = catchAsync(async (req, res) => {
  const { caregiver } = req;
  const client = await clientService.getClientById(req.params.clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  const caregiverDoc =
    caregiver.role === 'staff' ? await caregiverService.getCaregiverById(caregiver._id || caregiver.id) : null;
  assertCaregiverClientAccess(caregiver, caregiverDoc, client, 'You do not have access to this client');
  const [dto] = await clientsToDTOsWithLastCall([client]);
  res.status(httpStatus.OK).json(dto);
});

const updateClient = catchAsync(async (req, res) => {
  const { schedules, ...clientData } = req.body;
  const { caregiver } = req;
  const existing = await clientService.getClientById(req.params.clientId);
  if (!existing) throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  const caregiverDoc =
    caregiver.role === 'staff' ? await caregiverService.getCaregiverById(caregiver._id || caregiver.id) : null;
  assertCaregiverClientAccess(caregiver, caregiverDoc, existing, 'You do not have access to this client');
  if (clientData.emergencyContact?.familyDigestEmail) {
    if (caregiver.role !== 'orgAdmin' && caregiver.role !== 'superAdmin') {
      delete clientData.emergencyContact.familyDigestEmail;
    } else {
      const { enabled } = clientData.emergencyContact.familyDigestEmail;
      if (enabled === undefined) {
        delete clientData.emergencyContact.familyDigestEmail;
      } else {
        clientData.emergencyContact.familyDigestEmail = { enabled: Boolean(enabled) };
      }
    }
  }
  if (Array.isArray(clientData.familyDigestRecipients)) {
    if (caregiver.role !== 'orgAdmin' && caregiver.role !== 'superAdmin') {
      delete clientData.familyDigestRecipients;
    } else {
      clientData.familyDigestRecipients = clientData.familyDigestRecipients.map((recipient) => {
        if (!recipient?.familyDigestEmail || recipient.familyDigestEmail.enabled === undefined) {
          const { familyDigestEmail, ...rest } = recipient;
          return rest;
        }
        return {
          ...recipient,
          familyDigestEmail: { enabled: Boolean(recipient.familyDigestEmail.enabled) },
        };
      });
    }
  }
  const client = await clientService.updateClientById(req.params.clientId, clientData);
  if (schedules) {
    for (const schedule of schedules) {
      await scheduleService.updateSchedule(schedule.id, { ...schedule });
    }
  }
  if (clientData.email || clientData.consented === undefined) {
    clientService
      .sendConsentEmailIfRequired(client)
      .catch((err) => logger.error('Failed to send consent email after client update:', err));
  }
  res.send(ClientDTO(client));
});

const uploadClientAvatar = catchAsync(async (req, res) => {
  const { caregiver } = req;
  const existing = await clientService.getClientById(req.params.clientId);
  if (!existing) throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  const caregiverDoc =
    caregiver.role === 'staff' ? await caregiverService.getCaregiverById(caregiver._id || caregiver.id) : null;
  assertCaregiverClientAccess(caregiver, caregiverDoc, existing, 'You do not have access to this client');
  const { file } = req;
  if (!file) throw new Error('No file uploaded');
  const filename = path.basename(file.path);
  const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
  const client = await clientService.updateClientById(req.params.clientId, { avatar: avatarUrl });
  res.send(client);
});

const deleteClient = catchAsync(async (req, res) => {
  const { caregiver } = req;
  const existing = await clientService.getClientById(req.params.clientId);
  if (!existing) throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  const caregiverDoc =
    caregiver.role === 'staff' ? await caregiverService.getCaregiverById(caregiver._id || caregiver.id) : null;
  assertCaregiverClientAccess(caregiver, caregiverDoc, existing, 'You do not have access to this client');
  await clientService.deleteClientById(req.params.clientId);
  res.status(httpStatus.NO_CONTENT).send();
});

const assignCaregiver = catchAsync(async (req, res) => {
  const { clientId, caregiverId } = req.params;
  const { caregiver } = req;
  const client = await clientService.getClientById(clientId);
  if (!client) throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  assertCaregiverOrgAccess(caregiver, client.org, 'You do not have access to this client');
  const updatedClient = await clientService.assignCaregiver(caregiverId, clientId);
  res.status(httpStatus.OK).send(ClientDTO(updatedClient));
});

const removeCaregiver = catchAsync(async (req, res) => {
  const { clientId, caregiverId } = req.params;
  const { caregiver } = req;
  const client = await clientService.getClientById(clientId);
  if (!client) throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  assertCaregiverOrgAccess(caregiver, client.org, 'You do not have access to this client');
  const updatedClient = await clientService.removeCaregiver(caregiverId, clientId);
  res.status(httpStatus.OK).send(ClientDTO(updatedClient));
});

const getClientsByCaregiver = catchAsync(async (req, res) => {
  const { caregiverId } = req.params;
  const clients = await caregiverService.getClients(caregiverId);
  if (req.caregiver.role !== 'superAdmin') {
    for (const client of clients) {
      assertCaregiverOrgAccess(req.caregiver, client.org, 'You do not have access to these clients');
    }
  }
  res.status(httpStatus.OK).send(clients);
});

const formatOnboardingResponseRow = (r) => ({
  id: r._id ? r._id.toString() : undefined,
  clientId: r.clientId ? r.clientId.toString() : undefined,
  dayNumber: r.dayNumber,
  questionId: r.questionId,
  responseType: r.responseType,
  responseValue: r.responseValue,
  verbatimTranscript: r.verbatimTranscript,
  callId: r.callId ? r.callId.toString() : undefined,
  conversationId: r.conversationId ? r.conversationId.toString() : undefined,
  capturedAt: r.capturedAt,
  safety_flag: !!r.safety_flag,
  memory_flag: !!r.memory_flag,
  mood_flag: !!r.mood_flag,
  distress_flag: !!r.distress_flag,
  confusion_flag: !!r.confusion_flag,
  notes: r.notes,
});

const getClientOnboarding = catchAsync(async (req, res) => {
  const { clientId } = req.params;
  const dayRaw = req.query.day;
  const dayNumber =
    dayRaw !== undefined && dayRaw !== '' && !Number.isNaN(Number(dayRaw)) ? parseInt(String(dayRaw), 10) : undefined;

  const { caregiver } = req;
  const client = await clientService.getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  if (caregiver.role === 'staff') {
    await assertStaffHasClientAccess(caregiver, clientId, client, "You do not have access to this client's onboarding data");
  } else if (caregiver.role === 'orgAdmin') {
    const clientOrgId = toOrgIdString(client.org);
    const caregiverOrgId = toOrgIdString(caregiver.org);
    if (clientOrgId && caregiverOrgId && clientOrgId !== caregiverOrgId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You do not have access to this client's onboarding data");
    }
  }

  const payload = await onboardingService.getDashboardForClient(clientId, {
    dayNumber: dayNumber >= 1 ? dayNumber : undefined,
  });

  res.status(httpStatus.OK).send({
    journey: payload.journey,
    responses: payload.responses.map(formatOnboardingResponseRow),
    flags: payload.flags,
    questionCount: payload.questionCount,
  });
});

const getConversationsByClient = catchAsync(async (req, res) => {
  const { clientId } = req.params;
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const { caregiver } = req;
  const client = await clientService.getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid client ID');
  }
  if (caregiver.role === 'staff') {
    await assertStaffHasClientAccess(caregiver, clientId, client, "You do not have access to this client's conversations");
  } else if (caregiver.role === 'orgAdmin') {
    const clientOrgId = toOrgIdString(client.org);
    const caregiverOrgId = toOrgIdString(caregiver.org);
    if (clientOrgId && caregiverOrgId && clientOrgId !== caregiverOrgId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You do not have access to this client's conversations");
    }
  }
  if (!options.sortBy) options.sortBy = 'createdAt:desc';
  const result = await conversationService.queryConversationsByClient(clientId, options);
  const transformedResults = [];
  for (const conversation of result.results) {
    try {
      if (!conversation._id && !conversation.id) continue;
      transformedResults.push(ConversationDTO(conversation));
    } catch (error) {
      logger.error('[ClientController] Error transforming conversation with DTO', {
        error: error.message,
        conversationId: conversation?._id?.toString?.() ?? conversation?.id,
        clientId,
      });
    }
  }
  const dropped = (result.results?.length ?? 0) - transformedResults.length;
  if (dropped > 0) {
    logger.warn(
      `[ClientController] Dropped ${dropped} conversation(s) for client ${clientId} due to DTO errors (check logs above).`
    );
  }
  res.status(httpStatus.OK).send({ ...result, results: transformedResults });
});

/**
 * List calls for a client (newest first), with conversation + messages when present.
 * Preferred for facility “conversation history” so ordering matches billable Call.startTime.
 */
const getCallsByClient = catchAsync(async (req, res) => {
  const { clientId } = req.params;
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const { caregiver } = req;
  const client = await clientService.getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid client ID');
  }
  if (caregiver.role === 'staff') {
    await assertStaffHasClientAccess(caregiver, clientId, client, "You do not have access to this client's calls");
  } else if (caregiver.role === 'orgAdmin') {
    const clientOrgId = toOrgIdString(client.org);
    const caregiverOrgId = toOrgIdString(caregiver.org);
    if (clientOrgId && caregiverOrgId && clientOrgId !== caregiverOrgId) {
      throw new ApiError(httpStatus.FORBIDDEN, "You do not have access to this client's calls");
    }
  }
  const result = await callService.queryCallsByClient(clientId, options);
  const transformedResults = [];
  for (const call of result.results) {
    try {
      if (!call._id && !call.id) continue;
      transformedResults.push(CallListItemDTO(call));
    } catch (error) {
      logger.error('[ClientController] Error transforming call list item', {
        error: error.message,
        callId: call?._id?.toString?.() ?? call?.id,
        clientId,
      });
    }
  }
  res.status(httpStatus.OK).send({ ...result, results: transformedResults });
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
  const clients = await clientService.getUnassignedClients(req.caregiver);
  res.status(httpStatus.OK).send(clients.map((c) => ClientDTO(c)));
});

const assignUnassignedClients = catchAsync(async (req, res) => {
  const { caregiverId, clientIds } = req.body;
  const clients = await clientService.assignUnassignedClients(caregiverId, clientIds, req.caregiver);
  res.status(httpStatus.OK).send(clients.map((c) => ClientDTO(c)));
});

const verifyConsent = catchAsync(async (req, res) => {
  const wantsJson = (req.headers.accept && req.headers.accept.includes('application/json')) || req.query.format === 'json';
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
      return res
        .status(error.statusCode || httpStatus.UNAUTHORIZED)
        .json({ success: false, error: error.message || 'Invalid or expired consent token' });
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(error.statusCode || httpStatus.UNAUTHORIZED).send(error.message || 'Invalid or expired consent token');
  }
});

const sendFamilyDigestEmailVerification = catchAsync(async (req, res) => {
  const result = await clientService.sendFamilyDigestEmailVerification(
    req.caregiver,
    req.params.clientId,
    req.body?.recipientId
  );
  res.status(httpStatus.OK).send(result);
});

const verifyFamilyDigestEmail = catchAsync(async (req, res) => {
  const wantsJson = (req.headers.accept && req.headers.accept.includes('application/json')) || req.query.format === 'json';
  const token = req.query.token || req.body.token;
  if (!token) {
    await logVerificationFailed(null, req, 'Verification token is required', httpStatus.BAD_REQUEST);
    if (wantsJson) {
      return res.status(httpStatus.BAD_REQUEST).json({ success: false, error: 'Verification token is required' });
    }
    return res.status(httpStatus.BAD_REQUEST).send('Verification token is required');
  }
  try {
    const result = await clientService.verifyFamilyDigestEmailToken(token);
    const clientId = result.client?.id || result.client?._id;
    await logVerificationSucceeded(clientId, req, { alreadyVerified: result.alreadyVerified });
    if (wantsJson) {
      return res.status(httpStatus.OK).json({
        success: true,
        message: result.message,
        alreadyVerified: result.alreadyVerified,
      });
    }
    const html = `<!DOCTYPE html><html><head><title>Email verified</title></head><body><h1>✓ Email verified</h1><p>${result.message}</p></body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(httpStatus.OK).send(html);
  } catch (error) {
    let clientId = error.clientId || null;
    if (!clientId && token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded?.sub) clientId = decoded.sub;
      } catch {
        // ignore decode errors — audit uses unknown resourceId
      }
    }
    await logVerificationFailed(clientId, req, error.message || 'Invalid or expired verification token', error.statusCode || httpStatus.UNAUTHORIZED);
    if (wantsJson) {
      return res
        .status(error.statusCode || httpStatus.UNAUTHORIZED)
        .json({ success: false, error: error.message || 'Invalid or expired verification token' });
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(error.statusCode || httpStatus.UNAUTHORIZED).send(error.message || 'Invalid or expired verification token');
  }
});

module.exports = {
  createClient,
  getClients,
  getClientsOnboardingRollups,
  getClient,
  getClientOnboarding,
  getConversationsByClient,
  getCallsByClient,
  updateClient,
  verifyConsent,
  sendFamilyDigestEmailVerification,
  verifyFamilyDigestEmail,
  uploadClientAvatar,
  deleteClient,
  assignCaregiver,
  removeCaregiver,
  getClientsByCaregiver,
  getCaregivers,
  getUnassignedClients,
  assignUnassignedClients,
};
