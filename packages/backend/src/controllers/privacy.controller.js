const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const pick = require('../utils/pick');
const privacyService = require('../services/privacy.service');
const logger = require('../config/logger');

/**
 * Create access request - automatically processes and emails data
 */
const createAccessRequest = catchAsync(async (req, res) => {
  const request = await privacyService.createAccessRequest(
    req.body,
    req.caregiver.id,
    'Caregiver' // Only caregivers have the app
  );
  
  // Automatically process and email the data
  try {
    await privacyService.processAccessRequest(request._id, req.caregiver.id);
    logger.info(`[Privacy Controller] Access request ${request._id} automatically processed`);
  } catch (processError) {
    // Check if this is an email-related error (which is handled gracefully in the service)
    const isEmailError = processError.message && (
      processError.message.includes('email') || 
      processError.message.includes('Email') ||
      processError.name === 'MessageRejected'
    );
    
    if (isEmailError) {
      logger.warn(`[Privacy Controller] Access request ${request._id} processed, but email delivery failed (likely due to test/development environment or unverified email addresses)`);
    } else {
      logger.error(`[Privacy Controller] Failed to auto-process access request:`, processError);
    }
    // Don't fail the request creation - it's still created, just needs manual processing
  }
  
  res.status(httpStatus.CREATED).send(request);
});

/**
 * Create correction request
 */
const createCorrectionRequest = catchAsync(async (req, res) => {
  const request = await privacyService.createCorrectionRequest(
    req.body,
    req.caregiver.id,
    'Caregiver'
  );
  res.status(httpStatus.CREATED).send(request);
});

/**
 * Get privacy request by ID
 */
const getPrivacyRequest = catchAsync(async (req, res) => {
  const request = await privacyService.getPrivacyRequestById(req.params.requestId, req.caregiver.id);
  res.send(request);
});

/**
 * Get privacy requests
 */
const getPrivacyRequests = catchAsync(async (req, res) => {
  const filter = {};
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await privacyService.queryPrivacyRequests(filter, options, req.caregiver.id);
  res.send(result);
});

/**
 * Update privacy request
 */
const updatePrivacyRequest = catchAsync(async (req, res) => {
  const request = await privacyService.updatePrivacyRequest(
    req.params.requestId,
    req.body,
    req.caregiver.id
  );
  res.send(request);
});

/**
 * Process access request
 */
const processAccessRequest = catchAsync(async (req, res) => {
  const request = await privacyService.processAccessRequest(
    req.params.requestId,
    req.caregiver.id
  );
  res.send(request);
});

/**
 * Process correction request
 */
const processCorrectionRequest = catchAsync(async (req, res) => {
  const request = await privacyService.processCorrectionRequest(
    req.params.requestId,
    req.body,
    req.caregiver.id
  );
  res.send(request);
});

/**
 * Create consent record
 */
const createConsent = catchAsync(async (req, res) => {
  const consent = await privacyService.createConsentRecord(
    req.body,
    req.caregiver.id,
    'Caregiver'
  );
  res.status(httpStatus.CREATED).send(consent);
});

/**
 * Get active consent
 */
const getActiveConsent = catchAsync(async (req, res) => {
  const consent = await privacyService.getActiveConsent(
    req.caregiver.id,
    'Caregiver',
    req.query.consentType
  );
  res.send(consent);
});

/**
 * Check consent
 */
const checkConsent = catchAsync(async (req, res) => {
  const hasConsent = await privacyService.hasConsent(
    req.caregiver.id,
    'Caregiver',
    req.query.consentType,
    req.query.purpose
  );
  res.send({ hasConsent });
});

/**
 * Withdraw consent
 */
const withdrawConsent = catchAsync(async (req, res) => {
  const consent = await privacyService.withdrawConsent(
    req.params.consentId,
    req.body,
    req.caregiver.id
  );
  res.send(consent);
});

/**
 * Get consent history
 */
const getConsentHistory = catchAsync(async (req, res) => {
  const history = await privacyService.getConsentHistory(req.caregiver.id, 'Caregiver');
  res.send(history);
});

/**
 * Get approaching deadline requests
 */
const getApproachingDeadline = catchAsync(async (req, res) => {
  const requests = await privacyService.getApproachingDeadline();
  res.send(requests);
});

/**
 * Get overdue requests
 */
const getOverdueRequests = catchAsync(async (req, res) => {
  const requests = await privacyService.getOverdueRequests();
  res.send(requests);
});

/**
 * Get privacy statistics
 */
const getPrivacyStatistics = catchAsync(async (req, res) => {
  const stats = await privacyService.getPrivacyStatistics(req.query.startDate, req.query.endDate);
  res.send(stats);
});

/**
 * Create privacy complaint
 */
const createComplaint = catchAsync(async (req, res) => {
  const complaint = await privacyService.createComplaint(
    req.body,
    req.caregiver.id,
    'Caregiver'
  );
  res.status(httpStatus.CREATED).send(complaint);
});

/**
 * Get complaint by ID
 */
const getComplaint = catchAsync(async (req, res) => {
  const complaint = await privacyService.getComplaintById(req.params.complaintId, req.caregiver.id);
  res.send(complaint);
});

/**
 * Get complaints
 */
const getComplaints = catchAsync(async (req, res) => {
  const filter = {};
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await privacyService.queryComplaints(filter, options, req.caregiver.id);
  res.send(result);
});

/**
 * Update complaint
 */
const updateComplaint = catchAsync(async (req, res) => {
  const complaint = await privacyService.updateComplaint(
    req.params.complaintId,
    req.body,
    req.caregiver.id
  );
  res.send(complaint);
});

/**
 * Request data deletion
 */
const requestDataDeletion = catchAsync(async (req, res) => {
  const { dataType = 'all' } = req.body;
  const dataDeletionService = require('../services/dataDeletion.service');
  
  const result = await dataDeletionService.handleDeletionRequest(
    req.caregiver.id,
    dataType
  );
  
  res.status(httpStatus.OK).send(result);
});

module.exports = {
  createAccessRequest,
  createCorrectionRequest,
  getPrivacyRequest,
  getPrivacyRequests,
  updatePrivacyRequest,
  processAccessRequest,
  processCorrectionRequest,
  createConsent,
  getActiveConsent,
  checkConsent,
  withdrawConsent,
  getConsentHistory,
  getApproachingDeadline,
  getOverdueRequests,
  getPrivacyStatistics,
  createComplaint,
  getComplaint,
  getComplaints,
  updateComplaint,
  requestDataDeletion,
};

