const httpStatus = require('http-status');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const { AuditLog, BreachLog, Caregiver, Org } = require('../models');
const { BreachLogDetailDTO, BreachLogSummaryDTO } = require('../dtos/breachLog.dto');
const { getJurisdiction } = require('../utils/jurisdiction.utils');

const STATUSES_REQUIRING_NOTES = new Set(['FALSE_POSITIVE', 'BREACH_CONFIRMED', 'CLOSED']);

const ALLOWED_STATUSES = new Set([
  'INVESTIGATING',
  'FALSE_POSITIVE',
  'SECURITY_EVENT_CONFIRMED',
  'BREACH_CONFIRMED',
  'CLOSED',
]);

const RESOLUTION_REASONS = new Set([
  'timezone_false_positive',
  'legitimate_access',
  'detector_bug',
  'user_error',
  'confirmed_unauthorized_access',
  'confirmed_breach',
  'other',
]);

const JURISDICTION_COUNTRY_MAP = {
  HIPAA: ['US'],
  PIPEDA: ['CA'],
};

function buildListFilter(query) {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }
  if (query.type) {
    filter.type = query.type;
  }
  if (query.severity) {
    filter.severity = query.severity;
  }
  if (query.userId) {
    filter.userId = new mongoose.Types.ObjectId(query.userId);
  }
  if (query.orgId) {
    filter.orgId = new mongoose.Types.ObjectId(query.orgId);
  }
  if (query.jurisdiction) {
    const jurisdiction = String(query.jurisdiction).toUpperCase();
    if (jurisdiction === 'OTHER') {
      filter.organizationCountry = { $nin: ['US', 'CA'] };
    } else if (JURISDICTION_COUNTRY_MAP[jurisdiction]) {
      filter.organizationCountry = { $in: JURISDICTION_COUNTRY_MAP[jurisdiction] };
    }
  }
  if (query.startDate || query.endDate) {
    filter.detectedAt = {};
    if (query.startDate) filter.detectedAt.$gte = new Date(query.startDate);
    if (query.endDate) filter.detectedAt.$lte = new Date(query.endDate);
  }

  return filter;
}

async function resolveOrgForBreach(breachDoc) {
  if (breachDoc.orgId && typeof breachDoc.orgId === 'object' && breachDoc.orgId.name) {
    return breachDoc.orgId;
  }
  if (breachDoc.orgId) {
    return Org.findById(breachDoc.orgId).select('name timezone country');
  }
  if (breachDoc.userId?.org) {
    if (typeof breachDoc.userId.org === 'object' && breachDoc.userId.org.name) {
      return breachDoc.userId.org;
    }
    return Org.findById(breachDoc.userId.org).select('name timezone country');
  }
  return null;
}

async function writeBreachAuditLog({
  adminUser,
  breachId,
  action,
  outcome,
  req,
  metadata = {},
}) {
  await AuditLog.createLog({
    timestamp: new Date(),
    userId: adminUser._id,
    userRole: adminUser.role,
    action,
    resource: 'breachLog',
    resourceId: breachId.toString(),
    outcome,
    ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('user-agent'),
    requestMethod: req.method,
    requestPath: req.originalUrl || req.path,
    statusCode: outcome === 'SUCCESS' ? 200 : 400,
    metadata,
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: action === 'BREACH_CONFIRMED' || action === 'SECURITY_EVENT_CONFIRMED',
      requiresReview: false,
    },
  });
}

function auditActionForStatus(status) {
  if (status === 'FALSE_POSITIVE') return 'BREACH_FALSE_POSITIVE_MARKED';
  if (status === 'BREACH_CONFIRMED') return 'BREACH_CONFIRMED';
  if (status === 'SECURITY_EVENT_CONFIRMED') return 'SECURITY_EVENT_CONFIRMED';
  return 'BREACH_LOG_STATUS_UPDATE';
}

const listBreachLogs = async (query) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = Math.min(parseInt(query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;
  const filter = buildListFilter(query);

  const [results, totalResults] = await Promise.all([
    BreachLog.find(filter)
      .sort({ detectedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'userId',
        select: 'name email role org',
        populate: { path: 'org', select: 'name timezone country' },
      })
      .populate('orgId', 'name timezone country')
      .exec(),
    BreachLog.countDocuments(filter),
  ]);

  return {
    results: results.map((breach) => BreachLogSummaryDTO(breach)),
    page,
    limit,
    totalResults,
    totalPages: Math.ceil(totalResults / limit) || 1,
  };
};

const loadBreachLogDetail = async (breachId) => {
  const breach = await BreachLog.findById(breachId)
    .populate({
      path: 'userId',
      select: 'name email role org',
      populate: { path: 'org', select: 'name timezone country' },
    })
    .populate('orgId', 'name timezone country')
    .populate('resolvedBy', 'name email')
    .populate('statusHistory.changedBy', 'name email')
    .exec();

  if (!breach) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Breach log not found');
  }

  const org = await resolveOrgForBreach(breach);

  const relatedAuditLogs = breach.userId
    ? await AuditLog.find({
      userId: breach.userId._id || breach.userId,
      timestamp: {
        $gte: new Date(breach.detectedAt.getTime() - 15 * 60 * 1000),
        $lte: new Date(breach.detectedAt.getTime() + 15 * 60 * 1000),
      },
    })
      .sort({ timestamp: -1 })
      .limit(50)
      .exec()
    : [];

  return BreachLogDetailDTO(breach, { org, relatedAuditLogs });
};

const getBreachLogById = async (breachId, adminUser, req) => {
  const detail = await loadBreachLogDetail(breachId);

  await writeBreachAuditLog({
    adminUser,
    breachId,
    action: 'BREACH_LOG_READ',
    outcome: 'SUCCESS',
    req,
    metadata: {
      status: detail.status,
      type: detail.type,
    },
  });

  return detail;
};

const updateBreachLogStatus = async (breachId, body, adminUser, req) => {
  const breach = await BreachLog.findById(breachId);
  if (!breach) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Breach log not found');
  }

  const { status, resolutionNotes, resolutionReason } = body;

  if (!ALLOWED_STATUSES.has(status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid breach log status');
  }

  if (resolutionReason && !RESOLUTION_REASONS.has(resolutionReason)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid resolution reason');
  }

  const notes = resolutionNotes != null ? String(resolutionNotes).trim() : '';
  if (STATUSES_REQUIRING_NOTES.has(status) && !notes) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'resolutionNotes is required for this status');
  }

  const previousStatus = breach.status;
  const previousNotes = breach.resolutionNotes || '';
  const now = new Date();
  const closingStatuses = new Set(['FALSE_POSITIVE', 'BREACH_CONFIRMED', 'SECURITY_EVENT_CONFIRMED', 'CLOSED']);

  breach.status = status;
  if (notes) {
    breach.resolutionNotes = notes;
  }
  if (resolutionReason) {
    breach.resolutionReason = resolutionReason;
  }

  if (closingStatuses.has(status)) {
    breach.resolvedAt = now;
    breach.resolvedBy = adminUser._id;
  } else if (status === 'INVESTIGATING') {
    breach.resolvedAt = undefined;
    breach.resolvedBy = undefined;
  }

  breach.statusHistory = breach.statusHistory || [];
  breach.statusHistory.push({
    status,
    changedAt: now,
    changedBy: adminUser._id,
    notes: notes || undefined,
    resolutionReason: resolutionReason || undefined,
  });

  await breach.save();

  const auditAction = auditActionForStatus(status);
  await writeBreachAuditLog({
    adminUser,
    breachId: breach._id,
    action: auditAction,
    outcome: 'SUCCESS',
    req,
    metadata: {
      previousStatus,
      newStatus: status,
      resolutionReason: resolutionReason || '',
      notesChanged: notes !== previousNotes ? 'true' : 'false',
      jurisdiction: getJurisdiction(breach.organizationCountry).jurisdiction,
    },
  });

  return loadBreachLogDetail(breachId);
};

module.exports = {
  listBreachLogs,
  getBreachLogById,
  updateBreachLogStatus,
  STATUSES_REQUIRING_NOTES,
  ALLOWED_STATUSES,
  RESOLUTION_REASONS,
};
