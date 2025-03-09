const express = require('express');
const alertRoute = require('./alert.route');
const authRoute = require('./auth.route');
const caregiverRoute = require('./caregiver.route');
const conversationRoute = require('./conversation.route');
const orgRoute = require('./org.route');
const patientRoute = require('./patient.route');
const reportRoute = require('./report.route');
const scheduleRoute = require('./schedule.route');
const testRoute = require('./test.route');
const twilioRoute = require('./twilioCall.route');
const docsRoute = require('./docs.route');
const config = require('../../config/config');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/alerts',
    route: alertRoute,
  },
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/caregivers',
    route: caregiverRoute,
  },
  {
    path: '/conversations',
    route: conversationRoute,
  },
  {
    path: '/orgs',
    route: orgRoute,
  },
  {
    path: '/patients',
    route: patientRoute,
  },
  {
    path: '/reports',
    route: reportRoute,
  },
  {
    path: '/schedules',
    route: scheduleRoute,
  },
  {
    path: '/twilio',
    route: twilioRoute,
  },
];

const devRoutes = [
  // routes available only in development mode
  {
    path: '/docs',
    route: docsRoute,
  },
  {
    path: '/test',
    route: testRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === 'development' || config.env === 'test') {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

router.get('/health', (req, res) => {
  res.status(200).send('OK');
});

module.exports = router;
