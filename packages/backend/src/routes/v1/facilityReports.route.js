const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const facilityReportsValidation = require('../../validations/facilityReports.validation');
const facilityReportsController = require('../../controllers/facilityReports.controller');

const router = express.Router();

router
  .route('/call-completion-log')
  .get(
    auth('readOwn:facilityReport', 'readAny:facilityReport'),
    validate(facilityReportsValidation.callCompletionLogQuery),
    facilityReportsController.getCallCompletionLog
  );

router
  .route('/alert-audit-trail')
  .get(
    auth('readOwn:facilityReport', 'readAny:facilityReport'),
    validate(facilityReportsValidation.alertAuditTrailQuery),
    facilityReportsController.getAlertAuditTrail
  );

router
  .route('/summary')
  .get(
    auth('readOwn:facilityReport', 'readAny:facilityReport'),
    validate(facilityReportsValidation.reportsSummaryQuery),
    facilityReportsController.getReportsSummary
  );

module.exports = router;
