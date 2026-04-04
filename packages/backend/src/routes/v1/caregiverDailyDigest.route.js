const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const caregiverDailyDigestValidation = require('../../validations/caregiverDailyDigest.validation');
const caregiverDailyDigestController = require('../../controllers/caregiverDailyDigest.controller');

const router = express.Router();

router
  .route('/')
  .post(
    auth('createOwn:caregiverDailyDigest', 'createAny:caregiverDailyDigest'),
    validate(caregiverDailyDigestValidation.createDigest),
    caregiverDailyDigestController.createDigest
  )
  .get(
    auth('readOwn:caregiverDailyDigest', 'readAny:caregiverDailyDigest'),
    validate(caregiverDailyDigestValidation.listDigests),
    caregiverDailyDigestController.listDigests
  );

router
  .route('/:digestId')
  .get(
    auth('readOwn:caregiverDailyDigest', 'readAny:caregiverDailyDigest'),
    validate(caregiverDailyDigestValidation.digestIdParam),
    caregiverDailyDigestController.getDigest
  );

module.exports = router;
