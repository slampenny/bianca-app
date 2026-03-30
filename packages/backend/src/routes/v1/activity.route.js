const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const activityValidation = require('../../validations/activity.validation');
const activityController = require('../../controllers/activity.controller');

const router = express.Router();

router.route('/calls-by-hour-today').get(
  auth('readOwn:facilityReport', 'readAny:facilityReport'),
  validate(activityValidation.getCallsByHourToday),
  activityController.getCallsByHourToday
);

router.route('/recent').get(
  auth('readOwn:facilityReport', 'readAny:facilityReport'),
  validate(activityValidation.getRecentActivity),
  activityController.getRecentActivity
);

module.exports = router;
