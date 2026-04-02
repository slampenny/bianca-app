const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const adminValidation = require('../../validations/admin.validation');
const adminController = require('../../controllers/admin.controller');

const router = express.Router();

/**
 * Super-admin operations console (used by @bianca-app/admin).
 * All routes require JWT; handlers enforce role superAdmin.
 */

router.get('/observability', auth(), adminController.getObservability);

router.get(
  '/orgs',
  auth(),
  validate(adminValidation.searchOrgs),
  adminController.searchOrgs,
);

router.get(
  '/orgs/:orgId/scim',
  auth(),
  validate(adminValidation.orgIdParam),
  adminController.getOrgScimStatus,
);

router.post(
  '/orgs/:orgId/scim/token',
  auth(),
  validate(adminValidation.orgIdParam),
  adminController.issueOrgScimToken,
);

router.delete(
  '/orgs/:orgId/scim',
  auth(),
  validate(adminValidation.orgIdParam),
  adminController.disableOrgScim,
);

router.get(
  '/caregivers',
  auth(),
  validate(adminValidation.searchCaregivers),
  adminController.searchCaregivers,
);

router.post('/impersonate', auth(), validate(adminValidation.impersonate), adminController.impersonate);

router.patch(
  '/caregivers/:caregiverId/role',
  auth(),
  validate(adminValidation.setCaregiverRole),
  adminController.setCaregiverRole,
);

module.exports = router;
