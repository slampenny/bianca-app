const httpStatus = require('http-status');
const mongoose = require('mongoose');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { getAdminObservabilitySnapshot } = require('../services/observability.service');
const { caregiverService, tokenService, alertService, orgService, voiceTelephonyService, conversationService } = require('../services');
const scimService = require('../services/scim.service');
const { AlertDTO, CaregiverDTO, OrgDTO, clientsToDTOsWithLastCall } = require('../dtos');
const { AuditLog, Caregiver, Call, Conversation, Client, Org } = require('../models');
const logger = require('../config/logger');
const embeddingAnchorPhraseService = require('../services/embeddingAnchorPhrase.service');
const corpEmailForwardService = require('../services/corpEmailForward.service');
const breachLogService = require('../services/breachLog.service');
const hipaaBackupService = require('../services/hipaaBackup.service');

function assertSuperAdmin(req) {
  if (req.caregiver.role !== 'superAdmin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Super admin access required');
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function resolveOrgForDto(orgOrCaregiverOrg) {
  let orgForDTO = orgOrCaregiverOrg;
  if (!orgForDTO) {
    return null;
  }
  const isObjectId =
    orgForDTO instanceof mongoose.Types.ObjectId ||
    (orgForDTO.constructor && orgForDTO.constructor.name === 'ObjectId');
  const isString = typeof orgForDTO === 'string';
  const hasOrgProperties = orgForDTO.name !== undefined || orgForDTO.email !== undefined;

  if ((isObjectId || isString) || !hasOrgProperties) {
    const Org = require('../models/org.model');
    const orgId = isObjectId ? orgForDTO : orgForDTO._id || orgForDTO.toString();
    orgForDTO = await Org.findById(orgId);
  }
  return orgForDTO;
}

const getObservability = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  res.send(getAdminObservabilitySnapshot());
});

/**
 * Search caregivers across all orgs (email or name substring). Super admin only.
 */
const searchCaregivers = catchAsync(async (req, res) => {
  assertSuperAdmin(req);

  const q = String(req.query.q || '').trim();
  const limit = parseInt(req.query.limit, 10) || 20;
  const page = parseInt(req.query.page, 10) || 1;

  const or = [
    { email: new RegExp(escapeRegex(q), 'i') },
    { name: new RegExp(escapeRegex(q), 'i') },
  ];
  if (mongoose.Types.ObjectId.isValid(q) && String(new mongoose.Types.ObjectId(q)) === q) {
    or.push({ _id: new mongoose.Types.ObjectId(q) });
  }

  const filter = { $or: or };
  const result = await caregiverService.queryCaregivers(filter, {
    limit,
    page,
    sortBy: req.query.sortBy || 'name:asc',
    populate: 'org',
  });

  const results = (result.results || []).map((c) => {
    const dto = CaregiverDTO(c);
    const org = c.org;
    if (!dto) {
      return null;
    }
    return {
      ...dto,
      id: dto.id != null ? String(dto.id) : undefined,
      orgName: org && typeof org === 'object' && org.name ? org.name : null,
    };
  }).filter(Boolean);

  res.send({ ...result, results });
});

/**
 * Search organizations by name, email, or id (super admin only).
 */
const searchOrgs = catchAsync(async (req, res) => {
  assertSuperAdmin(req);

  const q = String(req.query.q || '').trim();
  const limit = parseInt(req.query.limit, 10) || 20;
  const page = parseInt(req.query.page, 10) || 1;

  const or = [
    { name: new RegExp(escapeRegex(q), 'i') },
    { email: new RegExp(escapeRegex(q), 'i') },
  ];
  if (mongoose.Types.ObjectId.isValid(q) && String(new mongoose.Types.ObjectId(q)) === q) {
    or.push({ _id: new mongoose.Types.ObjectId(q) });
  }

  const filter = { $or: or };
  const result = await orgService.queryOrgs(filter, {
    limit,
    page,
    sortBy: req.query.sortBy || 'name:asc',
  });

  const results = (result.results || [])
    .map((o) => {
      const dto = OrgDTO(o);
      if (!dto) return null;
      return { ...dto, id: dto.id != null ? String(dto.id) : undefined };
    })
    .filter(Boolean);

  res.send({ ...result, results });
});

const getOrgScimStatus = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const status = await scimService.getScimStatusForAdmin(req.params.orgId);
  res.send(status);
});

const issueOrgScimToken = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const out = await scimService.enableOrRotateScimToken(req.params.orgId);
  res.send(out);
});

const disableOrgScim = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  await scimService.disableScim(req.params.orgId);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Email an invitation to complete signup as superAdmin on the admin console.
 */
const sendSuperAdminInvite = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const { name, email, phone } = req.body;
  const inviterId = req.caregiver?.id || req.caregiver?._id || null;
  const { caregiver } = await orgService.sendSuperAdminInvite(name, email, phone, inviterId);
  const dto = CaregiverDTO(caregiver);
  res.status(httpStatus.OK).send({ ...dto, id: dto.id != null ? String(dto.id) : undefined });
});

/**
 * Issue tokens for another caregiver (same payload shape as POST /auth/login). Super admin only.
 */
const impersonate = catchAsync(async (req, res) => {
  assertSuperAdmin(req);

  const { caregiverId } = req.body;
  const sessionCtx = await caregiverService.getCaregiverSessionContextById(caregiverId);
  if (!sessionCtx) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  const { caregiver, clients, org } = sessionCtx;

  if (caregiver.role === 'superAdmin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Cannot impersonate other super administrators');
  }

  if (caregiver.accountLocked) {
    throw new ApiError(httpStatus.FORBIDDEN, 'That account is locked');
  }

  const actingSuperAdminId = req.caregiver._id || req.caregiver.id;
  const targetId = caregiver._id || caregiver.id;

  const alerts = await alertService.getAlerts(targetId);
  const alertDTOs = alerts.map((a) => AlertDTO(a));
  const clientDTOs = await clientsToDTOsWithLastCall(clients);
  const caregiverDTO = CaregiverDTO(caregiver);
  const tokens = await tokenService.generateAuthTokens(caregiver);
  const orgForDTO = await resolveOrgForDto(org || caregiver.org);

  const metadata = new Map();
  metadata.set('targetCaregiverId', String(targetId));
  metadata.set('targetRole', String(caregiver.role || ''));
  metadata.set('actingSuperAdminId', String(actingSuperAdminId));

  await AuditLog.create({
    timestamp: new Date(),
    userId: actingSuperAdminId,
    userRole: 'superAdmin',
    action: 'IMPERSONATION',
    resource: 'caregiver',
    resourceId: String(targetId),
    outcome: 'SUCCESS',
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    metadata,
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: true,
      requiresReview: true,
    },
  });

  logger.warn('[Admin] Super-admin impersonation session issued', {
    actingSuperAdminId: String(actingSuperAdminId),
    targetCaregiverId: String(targetId),
    targetRole: caregiver.role,
  });

  res.send({
    impersonation: true,
    org: orgForDTO ? OrgDTO(orgForDTO) : null,
    caregiver: caregiverDTO,
    clients: clientDTOs,
    alerts: alertDTOs,
    tokens,
  });
});

/**
 * Promote a caregiver to superAdmin or demote a superAdmin to orgAdmin. Super admin only.
 */
const setCaregiverRole = catchAsync(async (req, res) => {
  assertSuperAdmin(req);

  const { caregiverId } = req.params;
  const { role: nextRole } = req.body;
  const actingSuperAdminId = String(req.caregiver._id || req.caregiver.id);

  const existing = await Caregiver.findById(caregiverId);
  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  if (nextRole === 'superAdmin') {
    if (existing.role === 'invited') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot promote invited users to super administrator');
    }
    if (existing.role === 'superAdmin') {
      const dto = CaregiverDTO(existing);
      return res.send({ ...dto, id: dto.id != null ? String(dto.id) : undefined });
    }
  }

  if (nextRole === 'orgAdmin') {
    if (existing.role !== 'superAdmin') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Only super administrators can be demoted to org admin');
    }
    const superAdminCount = await Caregiver.countDocuments({ role: 'superAdmin' });
    if (superAdminCount <= 1) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot demote the last super administrator');
    }
  }

  const updated = await caregiverService.updateCaregiverById(caregiverId, { role: nextRole });

  const metadata = new Map();
  metadata.set('targetCaregiverId', String(caregiverId));
  metadata.set('previousRole', String(existing.role || ''));
  metadata.set('newRole', String(nextRole));
  metadata.set('actingSuperAdminId', actingSuperAdminId);

  await AuditLog.create({
    timestamp: new Date(),
    userId: actingSuperAdminId,
    userRole: 'superAdmin',
    action: 'SUPERADMIN_ROLE_CHANGE',
    resource: 'caregiver',
    resourceId: String(caregiverId),
    outcome: 'SUCCESS',
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    metadata,
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: true,
      requiresReview: true,
    },
  });

  logger.warn('[Admin] Super-admin role change', {
    actingSuperAdminId,
    targetCaregiverId: String(caregiverId),
    previousRole: existing.role,
    newRole: nextRole,
  });

  const dto = CaregiverDTO(updated);
  res.send({ ...dto, id: dto.id != null ? String(dto.id) : undefined });
});

const listEmbeddingAnchorPhrases = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const rows = await embeddingAnchorPhraseService.listPhrases({ detector: req.query.detector });
  res.send(rows);
});

const createEmbeddingAnchorPhrase = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const row = await embeddingAnchorPhraseService.createPhrase(req.body);
  res.status(httpStatus.CREATED).send(row);
});

const updateEmbeddingAnchorPhrase = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const row = await embeddingAnchorPhraseService.updatePhrase(req.params.phraseId, req.body);
  res.send(row);
});

const deleteEmbeddingAnchorPhrase = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const out = await embeddingAnchorPhraseService.deletePhrase(req.params.phraseId);
  res.send(out);
});

const mergeDefaultEmbeddingAnchorPhrases = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const out = await embeddingAnchorPhraseService.mergeMissingFromDefaults();
  res.send(out);
});

const listCorpEmailForwards = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  res.send(await corpEmailForwardService.listStaffForwards());
});

const saveCorpEmailForwards = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const forwards = (req.body.forwards || []).map((row) => ({
    caregiverId: row.caregiverId || null,
    corpEmail: row.corpEmail,
    forwardToEmail: row.forwardToEmail || null,
  }));
  const out = await corpEmailForwardService.saveStaffForwards(forwards, String(req.caregiver._id));
  res.send(out);
});

const getDefaultVoiceOnboardingPlan = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const onboardingPlanService = require('../services/onboardingPlan.service');
  res.status(httpStatus.OK).send({ plan: onboardingPlanService.getDefaultPlanTemplate() });
});

const listBreachLogs = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const result = await breachLogService.listBreachLogs(req.query);
  res.send(result);
});

const getBreachLog = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const breach = await breachLogService.getBreachLogById(req.params.id, req.caregiver, req);
  res.send(breach);
});

const updateBreachLogStatus = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const breach = await breachLogService.updateBreachLogStatus(
    req.params.id,
    req.body,
    req.caregiver,
    req,
  );
  res.send(breach);
});

const listBackups = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const result = await hipaaBackupService.listBackups(req.query);
  res.send(result);
});

const triggerBackup = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const result = await hipaaBackupService.triggerBackup(req.body);

  const metadata = new Map();
  metadata.set('backupType', String(req.body.backupType || 'daily'));
  metadata.set('s3Key', String(result.s3Key || ''));

  await AuditLog.create({
    timestamp: new Date(),
    userId: req.caregiver._id || req.caregiver.id,
    userRole: 'superAdmin',
    action: 'BACKUP',
    resource: 'database',
    resourceId: String(result.backupId || result.s3Key || 'manual-backup'),
    outcome: 'SUCCESS',
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    metadata,
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: true,
      requiresReview: false,
    },
  });

  res.send(result);
});

const restoreBackup = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const { backupKey, confirmRestore } = req.body;
  const result = await hipaaBackupService.restoreBackup({ backupKey, confirmRestore });

  const metadata = new Map();
  metadata.set('backupKey', backupKey);

  await AuditLog.create({
    timestamp: new Date(),
    userId: req.caregiver._id || req.caregiver.id,
    userRole: 'superAdmin',
    action: 'RESTORE',
    resource: 'database',
    resourceId: backupKey,
    outcome: 'SUCCESS',
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    metadata,
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: true,
      requiresReview: true,
    },
  });

  logger.warn('[Admin] Database restore completed via admin portal', {
    backupKey,
    actingSuperAdminId: String(req.caregiver._id || req.caregiver.id),
  });

  res.send(result);
});

const ADMIN_CALLS_ORG_EMAIL = 'admin-calls@internal.bianca';

const placeAdminCall = catchAsync(async (req, res) => {
  assertSuperAdmin(req);
  const { firstName, lastName, phone, country = 'CA' } = req.body;

  // Find or lazily create the admin calls org
  let adminOrg = await Org.findOne({ email: ADMIN_CALLS_ORG_EMAIL });
  if (!adminOrg) {
    adminOrg = await Org.create({
      name: 'Admin Test Calls',
      email: ADMIN_CALLS_ORG_EMAIL,
      timezone: 'America/Los_Angeles',
      country,
    });
    logger.info(`[AdminCall] Created admin calls org: ${adminOrg._id}`);
  }

  // Find or create client by phone within the admin org
  let client = await Client.findOne({ phone, org: adminOrg._id });
  if (!client) {
    client = await Client.create({
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      phone,
      org: adminOrg._id,
    });
    await Org.findByIdAndUpdate(adminOrg._id, { $addToSet: { clients: client._id } });
    logger.info(`[AdminCall] Created client ${client._id} for phone ${phone}`);
  } else if (client.firstName !== firstName || client.lastName !== lastName) {
    client.firstName = firstName;
    client.lastName = lastName;
    client.name = `${firstName} ${lastName}`;
    await client.save();
  }

  const fromNumber = voiceTelephonyService.getFromNumber(country);
  const callSid = await voiceTelephonyService.initiateCall(client.id, fromNumber);

  let call = await Call.findOne({ callSid });
  if (!call) {
    call = await Call.create({
      callSid,
      clientId: client._id,
      startTime: new Date(),
      callStartTime: new Date(),
      callType: 'outbound',
      status: 'initiated',
      callStatus: 'initiating',
    });
  }
  call.status = 'in-progress';
  call.callStatus = 'ringing';
  call.callType = 'outbound';
  await call.save();

  let conversation = await Conversation.findOne({ callId: call._id });
  if (!conversation) {
    conversation = await conversationService.createConversationForClient(client._id, call._id);
    call.conversationId = conversation._id;
    await call.save();
  }

  logger.info(`[AdminCall] Call initiated for ${client.name}, SID: ${callSid}, conversation: ${conversation._id}`);

  res.status(httpStatus.CREATED).send({
    conversationId: conversation._id.toString(),
    callId: call._id.toString(),
    callSid,
    clientId: client._id.toString(),
    clientName: client.name,
    clientPhone: client.phone,
    country,
    fromNumber,
    status: call.status,
    callStatus: call.callStatus,
  });
});

module.exports = {
  getObservability,
  searchCaregivers,
  searchOrgs,
  getOrgScimStatus,
  issueOrgScimToken,
  disableOrgScim,
  sendSuperAdminInvite,
  impersonate,
  setCaregiverRole,
  listEmbeddingAnchorPhrases,
  createEmbeddingAnchorPhrase,
  updateEmbeddingAnchorPhrase,
  deleteEmbeddingAnchorPhrase,
  mergeDefaultEmbeddingAnchorPhrases,
  listCorpEmailForwards,
  saveCorpEmailForwards,
  getDefaultVoiceOnboardingPlan,
  listBreachLogs,
  getBreachLog,
  updateBreachLogStatus,
  listBackups,
  triggerBackup,
  restoreBackup,
  placeAdminCall,
};
