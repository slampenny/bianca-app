const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const familyWeeklyDigestValidation = require('../../validations/familyWeeklyDigest.validation');
const familyWeeklyDigestController = require('../../controllers/familyWeeklyDigest.controller');

const router = express.Router();

router
  .route('/preview')
  .post(
    auth('readOwn:familyDigest', 'readAny:familyDigest'),
    validate(familyWeeklyDigestValidation.previewDigest),
    familyWeeklyDigestController.previewDigest
  );

router
  .route('/')
  .post(
    auth('createOwn:familyDigest', 'createAny:familyDigest'),
    validate(familyWeeklyDigestValidation.createDigest),
    familyWeeklyDigestController.createDigest
  )
  .get(
    auth('readOwn:familyDigest', 'readAny:familyDigest'),
    validate(familyWeeklyDigestValidation.listDigests),
    familyWeeklyDigestController.listDigests
  );

router
  .route('/:digestId')
  .get(
    auth('readOwn:familyDigest', 'readAny:familyDigest'),
    validate(familyWeeklyDigestValidation.digestIdParam),
    familyWeeklyDigestController.getDigest
  );

router
  .route('/:digestId/send')
  .post(
    auth('createOwn:familyDigest', 'createAny:familyDigest'),
    validate(familyWeeklyDigestValidation.digestIdParam),
    familyWeeklyDigestController.sendDigest
  );

module.exports = router;
