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

router.get('/onboarding/default-plan', auth(), adminController.getDefaultVoiceOnboardingPlan);

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

router.post(
  '/superadmin-invites',
  auth(),
  validate(adminValidation.sendSuperAdminInvite),
  adminController.sendSuperAdminInvite,
);

router.patch(
  '/caregivers/:caregiverId/role',
  auth(),
  validate(adminValidation.setCaregiverRole),
  adminController.setCaregiverRole,
);

/** Embedding anchor phrases (OpenAI text-embedding-3-large) — same defaults as legacy hardcoded ANCHOR_TREE, editable per env */
router.get(
  '/embedding-anchors',
  auth(),
  validate(adminValidation.embeddingAnchorsList),
  adminController.listEmbeddingAnchorPhrases,
);

router.post(
  '/embedding-anchors',
  auth(),
  validate(adminValidation.embeddingAnchorCreate),
  adminController.createEmbeddingAnchorPhrase,
);

router.post('/embedding-anchors/merge-defaults', auth(), adminController.mergeDefaultEmbeddingAnchorPhrases);

router.patch(
  '/embedding-anchors/:phraseId',
  auth(),
  validate(adminValidation.embeddingAnchorUpdate),
  adminController.updateEmbeddingAnchorPhrase,
);

router.delete(
  '/embedding-anchors/:phraseId',
  auth(),
  validate(adminValidation.embeddingAnchorIdParam),
  adminController.deleteEmbeddingAnchorPhrase,
);

router.get('/corp-email-forwards', auth(), adminController.listCorpEmailForwards);

router.put(
  '/corp-email-forwards',
  auth(),
  validate(adminValidation.saveCorpEmailForwards),
  adminController.saveCorpEmailForwards,
);

router.get(
  '/breach-logs',
  auth(),
  validate(adminValidation.listBreachLogs),
  adminController.listBreachLogs,
);

router.get(
  '/breach-logs/:id',
  auth(),
  validate(adminValidation.breachLogIdParam),
  adminController.getBreachLog,
);

router.patch(
  '/breach-logs/:id/status',
  auth(),
  validate(adminValidation.updateBreachLogStatus),
  adminController.updateBreachLogStatus,
);

router.get(
  '/backups',
  auth(),
  validate(adminValidation.listBackups),
  adminController.listBackups,
);

router.post(
  '/backups/trigger',
  auth(),
  validate(adminValidation.triggerBackup),
  adminController.triggerBackup,
);

router.post(
  '/backups/restore',
  auth(),
  validate(adminValidation.restoreBackup),
  adminController.restoreBackup,
);

router.post(
  '/place-call',
  auth(),
  validate(adminValidation.placeAdminCall),
  adminController.placeAdminCall,
);

router.get(
  '/demo-orgs',
  auth(),
  validate(adminValidation.listDemoOrgs),
  adminController.listDemoOrgs,
);

router.post(
  '/orgs/:orgId/demo-flag',
  auth(),
  validate(adminValidation.setOrgDemoFlag),
  adminController.setOrgDemoFlag,
);

router.post(
  '/orgs/:orgId/refresh-demo-data',
  auth(),
  validate(adminValidation.refreshDemoOrgData),
  adminController.refreshDemoOrgData,
);

module.exports = router;
