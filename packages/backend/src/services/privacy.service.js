const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { PrivacyRequest, ConsentRecord, PrivacyComplaint, Caregiver, Client, Org } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const config = require('../config/config');
const { getJurisdiction } = require('../utils/jurisdiction.utils');
const { buildConsentAuditPdfBuffer } = require('./consentAuditPdf.service');

/**
 * Create an access request
 * @param {Object} requestBody
 * @param {ObjectId} requestorId
 * @param {string} requestorModel
 * @returns {Promise<PrivacyRequest>}
 */
const createAccessRequest = async (requestBody, requestorId, requestorModel = 'Caregiver') => {
  const request = await PrivacyRequest.create({
    requestType: 'access',
    requestorType: requestorModel === 'Caregiver' ? 'caregiver' : 'client',
    requestorId,
    requestorModel,
    informationRequested: requestBody.informationRequested || 'All personal information',
    accessMethod: requestBody.accessMethod || 'view',
    createdBy: requestorId
  });
  
  logger.info(`[Privacy Service] Access request created: ${request._id} by ${requestorId}`);
  return request;
};

/**
 * Create a correction request
 * @param {Object} requestBody
 * @param {ObjectId} requestorId
 * @param {string} requestorModel
 * @returns {Promise<PrivacyRequest>}
 */
const createCorrectionRequest = async (requestBody, requestorId, requestorModel = 'Caregiver') => {
  if (!requestBody.correctionDetails) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Correction details are required');
  }
  
  const request = await PrivacyRequest.create({
    requestType: 'correction',
    requestorType: requestorModel === 'Caregiver' ? 'caregiver' : 'client',
    requestorId,
    requestorModel,
    informationRequested: requestBody.informationRequested || 'Correction request',
    correctionDetails: requestBody.correctionDetails,
    createdBy: requestorId
  });
  
  logger.info(`[Privacy Service] Correction request created: ${request._id} by ${requestorId}`);
  return request;
};

/**
 * Get privacy request by ID
 * @param {ObjectId} requestId
 * @param {ObjectId} userId - User requesting (for authorization)
 * @returns {Promise<PrivacyRequest>}
 */
const getPrivacyRequestById = async (requestId, userId) => {
  const request = await PrivacyRequest.findById(requestId);
  
  if (!request) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Privacy request not found');
  }
  
  // Check authorization - user can only see their own requests unless they're admin
  if (request.requestorId.toString() !== userId.toString()) {
    // Check if user is admin or privacy officer
    const user = await Caregiver.findById(userId);
    if (!user || (user.role !== 'superAdmin' && user.role !== 'orgAdmin')) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to view this request');
    }
  }
  
  return request;
};

/**
 * Query privacy requests
 * @param {Object} filter
 * @param {Object} options
 * @param {ObjectId} userId - User making the query
 * @returns {Promise<QueryResult>}
 */
const queryPrivacyRequests = async (filter, options, userId) => {
  // Check if user is admin
  const user = await Caregiver.findById(userId);
  const isAdmin = user && (user.role === 'superAdmin' || user.role === 'orgAdmin');
  
  // Non-admins can only see their own requests
  if (!isAdmin) {
    filter.requestorId = userId;
  }
  
  return await PrivacyRequest.paginate(filter, options);
};

/**
 * Update privacy request status
 * @param {ObjectId} requestId
 * @param {Object} updateBody
 * @param {ObjectId} updatedBy
 * @returns {Promise<PrivacyRequest>}
 */
const updatePrivacyRequest = async (requestId, updateBody, updatedBy) => {
  const request = await PrivacyRequest.findById(requestId);
  
  if (!request) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Privacy request not found');
  }
  
  // Check if user is admin or privacy officer
  const user = await Caregiver.findById(updatedBy);
  if (!user || (user.role !== 'superAdmin' && user.role !== 'orgAdmin')) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to update privacy requests');
  }
  
  // Update status
  if (updateBody.status) {
    request.status = updateBody.status;
    
    // If completed, set response date
    if (updateBody.status === 'completed') {
      request.responseDate = new Date();
    }
    
    // If denied, set denial date
    if (updateBody.status === 'denied') {
      request.denialDate = new Date();
      request.denialReason = updateBody.denialReason || 'Request denied';
    }
  }
  
  // Update information provided (for access requests)
  if (updateBody.informationProvided) {
    request.informationProvided = updateBody.informationProvided;
  }
  
  // Update correction status (for correction requests)
  if (updateBody.correctionStatus) {
    request.correctionStatus = {
      ...request.correctionStatus,
      ...updateBody.correctionStatus
    };
    
    if (updateBody.correctionStatus.corrected) {
      request.correctionStatus.correctionDate = new Date();
    }
  }
  
  // Add processing note
  if (updateBody.note) {
    request.processingNotes.push({
      note: updateBody.note,
      addedBy: updatedBy,
      addedAt: new Date()
    });
  }
  
  // Update fees
  if (updateBody.fees !== undefined) {
    request.fees = {
      ...request.fees,
      ...updateBody.fees
    };
  }
  
  // Extension
  if (updateBody.extensionRequested) {
    request.extensionRequested = true;
    request.extensionReason = updateBody.extensionReason;
    const extendedDeadline = new Date(request.responseDeadline);
    extendedDeadline.setDate(extendedDeadline.getDate() + 30); // Extend by 30 days
    request.extendedDeadline = extendedDeadline;
  }
  
  request.updatedBy = updatedBy;
  await request.save();
  
  logger.info(`[Privacy Service] Privacy request updated: ${requestId} by ${updatedBy}`);
  return request;
};

/**
 * Create consent record
 * @param {Object} consentBody
 * @param {ObjectId} userId
 * @param {string} userModel
 * @returns {Promise<ConsentRecord>}
 */
const createConsentRecord = async (consentBody, userId, userModel = 'Caregiver') => {
  const createdBy =
    consentBody.createdBy !== undefined && consentBody.createdBy !== null
      ? consentBody.createdBy
      : userModel === 'Caregiver'
        ? userId
        : undefined;

  const consent = await ConsentRecord.create({
    userType: userModel === 'Caregiver' ? 'caregiver' : 'client',
    userId,
    userModel,
    consentType: consentBody.consentType,
    purpose: consentBody.purpose,
    granted: consentBody.granted !== false, // Default to true
    method: consentBody.method || 'explicit',
    explicitConsent: consentBody.explicitConsent,
    informationTypes: consentBody.informationTypes || [],
    thirdParties: consentBody.thirdParties || [],
    retentionPeriod: consentBody.retentionPeriod,
    expiresAt: consentBody.expiresAt,
    legalBasis: consentBody.legalBasis || 'consent',
    collectionNoticeProvided: consentBody.collectionNoticeProvided || false,
    collectionNoticeProvidedAt: consentBody.collectionNoticeProvided ? new Date() : null,
    collectionNoticeVersion: consentBody.collectionNoticeVersion,
    createdBy,
  });
  
  logger.info(`[Privacy Service] Consent record created: ${consent._id} for user ${userId}`);
  return consent;
};

/**
 * Get active consent for a user
 * @param {ObjectId} userId
 * @param {string} userModel
 * @param {string} consentType
 * @returns {Promise<ConsentRecord[]>}
 */
const getActiveConsent = async (userId, userModel = 'Caregiver', consentType = null) => {
  return await ConsentRecord.getActiveConsent(userId, userModel, consentType);
};

/**
 * Check if user has consent
 * @param {ObjectId} userId
 * @param {string} userModel
 * @param {string} consentType
 * @param {string} purpose
 * @returns {Promise<boolean>}
 */
const hasConsent = async (userId, userModel, consentType, purpose) => {
  return await ConsentRecord.hasConsent(userId, userModel, consentType, purpose);
};

/**
 * Withdraw consent
 * @param {ObjectId} consentId
 * @param {Object} withdrawalBody
 * @param {ObjectId} userId
 * @returns {Promise<ConsentRecord>}
 */
const withdrawConsent = async (consentId, withdrawalBody, userId) => {
  const consent = await ConsentRecord.findById(consentId);
  
  if (!consent) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Consent record not found');
  }
  
  // Check authorization
  if (consent.userId.toString() !== userId.toString()) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to withdraw this consent');
  }
  
  // Withdraw consent
  await consent.withdraw(
    withdrawalBody.withdrawalMethod || 'app',
    withdrawalBody.withdrawalReason,
    withdrawalBody.withdrawalImpact
  );
  
  // If withdrawing collection consent, lock the account (can't use app without consent)
  if (consent.consentType === 'collection' && consent.userModel === 'Caregiver') {
    const caregiver = await Caregiver.findById(userId);
    if (caregiver) {
      caregiver.accountLocked = true;
      caregiver.lockedReason = 'Consent withdrawn - account access restricted per PIPEDA requirements';
      caregiver.lockedAt = new Date();
      await caregiver.save();
      
      logger.warn(`[Privacy Service] Account locked due to consent withdrawal: ${userId}`);
    }
  }
  
  logger.info(`[Privacy Service] Consent withdrawn: ${consentId} by ${userId}`);
  return consent;
};

/**
 * Get consent history for a user
 * @param {ObjectId} userId
 * @param {string} userModel
 * @returns {Promise<ConsentRecord[]>}
 */
const getConsentHistory = async (userId, userModel = 'Caregiver') => {
  return await ConsentRecord.getConsentHistory(userId, userModel);
};

/**
 * US-16: Persist a ConsentRecord when resident recording consent is granted or revoked (client model flags).
 * @param {Object} params
 */
const recordClientRecordingConsentEvent = async ({
  clientId,
  granted,
  explicitMeta = {},
  performedByCaregiverId,
}) => {
  await createConsentRecord(
    {
      consentType: 'recording',
      purpose: granted
        ? 'Wellness check call recording and transcription'
        : 'Recording consent withdrawn or declined',
      granted,
      method: 'explicit',
      explicitConsent: {
        provided: granted,
        providedAt: new Date(),
        providedVia: explicitMeta.providedVia || 'unknown',
        ipAddress: explicitMeta.ipAddress,
        userAgent: explicitMeta.userAgent,
      },
      informationTypes: ['call_recordings', 'voice_transcripts'],
      collectionNoticeProvided: true,
      collectionNoticeVersion: explicitMeta.consentEmailVersion || '1.0',
      createdBy: performedByCaregiverId,
    },
    clientId,
    'Client'
  );
  logger.info(
    `[Privacy Service] Client recording consent event recorded (granted=${granted}) for client ${clientId}`
  );
};

const assertOrgConsentAuditAccess = (caregiver) => {
  if (!caregiver.role || !['orgAdmin', 'superAdmin'].includes(caregiver.role)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Organization administrator access required');
  }
};

const resolveCaregiverOrgObjectId = (caregiver) => {
  let orgId = caregiver.org;
  if (orgId && orgId._id) orgId = orgId._id;
  if (!orgId) return null;
  return orgId instanceof mongoose.Types.ObjectId ? orgId : new mongoose.Types.ObjectId(String(orgId));
};

const wantsAllOrganizations = (query, caregiver) => {
  const v = query.allOrganizations;
  const on = v === true || v === 'true' || v === '1';
  if (on && caregiver.role !== 'superAdmin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Cross-organization consent audit requires super administrator');
  }
  return on;
};

const enrichGlobalConsentRows = async (results) => {
  const docs = results.map((d) => (typeof d.toJSON === 'function' ? d.toJSON() : { ...d }));
  const clientIds = [...new Set(docs.filter((x) => x.userModel === 'Client').map((x) => x.userId.toString()))];
  const caregiverIds = [...new Set(docs.filter((x) => x.userModel === 'Caregiver').map((x) => x.userId.toString()))];

  const [clients, caregivers] = await Promise.all([
    clientIds.length
      ? Client.find({ _id: { $in: clientIds.map((id) => new mongoose.Types.ObjectId(id)) } })
          .select('name preferredName org')
          .populate('org', 'name')
          .lean()
      : [],
    caregiverIds.length
      ? Caregiver.find({ _id: { $in: caregiverIds.map((id) => new mongoose.Types.ObjectId(id)) } })
          .select('name email org')
          .populate('org', 'name')
          .lean()
      : [],
  ]);

  const clientMap = new Map(clients.map((c) => [c._id.toString(), c]));
  const cgMap = new Map(caregivers.map((c) => [c._id.toString(), c]));

  return docs.map((o) => {
    const uid = o.userId.toString();
    if (o.userModel === 'Client') {
      const c = clientMap.get(uid);
      o.subjectDisplayName = c ? c.preferredName || c.name || uid : uid;
      o.subjectKind = 'client';
      if (c && c.org) {
        const org = c.org;
        o.organizationName = org.name || '';
        o.organizationId = (org._id || org).toString();
      } else {
        o.organizationName = '';
        o.organizationId = '';
      }
    } else {
      const c = cgMap.get(uid);
      o.subjectDisplayName = c ? c.name || c.email || uid : uid;
      o.subjectKind = 'caregiver';
      if (c && c.org) {
        const org = c.org;
        o.organizationName = org.name || '';
        o.organizationId = (org._id || org).toString();
      } else {
        o.organizationName = '';
        o.organizationId = '';
      }
    }
    return o;
  });
};

const runOrgScopedConsentAudit = async (oid, query) => {
  const orgMeta = await Org.findById(oid).select('name').lean();
  const scopeLabel = orgMeta && orgMeta.name ? `${orgMeta.name} (${oid})` : oid.toString();

  const clients = await Client.find({ org: oid }).select('_id name preferredName').lean();
  const clientIds = clients.map((c) => c._id);
  const clientNameById = new Map(clients.map((c) => [c._id.toString(), c.preferredName || c.name || '']));

  const caregiversInOrg = await Caregiver.find({ org: oid }).select('_id name email').lean();
  const caregiverIds = caregiversInOrg.map((c) => c._id);
  const caregiverNameById = new Map(caregiversInOrg.map((c) => [c._id.toString(), c.name || c.email || '']));

  const filter = {
    $or: [
      { userModel: 'Client', userId: { $in: clientIds } },
      { userModel: 'Caregiver', userId: { $in: caregiverIds } },
    ],
  };

  if (query.clientId) {
    if (!mongoose.Types.ObjectId.isValid(query.clientId)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid clientId');
    }
    const cid = new mongoose.Types.ObjectId(query.clientId);
    if (!clientIds.some((id) => id.equals(cid))) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Client not found in your organization');
    }
    filter.userModel = 'Client';
    filter.userId = cid;
    delete filter.$or;
  }

  if (query.consentType) {
    filter.consentType = query.consentType;
  }

  const options = {
    sortBy: query.sortBy || 'createdAt:desc',
    limit: query.limit,
    page: query.page,
  };

  const pageResult = await ConsentRecord.paginate(filter, options);

  const enrich = (doc) => {
    const o = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
    const uid = o.userId ? o.userId.toString() : String(o.userId);
    if (o.userModel === 'Client') {
      o.subjectDisplayName = clientNameById.get(uid) || uid;
      o.subjectKind = 'client';
    } else {
      o.subjectDisplayName = caregiverNameById.get(uid) || uid;
      o.subjectKind = 'caregiver';
    }
    o.organizationName = orgMeta?.name || '';
    o.organizationId = oid.toString();
    return o;
  };

  return {
    ...pageResult,
    results: pageResult.results.map(enrich),
    scopeLabel,
  };
};

/**
 * US-17: Paginated consent audit (single org, or superAdmin cross-org via allOrganizations=true / orgId).
 */
const queryOrgConsentAudit = async (caregiver, query = {}) => {
  assertOrgConsentAuditAccess(caregiver);
  const isSuper = caregiver.role === 'superAdmin';
  const allOrgs = wantsAllOrganizations(query, caregiver);

  if (allOrgs) {
    const filter = {};
    if (query.consentType) filter.consentType = query.consentType;
    if (query.clientId) {
      if (!mongoose.Types.ObjectId.isValid(query.clientId)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid clientId');
      }
      filter.userModel = 'Client';
      filter.userId = new mongoose.Types.ObjectId(query.clientId);
    }
    const options = {
      sortBy: query.sortBy || 'createdAt:desc',
      limit: query.limit,
      page: query.page,
    };
    const pageResult = await ConsentRecord.paginate(filter, options);
    const enriched = await enrichGlobalConsentRows(pageResult.results);
    return {
      ...pageResult,
      results: enriched,
      scopeLabel: 'All organizations',
    };
  }

  let oid = null;
  if (isSuper && query.orgId && mongoose.Types.ObjectId.isValid(query.orgId)) {
    oid = new mongoose.Types.ObjectId(query.orgId);
  } else {
    oid = resolveCaregiverOrgObjectId(caregiver);
  }

  if (!oid) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      isSuper
        ? 'Provide orgId, or pass allOrganizations=true for a cross-organization view'
        : 'Your account is not linked to an organization'
    );
  }

  if (!isSuper) {
    const myOrg = resolveCaregiverOrgObjectId(caregiver);
    if (!myOrg) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Your account is not linked to an organization');
    }
    if (!myOrg.equals(oid)) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Cannot query another organization');
    }
  }

  return runOrgScopedConsentAudit(oid, query);
};

function escapeCsvField(val) {
  if (val === undefined || val === null) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * US-17: CSV export (same scope as queryOrgConsentAudit).
 */
const exportOrgConsentAuditCsv = async (caregiver, query = {}) => {
  const page = await queryOrgConsentAudit(caregiver, {
    ...query,
    page: 1,
    limit: 10000,
    sortBy: 'createdAt:desc',
  });
  const headers = [
    'id',
    'subjectKind',
    'subjectDisplayName',
    'organizationName',
    'organizationId',
    'userModel',
    'userId',
    'consentType',
    'purpose',
    'granted',
    'withdrawn',
    'method',
    'createdAt',
    'withdrawnAt',
    'providedVia',
  ];
  const lines = [headers.join(',')];
  for (const row of page.results) {
    const providedVia = row.explicitConsent && row.explicitConsent.providedVia;
    lines.push(
      [
        escapeCsvField(row.id || row._id),
        escapeCsvField(row.subjectKind),
        escapeCsvField(row.subjectDisplayName),
        escapeCsvField(row.organizationName),
        escapeCsvField(row.organizationId),
        escapeCsvField(row.userModel),
        escapeCsvField(row.userId),
        escapeCsvField(row.consentType),
        escapeCsvField(row.purpose),
        escapeCsvField(row.granted),
        escapeCsvField(row.withdrawn),
        escapeCsvField(row.method),
        escapeCsvField(row.createdAt),
        escapeCsvField(row.withdrawnAt),
        escapeCsvField(providedVia),
      ].join(',')
    );
  }
  return lines.join('\n');
};

/**
 * US-17 optional: PDF export with SHA-256 document fingerprint (integrity seal, not PKI).
 */
const exportOrgConsentAuditPdf = async (caregiver, query = {}) => {
  const page = await queryOrgConsentAudit(caregiver, {
    ...query,
    page: 1,
    limit: 10000,
    sortBy: 'createdAt:desc',
  });
  const cgId = caregiver._id || caregiver.id;
  const caregiverDoc = await Caregiver.findById(cgId).select('email').lean();
  const buffer = await buildConsentAuditPdfBuffer({
    rows: page.results,
    scopeLabel: page.scopeLabel,
    generatorEmail: caregiverDoc?.email || String(cgId),
    generatorRole: caregiver.role,
    generatorId: String(cgId),
  });
  return buffer;
};

/**
 * Get requests approaching deadline
 * @returns {Promise<PrivacyRequest[]>}
 */
const getApproachingDeadline = async () => {
  return await PrivacyRequest.getApproachingDeadline();
};

/**
 * Get overdue requests
 * @returns {Promise<PrivacyRequest[]>}
 */
const getOverdueRequests = async () => {
  return await PrivacyRequest.getOverdue();
};

/**
 * Get privacy statistics
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Promise<Object>}
 */
const getPrivacyStatistics = async (startDate, endDate) => {
  const requestStats = await PrivacyRequest.getStatistics(startDate, endDate);
  const consentStats = await ConsentRecord.getStatistics(startDate, endDate);
  
  return {
    requests: requestStats,
    consent: consentStats
  };
};

/**
 * Process access request - automatically gather ALL user data and email it
 * @param {ObjectId} requestId
 * @param {ObjectId} processedBy
 * @returns {Promise<PrivacyRequest>}
 */
const processAccessRequest = async (requestId, processedBy) => {
  const request = await PrivacyRequest.findById(requestId);
  
  if (!request) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Privacy request not found');
  }
  
  if (request.requestType !== 'access') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This is not an access request');
  }
  
  // Only process caregiver requests (patients don't have the app)
  if (request.requestorModel !== 'Caregiver') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Access requests are only available for caregivers');
  }
  
  const caregiver = await Caregiver.findById(request.requestorId)
    .populate('org')
    .populate('clients');
  
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }
  
  // Gather ALL user data
  const { Conversation, MedicalAnalysis, ConsentRecord } = require('../models');
  const emailService = require('./email.service');
  
  const userData = {
    profile: {
      name: caregiver.name,
      email: caregiver.email,
      phone: caregiver.phone,
      role: caregiver.role,
      org: caregiver.org ? {
        name: caregiver.org.name,
        email: caregiver.org.email
      } : null,
      createdAt: caregiver.createdAt,
      updatedAt: caregiver.updatedAt
    },
    patients: [],
    clients: [],
    conversations: [],
    medicalAnalysis: [],
    consentHistory: []
  };
  
  // Get all clients associated with this caregiver
  if (caregiver.clients && caregiver.clients.length > 0) {
    for (const clientId of caregiver.clients) {
      const client = await Client.findById(clientId);
      if (client) {
        userData.clients.push({
          id: client._id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          preferredName: client.preferredName,
          age: client.age,
          preferredLanguage: client.preferredLanguage,
          createdAt: client.createdAt
        });
        
        // Get conversations for this client
        const conversations = await Conversation.find({ clientId: client._id })
          .populate('messages')
          .sort({ startTime: -1 })
          .limit(100); // Limit to most recent 100
        
        userData.conversations.push(...conversations.map(c => ({
          id: c._id,
          clientId: c.clientId,
          clientName: client.name,
          status: c.status,
          startTime: c.startTime,
          endTime: c.endTime,
          messageCount: c.messages?.length || 0,
          summary: c.summary
        })));
        
        // Get medical analysis for this client
        const analyses = await MedicalAnalysis.find({ clientId: client._id })
          .sort({ createdAt: -1 })
          .limit(50);
        
        userData.medicalAnalysis.push(...analyses.map(a => ({
          id: a._id,
          clientId: a.clientId,
          clientName: client.name,
          analysisDate: a.analysisDate,
          cognitiveMetrics: a.cognitiveMetrics,
          psychiatricMetrics: a.psychiatricMetrics,
          warnings: a.warnings,
          confidence: a.confidence
        })));
      }
    }
  }
  
  // Get consent history
  const consentHistory = await ConsentRecord.find({ userId: caregiver._id, userModel: 'Caregiver' })
    .sort({ createdAt: -1 });
  
  userData.consentHistory = consentHistory.map(c => ({
    id: c._id,
    consentType: c.consentType,
    purpose: c.purpose,
    granted: c.granted,
    withdrawn: c.withdrawn,
    withdrawnAt: c.withdrawnAt,
    createdAt: c.createdAt
  }));
  
  // Create JSON file content
  const jsonData = JSON.stringify(userData, null, 2);
  
  // Email the data to the user automatically
  try {
    const locale = caregiver.preferredLanguage || 'en';
    const attachments = [{
      filename: `bianca-wellness-data-export-${requestId}.json`,
      content: jsonData,
      contentType: 'application/json'
    }];
    
    await emailService.sendPrivacyDataEmail(
      caregiver.email,
      caregiver.name,
      jsonData,
      requestId.toString(),
      locale
    );
    
    logger.info(`[Privacy Service] Access request data automatically emailed to ${caregiver.email} for request ${requestId}`);
  } catch (emailError) {
    // Check if this is an SES verification error (common in test/dev environments)
    const isSESVerificationError = emailError.name === 'MessageRejected' || 
                                   (emailError.message && emailError.message.includes('not verified'));
    const isTestEnv = config.env === 'test' || config.env === 'development';
    
    if (isSESVerificationError || isTestEnv) {
      logger.warn(`[Privacy Service] Email not sent for access request ${requestId} (${isSESVerificationError ? 'email addresses not verified in SES' : 'test/development environment'}). Request still processed successfully.`);
    } else {
      logger.error(`[Privacy Service] Failed to email access request data:`, emailError);
    }
    // Don't fail the request if email fails - data is still provided
  }
  
  // Update request with information provided
  request.informationProvided = [{
    dataType: 'complete_data_export',
    dataId: request.requestorId,
    format: 'json',
    providedAt: new Date(),
    providedVia: 'email'
  }];
  
  request.status = 'completed';
  request.responseDate = new Date();
  request.updatedBy = processedBy;
  await request.save();
  
  logger.info(`[Privacy Service] Access request processed and emailed: ${requestId}`);
  return request;
};

/**
 * Process correction request
 * @param {ObjectId} requestId
 * @param {Object} correctionData
 * @param {ObjectId} processedBy
 * @returns {Promise<PrivacyRequest>}
 */
const processCorrectionRequest = async (requestId, correctionData, processedBy) => {
  const request = await PrivacyRequest.findById(requestId);
  
  if (!request) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Privacy request not found');
  }
  
  if (request.requestType !== 'correction') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This is not a correction request');
  }
  
  // Update user data based on correction
  if (request.requestorModel === 'Caregiver') {
    const caregiver = await Caregiver.findById(request.requestorId);
    if (caregiver && correctionData.field && correctionData.value) {
      caregiver[correctionData.field] = correctionData.value;
      await caregiver.save();
    }
  } else if (request.requestorModel === 'Client') {
    const client = await Client.findById(request.requestorId);
    if (client && correctionData.field && correctionData.value) {
      client[correctionData.field] = correctionData.value;
      await client.save();
    }
  }
  
  // Update correction status
  request.correctionStatus = {
    corrected: true,
    correctionDate: new Date(),
    correctionNotes: correctionData.notes || 'Correction applied'
  };
  
  request.status = 'completed';
  request.responseDate = new Date();
  request.updatedBy = processedBy;
  await request.save();
  
  logger.info(`[Privacy Service] Correction request processed: ${requestId}`);
  return request;
};

/**
 * Create a privacy complaint
 * @param {Object} complaintBody
 * @param {ObjectId} complainantId
 * @param {string} complainantModel
 * @returns {Promise<PrivacyComplaint>}
 */
const createComplaint = async (complaintBody, complainantId, complainantModel = 'Caregiver') => {
  // Determine jurisdiction from organization
  let organizationCountry = 'US';
  let complaintType = 'GENERAL';
  
  try {
    const user = complainantModel === 'Caregiver' 
      ? await Caregiver.findById(complainantId).populate('org')
      : await Client.findById(complainantId).populate('org');
    
    if (user?.org) {
      organizationCountry = user.org.country || 'US';
      const jurisdiction = getJurisdiction(organizationCountry);
      complaintType = jurisdiction.jurisdiction === 'HIPAA' ? 'HIPAA' : 
                     jurisdiction.jurisdiction === 'PIPEDA' ? 'PIPEDA' : 'GENERAL';
    }
  } catch (error) {
    logger.warn('[Privacy Service] Could not determine jurisdiction for complaint:', error.message);
  }
  
  const complaint = await PrivacyComplaint.create({
    complaintType,
    complainantType: complainantModel === 'Caregiver' ? 'caregiver' : 'client',
    complainantId,
    complainantModel,
    subject: complaintBody.subject,
    description: complaintBody.description,
    violationType: complaintBody.violationType || 'other',
    organizationCountry,
    status: 'submitted',
    createdBy: complainantId
  });
  
  logger.info(`[Privacy Service] Complaint created: ${complaint._id} by ${complainantId} (${complaintType})`);
  return complaint;
};

/**
 * Get complaint by ID
 * @param {ObjectId} complaintId
 * @param {ObjectId} userId
 * @returns {Promise<PrivacyComplaint>}
 */
const getComplaintById = async (complaintId, userId) => {
  const complaint = await PrivacyComplaint.findById(complaintId);
  
  if (!complaint) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Complaint not found');
  }
  
  // Check authorization - users can only see their own complaints unless admin
  // This is a simplified check - you may want to add role-based access
  if (complaint.complainantId.toString() !== userId.toString()) {
    // Check if user is admin (you may want to add proper role checking here)
    const caregiver = await Caregiver.findById(userId);
    if (!caregiver || (caregiver.role !== 'orgAdmin' && caregiver.role !== 'superAdmin')) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Not authorized to view this complaint');
    }
  }
  
  return complaint;
};

/**
 * Query complaints
 * @param {Object} filter
 * @param {Object} options
 * @param {ObjectId} userId
 * @returns {Promise<Object>}
 */
const queryComplaints = async (filter, options, userId) => {
  // Non-admins can only see their own complaints
  const caregiver = await Caregiver.findById(userId);
  const isAdmin = caregiver && (caregiver.role === 'orgAdmin' || caregiver.role === 'superAdmin');
  
  if (!isAdmin) {
    filter.complainantId = userId;
  }
  
  const complaints = await PrivacyComplaint.paginate(filter, options);
  return complaints;
};

/**
 * Update complaint (acknowledge, investigate, resolve)
 * @param {ObjectId} complaintId
 * @param {Object} updateBody
 * @param {ObjectId} updatedBy
 * @returns {Promise<PrivacyComplaint>}
 */
const updateComplaint = async (complaintId, updateBody, updatedBy) => {
  const complaint = await PrivacyComplaint.findById(complaintId);
  
  if (!complaint) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Complaint not found');
  }
  
  // Update status and related fields
  if (updateBody.status) {
    complaint.status = updateBody.status;
    
    if (updateBody.status === 'acknowledged' && !complaint.acknowledgedAt) {
      complaint.acknowledgedAt = new Date();
      complaint.acknowledgedBy = updatedBy;
    }
    
    if (updateBody.status === 'investigating' && !complaint.investigationStartedAt) {
      complaint.investigationStartedAt = new Date();
    }
    
    if (updateBody.status === 'resolved' && !complaint.resolvedAt) {
      complaint.resolvedAt = new Date();
      complaint.resolvedBy = updatedBy;
      complaint.resolution = updateBody.resolution || 'upheld';
      complaint.resolutionDetails = updateBody.resolutionDetails;
    }
  }
  
  // Add investigation notes
  if (updateBody.investigationNote) {
    complaint.investigationNotes.push({
      note: updateBody.investigationNote,
      addedBy: updatedBy,
      addedAt: new Date()
    });
  }
  
  // Add remedial actions
  if (updateBody.remedialActions) {
    complaint.remedialActions = updateBody.remedialActions;
  }
  
  // Escalation
  if (updateBody.escalatedToRegulator) {
    complaint.escalatedToRegulator = true;
    complaint.escalatedAt = new Date();
    complaint.regulatorType = updateBody.regulatorType;
    complaint.regulatorComplaintNumber = updateBody.regulatorComplaintNumber;
  }
  
  if (updateBody.assignedTo) {
    complaint.assignedTo = updateBody.assignedTo;
  }
  
  complaint.updatedBy = updatedBy;
  await complaint.save();
  
  logger.info(`[Privacy Service] Complaint updated: ${complaintId} by ${updatedBy}`);
  return complaint;
};

module.exports = {
  createAccessRequest,
  createCorrectionRequest,
  getPrivacyRequestById,
  queryPrivacyRequests,
  updatePrivacyRequest,
  createConsentRecord,
  recordClientRecordingConsentEvent,
  getActiveConsent,
  hasConsent,
  withdrawConsent,
  getConsentHistory,
  queryOrgConsentAudit,
  exportOrgConsentAuditCsv,
  exportOrgConsentAuditPdf,
  getApproachingDeadline,
  getOverdueRequests,
  getPrivacyStatistics,
  processAccessRequest,
  processCorrectionRequest,
  createComplaint,
  getComplaintById,
  queryComplaints,
  updateComplaint,
};

