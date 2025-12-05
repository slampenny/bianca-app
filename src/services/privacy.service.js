const httpStatus = require('http-status');
const { PrivacyRequest, ConsentRecord, Caregiver, Patient } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

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
    requestorType: requestorModel === 'Caregiver' ? 'caregiver' : 'patient',
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
    requestorType: requestorModel === 'Caregiver' ? 'caregiver' : 'patient',
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
  const consent = await ConsentRecord.create({
    userType: userModel === 'Caregiver' ? 'caregiver' : 'patient',
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
    .populate('patients');
  
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
    conversations: [],
    medicalAnalysis: [],
    consentHistory: []
  };
  
  // Get all patients associated with this caregiver
  if (caregiver.patients && caregiver.patients.length > 0) {
    for (const patientId of caregiver.patients) {
      const patient = await Patient.findById(patientId);
      if (patient) {
        userData.patients.push({
          id: patient._id,
          name: patient.name,
          email: patient.email,
          phone: patient.phone,
          preferredName: patient.preferredName,
          age: patient.age,
          preferredLanguage: patient.preferredLanguage,
          createdAt: patient.createdAt
        });
        
        // Get conversations for this patient
        const conversations = await Conversation.find({ patientId: patient._id })
          .populate('messages')
          .sort({ startTime: -1 })
          .limit(100); // Limit to most recent 100
        
        userData.conversations.push(...conversations.map(c => ({
          id: c._id,
          patientId: c.patientId,
          patientName: patient.name,
          status: c.status,
          startTime: c.startTime,
          endTime: c.endTime,
          messageCount: c.messages?.length || 0,
          summary: c.summary
        })));
        
        // Get medical analysis for this patient
        const analyses = await MedicalAnalysis.find({ patientId: patient._id })
          .sort({ createdAt: -1 })
          .limit(50);
        
        userData.medicalAnalysis.push(...analyses.map(a => ({
          id: a._id,
          patientId: a.patientId,
          patientName: patient.name,
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
    logger.error(`[Privacy Service] Failed to email access request data:`, emailError);
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
  } else if (request.requestorModel === 'Patient') {
    const patient = await Patient.findById(request.requestorId);
    if (patient && correctionData.field && correctionData.value) {
      patient[correctionData.field] = correctionData.value;
      await patient.save();
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

module.exports = {
  createAccessRequest,
  createCorrectionRequest,
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
};

