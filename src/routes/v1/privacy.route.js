const express = require('express');
const auth = require('../../middlewares/auth');
const privacyController = require('../../controllers/privacy.controller');

const router = express.Router();

// Privacy Requests
router
  .route('/requests')
  .post(
    auth(), // Any authenticated user can create a request
    privacyController.createAccessRequest
  )
  .get(
    auth(), // Users can see their own requests, admins can see all
    privacyController.getPrivacyRequests
  );

router
  .route('/requests/access')
  .post(
    auth(),
    privacyController.createAccessRequest
  );

router
  .route('/requests/correction')
  .post(
    auth(),
    privacyController.createCorrectionRequest
  );

router
  .route('/requests/approaching-deadline')
  .get(
    auth('readAny:privacy'), // Admin only
    privacyController.getApproachingDeadline
  );

router
  .route('/requests/overdue')
  .get(
    auth('readAny:privacy'), // Admin only
    privacyController.getOverdueRequests
  );

router
  .route('/requests/:requestId')
  .get(
    auth(), // Users can see their own, admins can see all
    privacyController.getPrivacyRequest
  )
  .patch(
    auth('updateAny:privacy'), // Admin only
    privacyController.updatePrivacyRequest
  );

router
  .route('/requests/:requestId/process-access')
  .post(
    auth('updateAny:privacy'), // Admin only
    privacyController.processAccessRequest
  );

router
  .route('/requests/:requestId/process-correction')
  .post(
    auth('updateAny:privacy'), // Admin only
    privacyController.processCorrectionRequest
  );

// Consent Management
router
  .route('/consent')
  .post(
    auth(),
    privacyController.createConsent
  )
  .get(
    auth(),
    privacyController.getActiveConsent
  );

router
  .route('/consent/check')
  .get(
    auth(),
    privacyController.checkConsent
  );

router
  .route('/consent/history')
  .get(
    auth(),
    privacyController.getConsentHistory
  );

router
  .route('/consent/:consentId/withdraw')
  .post(
    auth(),
    privacyController.withdrawConsent
  );

// Statistics (Admin only)
router
  .route('/statistics')
  .get(
    auth('readAny:privacy'), // Admin only
    privacyController.getPrivacyStatistics
  );

module.exports = router;



