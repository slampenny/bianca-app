const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const emergencyPhraseValidation = require('../../validations/emergencyPhrase.validation');
const emergencyPhraseController = require('../../controllers/emergencyPhrase.controller');

const router = express.Router();

// All routes require admin-level access (only company staff, not org staff)
router
  .route('/')
  .post(
    auth('manageAny:emergencyPhrase'), // Only company admins can create
    validate(emergencyPhraseValidation.createEmergencyPhrase),
    emergencyPhraseController.createEmergencyPhrase
  )
  .get(
    auth('readAny:emergencyPhrase'), // Company staff can read
    validate(emergencyPhraseValidation.getEmergencyPhrases),
    emergencyPhraseController.getEmergencyPhrases
  );

router
  .route('/statistics')
  .get(
    auth('readAny:emergencyPhrase'),
    validate(emergencyPhraseValidation.getPhraseStatistics),
    emergencyPhraseController.getPhraseStatistics
  );

router
  .route('/test-pattern')
  .post(
    auth('readAny:emergencyPhrase'),
    validate(emergencyPhraseValidation.testPhrasePattern),
    emergencyPhraseController.testPhrasePattern
  );

router
  .route('/bulk-import')
  .post(
    auth('manageAny:emergencyPhrase'),
    validate(emergencyPhraseValidation.bulkImportPhrases),
    emergencyPhraseController.bulkImportPhrases
  );

router
  .route('/export')
  .get(
    auth('readAny:emergencyPhrase'),
    validate(emergencyPhraseValidation.exportPhrases),
    emergencyPhraseController.exportPhrases
  );

router
  .route('/language/:language')
  .get(
    auth('readAny:emergencyPhrase'),
    validate(emergencyPhraseValidation.getPhrasesByLanguage),
    emergencyPhraseController.getPhrasesByLanguage
  );

router
  .route('/:phraseId')
  .get(
    auth('readAny:emergencyPhrase'),
    validate(emergencyPhraseValidation.getEmergencyPhrase),
    emergencyPhraseController.getEmergencyPhrase
  )
  .patch(
    auth('manageAny:emergencyPhrase'), // Only company admins can update
    validate(emergencyPhraseValidation.updateEmergencyPhrase),
    emergencyPhraseController.updateEmergencyPhrase
  )
  .delete(
    auth('manageAny:emergencyPhrase'), // Only company admins can delete
    validate(emergencyPhraseValidation.deleteEmergencyPhrase),
    emergencyPhraseController.deleteEmergencyPhrase
  );

router
  .route('/:phraseId/toggle')
  .patch(
    auth('manageAny:emergencyPhrase'), // Only company admins can toggle
    validate(emergencyPhraseValidation.togglePhraseStatus),
    emergencyPhraseController.togglePhraseStatus
  );

module.exports = router;
