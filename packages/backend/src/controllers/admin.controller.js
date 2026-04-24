const httpStatus = require('http-status');
const mongoose = require('mongoose');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { getAdminObservabilitySnapshot } = require('../services/observability.service');
const { caregiverService, tokenService, alertService, orgService } = require('../services');
const scimService = require('../services/scim.service');
const { AlertDTO, CaregiverDTO, OrgDTO, clientsToDTOsWithLastCall } = require('../dtos');
const { AuditLog, Caregiver } = require('../models');
const logger = require('../config/logger');
const embeddingAnchorPhraseService = require('../services/embeddingAnchorPhrase.service');

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
};
