const httpStatus = require('http-status');
const { PrivacyRequest, ConsentRecord, PrivacyComplaint, Caregiver, Client, Org } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const config = require('../config/config');
const {
  getJurisdiction,
  getPrivacyPolicyType,
  computePrivacyResponseDeadline,
  getPrivacyExtensionDays,
  getDataRetentionPeriod,
} = require('../utils/jurisdiction.utils');

const VALID_DELETION_DATA_TYPES = ['all', 'calls', 'conversations', 'medicalAnalysis', 'clientMemory'];

/**
 * Resolve org jurisdiction for a requestor at time of request.
 */
const resolveJurisdictionForRequestor = async (requestorId, requestorModel = 'Caregiver') => {
  let org = null;
  if (requestorModel === 'Caregiver') {
    const user = await Caregiver.findById(requestorId).populate('org');
    org = user?.org;
  } else {
    const user = await Client.findById(requestorId).populate('org');
    org = user?.org;
  }
  const country = org?.country || 'US';
  const { jurisdiction } = getJurisdiction(country);
  return { country, jurisdiction, org };
};

const buildPrivacyRequestBase = async (requestBody, requestorId, requestorModel, requestType) => {
  const { jurisdiction } = await resolveJurisdictionForRequestor(requestorId, requestorModel);
  const requestDate = new Date();
  return {
    requestType,
    requestorType: requestorModel === 'Caregiver' ? 'caregiver' : 'client',
    requestorId,
    requestorModel,
    jurisdiction,
    requestDate,
    responseDeadline: computePrivacyResponseDeadline(requestDate, jurisdiction),
    informationRequested: requestBody.informationRequested || `${requestType} request`,
    createdBy: requestorId,
  };
};

/**
 * Create an access request
 * @param {Object} requestBody
 * @param {ObjectId} requestorId
 * @param {string} requestorModel
 * @returns {Promise<PrivacyRequest>}
 */
const createAccessRequest = async (requestBody, requestorId, requestorModel = 'Caregiver') => {
  const base = await buildPrivacyRequestBase(requestBody, requestorId, requestorModel, 'access');
  const request = await PrivacyRequest.create({
    ...base,
    accessMethod: requestBody.accessMethod || 'view',
  });
  
  logger.info(`[Privacy Service] Access request created: ${request._id} by ${requestorId} (${request.jurisdiction})`);
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

  const base = await buildPrivacyRequestBase(requestBody, requestorId, requestorModel, 'correction');
  const request = await PrivacyRequest.create({
    ...base,
    correctionDetails: requestBody.correctionDetails,
  });
  
  logger.info(`[Privacy Service] Correction request created: ${request._id} by ${requestorId}`);
  return request;
};

const createObjectRequest = async (requestBody, requestorId, requestorModel = 'Caregiver') => {
  const base = await buildPrivacyRequestBase(
    requestBody,
    requestorId,
    requestorModel,
    'object'
  );
  const request = await PrivacyRequest.create({
    ...base,
    informationRequested: requestBody.objectionDetails || requestBody.informationRequested || 'Object to processing',
  });
  logger.info(`[Privacy Service] Object request created: ${request._id}`);
  return request;
};

const createRestrictRequest = async (requestBody, requestorId, requestorModel = 'Caregiver') => {
  const base = await buildPrivacyRequestBase(
    requestBody,
    requestorId,
    requestorModel,
    'restrict'
  );
  const request = await PrivacyRequest.create({
    ...base,
    informationRequested: requestBody.restrictionDetails || requestBody.informationRequested || 'Restrict processing',
  });
  logger.info(`[Privacy Service] Restrict request created: ${request._id}`);
  return request;
};

const createErasureRequest = async (requestBody, requestorId, requestorModel = 'Caregiver') => {
  const base = await buildPrivacyRequestBase(
    requestBody,
    requestorId,
    requestorModel,
    'erasure'
  );
  const request = await PrivacyRequest.create({
    ...base,
    informationRequested: requestBody.informationRequested || 'Right to erasure',
  });
  logger.info(`[Privacy Service] Erasure request created: ${request._id}`);
  return request;
};

const getRequestStatus = async (requestId, userId) => {
  const request = await getPrivacyRequestById(requestId, userId);
  const effectiveDeadline = request.extendedDeadline || request.responseDeadline;
  const now = new Date();
  return {
    id: request._id,
    requestType: request.requestType,
    status: request.status,
    jurisdiction: request.jurisdiction,
    requestDate: request.requestDate,
    responseDeadline: request.responseDeadline,
    extendedDeadline: request.extendedDeadline,
    effectiveDeadline,
    isOverdue: ['pending', 'processing'].includes(request.status) && effectiveDeadline < now,
    extensionRequested: request.extensionRequested,
    responseDate: request.responseDate,
    denialReason: request.denialReason,
  };
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
    const extensionDays = getPrivacyExtensionDays(request.jurisdiction || 'PIPEDA');
    const extendedDeadline = new Date(request.responseDeadline);
    extendedDeadline.setDate(extendedDeadline.getDate() + extensionDays);
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
  let jurisdiction = consentBody.jurisdiction;
  if (!jurisdiction) {
    const user =
      userModel === 'Caregiver'
        ? await Caregiver.findById(userId).populate('org')
        : await Client.findById(userId).populate('org');
    jurisdiction = getJurisdiction(user?.org?.country).jurisdiction;
  }

  const consent = await ConsentRecord.create({
    userType: userModel === 'Caregiver' ? 'caregiver' : 'client',
    userId,
    userModel,
    jurisdiction,
    consentType: consentBody.consentType,
    purpose: consentBody.purpose,
    granted: consentBody.granted !== false, // Default to true
    method: consentBody.method || 'explicit',
    explicitConsent: consentBody.explicitConsent,
    informationTypes: consentBody.informationTypes || [],
    thirdParties: consentBody.thirdParties || [],
    retentionPeriod: consentBody.retentionPeriod,
    expiresAt: consentBody.expiresAt,
    legalBasis: consentBody.legalBasis,
    collectionNoticeProvided: consentBody.collectionNoticeProvided || false,
    collectionNoticeProvidedAt: consentBody.collectionNoticeProvided ? new Date() : null,
    collectionNoticeVersion: consentBody.collectionNoticeVersion,
    createdBy: consentBody.createdBy || userId
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

const clientMemoryService = require('./clientMemory.service');

const getAccessExportLimits = () => {
  const maxConversations = process.env.PRIVACY_ACCESS_MAX_CONVERSATIONS
    ? parseInt(process.env.PRIVACY_ACCESS_MAX_CONVERSATIONS, 10)
    : null;
  const maxMedicalAnalysis = process.env.PRIVACY_ACCESS_MAX_MEDICAL
    ? parseInt(process.env.PRIVACY_ACCESS_MAX_MEDICAL, 10)
    : null;
  return { maxConversations, maxMedicalAnalysis };
};

const getRetentionCutoff = (country, dataType) => {
  const retention = getDataRetentionPeriod(country, dataType);
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - retention.years);
  return cutoff;
};

const gatherClientExportData = async (client, country, limits) => {
  const { Conversation, MedicalAnalysis, AuditLog } = require('../models');
  const retentionCutoff = getRetentionCutoff(country, 'conversations');

  let conversationQuery = Conversation.find({
    clientId: client._id,
    createdAt: { $gte: retentionCutoff },
  }).sort({ startTime: -1 });
  if (limits.maxConversations) {
    conversationQuery = conversationQuery.limit(limits.maxConversations);
  }
  const conversations = await conversationQuery.populate('messages');

  const clientMemoryFacts = await clientMemoryService.getAllActiveFactsForClient(client._id);

  let analysisQuery = MedicalAnalysis.find({
    clientId: client._id,
    createdAt: { $gte: getRetentionCutoff(country, 'medicalAnalysis') },
  }).sort({ createdAt: -1 });
  if (limits.maxMedicalAnalysis) {
    analysisQuery = analysisQuery.limit(limits.maxMedicalAnalysis);
  }
  const analyses = await analysisQuery;

  const auditLogs = await AuditLog.find({
    $or: [
      { resource: 'client', resourceId: client._id.toString() },
    ],
    timestamp: { $gte: getRetentionCutoff(country, 'auditLog') },
  }).sort({ timestamp: -1 }).lean();

  return {
    profile: {
      id: client._id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      preferredName: client.preferredName,
      age: client.age,
      preferredLanguage: client.preferredLanguage,
      createdAt: client.createdAt,
    },
    clientMemory: clientMemoryFacts.map((f) => ({
      id: f._id,
      fact: f.fact,
      category: f.category,
      confidence: f.confidence,
      priority: f.priority,
      extractedAt: f.extractedAt,
      conversationId: f.conversationId,
    })),
    conversations: conversations.map((c) => ({
      id: c._id,
      status: c.status,
      startTime: c.startTime,
      endTime: c.endTime,
      summary: c.summary,
      messages: (c.messages || []).map((m) => ({
        id: m._id,
        role: m.role,
        content: m.content,
        messageType: m.messageType,
        createdAt: m.createdAt,
      })),
    })),
    medicalAnalysis: analyses.map((a) => ({
      id: a._id,
      analysisDate: a.analysisDate,
      cognitiveMetrics: a.cognitiveMetrics,
      psychiatricMetrics: a.psychiatricMetrics,
      warnings: a.warnings,
      confidence: a.confidence,
    })),
    auditLogs: auditLogs.map((log) => ({
      id: log._id,
      timestamp: log.timestamp,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      outcome: log.outcome,
    })),
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

  const emailService = require('./email.service');
  const { ConsentRecord, AuditLog } = require('../models');
  const limits = getAccessExportLimits();

  let recipientEmail;
  let recipientName;
  let locale = 'en';
  let country = 'US';
  const userData = {
    profile: null,
    clients: [],
    clientMemory: [],
    conversations: [],
    medicalAnalysis: [],
    consentHistory: [],
    auditLogs: [],
  };

  if (request.requestorModel === 'Caregiver') {
    const caregiver = await Caregiver.findById(request.requestorId)
      .populate('org')
      .populate('clients');

    if (!caregiver) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
    }

    recipientEmail = caregiver.email;
    recipientName = caregiver.name;
    locale = caregiver.preferredLanguage || 'en';
    country = caregiver.org?.country || 'US';

    userData.profile = {
      name: caregiver.name,
      email: caregiver.email,
      phone: caregiver.phone,
      role: caregiver.role,
      org: caregiver.org ? { name: caregiver.org.name, email: caregiver.org.email } : null,
      createdAt: caregiver.createdAt,
      updatedAt: caregiver.updatedAt,
    };

    if (caregiver.clients?.length > 0) {
      for (const clientId of caregiver.clients) {
        const client = await Client.findById(clientId);
        if (!client) continue;
        const clientExport = await gatherClientExportData(client, country, limits);
        userData.clients.push(clientExport.profile);
        userData.clientMemory.push(...clientExport.clientMemory);
        userData.conversations.push(...clientExport.conversations);
        userData.medicalAnalysis.push(...clientExport.medicalAnalysis);
        userData.auditLogs.push(...clientExport.auditLogs);
      }
    }

    const caregiverAuditLogs = await AuditLog.find({ userId: caregiver._id })
      .sort({ timestamp: -1 })
      .lean();
    userData.auditLogs.push(...caregiverAuditLogs.map((log) => ({
      id: log._id,
      timestamp: log.timestamp,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      outcome: log.outcome,
    })));

    const consentHistory = await ConsentRecord.find({ userId: caregiver._id, userModel: 'Caregiver' })
      .sort({ createdAt: -1 });
    userData.consentHistory = consentHistory.map((c) => ({
      id: c._id,
      consentType: c.consentType,
      purpose: c.purpose,
      granted: c.granted,
      withdrawn: c.withdrawn,
      withdrawnAt: c.withdrawnAt,
      createdAt: c.createdAt,
    }));
  } else {
    const client = await Client.findById(request.requestorId).populate('org');
    if (!client) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
    }

    recipientEmail = client.email;
    recipientName = client.name;
    locale = client.preferredLanguage || 'en';
    country = client.org?.country || 'US';

    const clientExport = await gatherClientExportData(client, country, limits);
    userData.profile = clientExport.profile;
    userData.clientMemory = clientExport.clientMemory;
    userData.conversations = clientExport.conversations;
    userData.medicalAnalysis = clientExport.medicalAnalysis;
    userData.auditLogs = clientExport.auditLogs;

    const consentHistory = await ConsentRecord.find({ userId: client._id, userModel: 'Client' })
      .sort({ createdAt: -1 });
    userData.consentHistory = consentHistory.map((c) => ({
      id: c._id,
      consentType: c.consentType,
      purpose: c.purpose,
      granted: c.granted,
      withdrawn: c.withdrawn,
      withdrawnAt: c.withdrawnAt,
      createdAt: c.createdAt,
    }));
  }

  const jsonData = JSON.stringify(userData, null, 2);

  try {
    await emailService.sendPrivacyDataEmail(
      recipientEmail,
      recipientName,
      jsonData,
      requestId.toString(),
      locale
    );
    logger.info(`[Privacy Service] Access request data emailed to ${recipientEmail} for request ${requestId}`);
  } catch (emailError) {
    const isSESVerificationError = emailError.name === 'MessageRejected' ||
      (emailError.message && emailError.message.includes('not verified'));
    const isTestEnv = config.env === 'test' || config.env === 'development';

    if (isSESVerificationError || isTestEnv) {
      logger.warn(`[Privacy Service] Email not sent for access request ${requestId}. Request still processed.`);
    } else {
      logger.error('[Privacy Service] Failed to email access request data:', emailError);
    }
  }

  request.informationProvided = [{
    dataType: 'complete_data_export',
    dataId: request.requestorId,
    format: 'json',
    providedAt: new Date(),
    providedVia: 'email',
  }];

  request.status = 'completed';
  request.responseDate = new Date();
  request.updatedBy = processedBy;
  await request.save();

  logger.info(`[Privacy Service] Access request processed: ${requestId}`);
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
  let organizationCountry = null;
  let complaintType = getPrivacyPolicyType(null);

  try {
    const user = complainantModel === 'Caregiver' 
      ? await Caregiver.findById(complainantId).populate('org')
      : await Client.findById(complainantId).populate('org');
    
    if (user?.org) {
      organizationCountry = user.org.country || null;
      complaintType = getPrivacyPolicyType(organizationCountry);
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
 * Create a GDPR complaint via the NAIH supervisory authority pathway.
 */
const createGdprComplaint = async (complaintBody, complainantId, complainantModel = 'Caregiver') => {
  let organizationCountry = 'HU';
  try {
    const user = complainantModel === 'Caregiver'
      ? await Caregiver.findById(complainantId).populate('org')
      : await Client.findById(complainantId).populate('org');
    if (user?.org?.country) {
      organizationCountry = user.org.country;
    }
  } catch (error) {
    logger.warn('[Privacy Service] Could not determine country for GDPR complaint:', error.message);
  }

  const complaint = await PrivacyComplaint.create({
    complaintType: 'NAIH',
    complainantType: complainantModel === 'Caregiver' ? 'caregiver' : 'client',
    complainantId,
    complainantModel,
    subject: complaintBody.subject,
    description: complaintBody.description || complaintBody.complaint,
    violationType: complaintBody.violationType || 'other',
    organizationCountry,
    supervisoryAuthority: 'NAIH',
    status: 'submitted',
    createdBy: complainantId,
  });

  logger.info(`[Privacy Service] NAIH GDPR complaint created: ${complaint._id}`);
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

/**
 * Create an append-only GDPR client consent audit record.
 * @param {Object} params
 * @returns {Promise<ConsentRecord>}
 */
const createClientGdprConsentRecord = async ({
  clientId,
  org,
  recordType,
  purposes,
  ipAddress,
  userAgent,
  consentVersion,
  createdBy = null,
  withdrawalReason = null,
}) => {
  const jurisdictionInfo = getJurisdiction(org?.country);
  const now = new Date();
  const record = await ConsentRecord.create({
    userType: 'client',
    userId: clientId,
    userModel: 'Client',
    clientId,
    recordType,
    jurisdiction: jurisdictionInfo.jurisdiction,
    legalBasis: 'consent',
    purposes,
    consentVersion,
    consentType: 'collection',
    purpose: purposes.join(', '),
    granted: recordType === 'grant',
    withdrawn: recordType === 'withdrawal',
    withdrawnAt: recordType === 'withdrawal' ? now : undefined,
    withdrawalReason: recordType === 'withdrawal' ? withdrawalReason : undefined,
    method: 'explicit',
    explicitConsent: {
      provided: recordType === 'grant',
      providedAt: now,
      providedVia: recordType === 'grant' ? 'checkbox' : 'app',
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
    createdBy,
  });
  logger.info(`[Privacy Service] Client GDPR consent ${recordType} record ${record._id} for client ${clientId}`);
  return record;
};

/**
 * @param {import('mongoose').Types.ObjectId|string} clientId
 * @param {Object} caregiver
 */
const assertClientConsentAccess = async (clientId, caregiver) => {
  const client = await Client.findById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  const { assertCaregiverClientAccess } = require('../utils/accessControl');
  const caregiverDoc = caregiver?.role === 'staff' ? await Caregiver.findById(caregiver._id || caregiver.id) : null;
  assertCaregiverClientAccess(caregiver, caregiverDoc, client, 'You do not have access to this client');
  return client;
};

/**
 * Withdraw client consent for specific purposes (append-only audit trail).
 */
const withdrawClientConsent = async (body, caregiver, ipAddress, userAgent) => {
  const {
    CLIENT_CONSENT_VERSION,
    normalizePurposes,
  } = require('../constants/clientConsent.constants');
  const { clientId, purposes, withdrawalReason } = body;
  const purposesToWithdraw = normalizePurposes(purposes);
  if (purposesToWithdraw.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'At least one valid purpose is required for withdrawal');
  }
  const client = await assertClientConsentAccess(clientId, caregiver);
  const org = await Org.findById(client.org);
  const record = await createClientGdprConsentRecord({
    clientId: client._id,
    org,
    recordType: 'withdrawal',
    purposes: purposesToWithdraw,
    ipAddress,
    userAgent,
    consentVersion: CLIENT_CONSENT_VERSION,
    createdBy: caregiver?.id || caregiver?._id,
    withdrawalReason,
  });
  for (const purpose of purposesToWithdraw) {
    client.consentedPurposes[purpose] = false;
    client.consentVersionByPurpose[purpose] = undefined;
    client.consentedAtByPurpose[purpose] = undefined;
  }
  client.markModified('consentedPurposes');
  client.markModified('consentVersionByPurpose');
  client.markModified('consentedAtByPurpose');
  await client.save();
  return { record, client };
};

/**
 * Current per-purpose consent status for a client.
 */
const getClientConsentStatus = async (clientId, caregiver) => {
  const client = await assertClientConsentAccess(clientId, caregiver);
  const { isFullyConsented } = require('../constants/clientConsent.constants');
  return {
    clientId: client._id,
    consented: isFullyConsented(client.consentedPurposes),
    consentedPurposes: client.consentedPurposes,
    consentedAtByPurpose: client.consentedAtByPurpose,
    consentVersionByPurpose: client.consentVersionByPurpose,
  };
};

/**
 * Append-only GDPR consent audit trail for a client.
 */
const getClientConsentAudit = async (clientId, caregiver) => {
  await assertClientConsentAccess(clientId, caregiver);
  return ConsentRecord.find({
    clientId,
    recordType: { $in: ['grant', 'withdrawal'] },
  }).sort({ createdAt: -1 });
};

module.exports = {
  createAccessRequest,
  createCorrectionRequest,
  createObjectRequest,
  createRestrictRequest,
  createErasureRequest,
  getRequestStatus,
  getPrivacyRequestById,
  queryPrivacyRequests,
  updatePrivacyRequest,
  createConsentRecord,
  getActiveConsent,
  hasConsent,
  withdrawConsent,
  getConsentHistory,
  getApproachingDeadline,
  getOverdueRequests,
  getPrivacyStatistics,
  processAccessRequest,
  processCorrectionRequest,
  createComplaint,
  createGdprComplaint,
  getComplaintById,
  queryComplaints,
  updateComplaint,
  createClientGdprConsentRecord,
  withdrawClientConsent,
  getClientConsentStatus,
  getClientConsentAudit,
  VALID_DELETION_DATA_TYPES,
};

