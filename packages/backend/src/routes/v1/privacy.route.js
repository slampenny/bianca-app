const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const privacyController = require('../../controllers/privacy.controller');
const { privacyValidation } = require('../../validations');

const router = express.Router();

// Privacy Requests
router
  .route('/requests')
  .post(
    auth(), // Any authenticated user can create a request
    validate(privacyValidation.requestAccess),
    privacyController.createAccessRequest
  )
  .get(
    auth(), // Users can see their own requests, admins can see all
    validate(privacyValidation.getRequests),
    privacyController.getPrivacyRequests
  );

router
  .route('/requests/access')
  .post(auth(), validate(privacyValidation.requestAccess), privacyController.createAccessRequest);

router
  .route('/requests/correction')
  .post(auth(), validate(privacyValidation.requestCorrection), privacyController.createCorrectionRequest);

router
  .route('/requests/object')
  .post(auth(), validate(privacyValidation.requestObject), privacyController.createObjectRequest);

router
  .route('/requests/restrict')
  .post(auth(), validate(privacyValidation.requestRestrict), privacyController.createRestrictRequest);

router
  .route('/requests/erasure')
  .post(auth(), validate(privacyValidation.requestErasure), privacyController.createErasureRequest);

router.route('/requests/approaching-deadline').get(
  auth('readAny:privacy'), // Admin only
  validate(privacyValidation.getRequests),
  privacyController.getApproachingDeadline
);

router.route('/requests/overdue').get(
  auth('readAny:privacy'), // Admin only
  validate(privacyValidation.getRequests),
  privacyController.getOverdueRequests
);

router
  .route('/requests/:requestId')
  .get(
    auth(), // Users can see their own, admins can see all
    validate(privacyValidation.privacyRequestIdParam),
    privacyController.getPrivacyRequest
  )
  .patch(
    auth('updateAny:privacy'), // Admin only
    validate(privacyValidation.updatePrivacyRequest),
    privacyController.updatePrivacyRequest
  );

router.route('/requests/:requestId/process-access').post(
  auth('updateAny:privacy'), // Admin only
  validate(privacyValidation.privacyRequestIdParam),
  privacyController.processAccessRequest
);

router.route('/requests/:requestId/process-correction').post(
  auth('updateAny:privacy'), // Admin only
  validate(privacyValidation.processCorrection),
  privacyController.processCorrectionRequest
);

router.route('/requests/:requestId/status').get(
  auth(),
  validate(privacyValidation.privacyRequestIdParam),
  privacyController.getRequestStatus
);

// Consent Management
router
  .route('/consent')
  .post(auth(), validate(privacyValidation.createConsent), privacyController.createConsent)
  .get(auth(), validate(privacyValidation.getRequests), privacyController.getActiveConsent);

router.route('/consent/check').get(auth(), validate(privacyValidation.getRequests), privacyController.checkConsent);

router.route('/consent/history').get(auth(), validate(privacyValidation.getRequests), privacyController.getConsentHistory);

router
  .route('/consent/:consentId/withdraw')
  .post(auth(), validate(privacyValidation.withdrawConsent), privacyController.withdrawConsent);

// Client/resident GDPR consent (per-purpose, append-only audit)
router
  .route('/client-consent/withdraw')
  .post(auth(), validate(privacyValidation.withdrawClientConsent), privacyController.withdrawClientConsent);

router
  .route('/client-consent/status/:clientId')
  .get(auth(), validate(privacyValidation.clientConsentClientIdParam), privacyController.getClientConsentStatus);

router
  .route('/client-consent/audit/:clientId')
  .get(auth(), validate(privacyValidation.clientConsentClientIdParam), privacyController.getClientConsentAudit);

// Statistics (Admin only)
router.route('/statistics').get(
  auth('readAny:privacy'), // Admin only
  validate(privacyValidation.getRequests),
  privacyController.getPrivacyStatistics
);

// Complaints (PIPEDA and HIPAA)
router
  .route('/complaints')
  .post(
    auth(), // Any authenticated user can create a complaint
    validate(privacyValidation.createComplaint),
    privacyController.createComplaint
  )
  .get(
    auth(), // Users can see their own complaints, admins can see all
    validate(privacyValidation.getRequests),
    privacyController.getComplaints
  );

router.route('/complaints/gdpr').post(
  auth(),
  validate(privacyValidation.createGdprComplaint),
  privacyController.createGdprComplaint
);

router
  .route('/complaints/:complaintId')
  .get(
    auth(), // Users can see their own, admins can see all
    validate(privacyValidation.complaintIdParam),
    privacyController.getComplaint
  )
  .patch(
    auth('updateAny:privacy'), // Admin only
    validate(privacyValidation.updateComplaint),
    privacyController.updateComplaint
  );

// Data Deletion Requests
router.route('/deletion').post(
  auth(), // Any authenticated user can request deletion
  validate(privacyValidation.requestDeletion),
  privacyController.requestDataDeletion
);

module.exports = router;
