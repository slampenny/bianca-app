const express = require('express');
const alertRoute = require('./alert.route');
const authRoute = require('./auth.route');
const caregiverRoute = require('./caregiver.route');
const conversationRoute = require('./conversation.route');
const emergencyPhraseRoute = require('./emergencyPhrase.route');
const medicalAnalysisRoute = require('./medicalAnalysis.route');
const fraudAbuseAnalysisRoute = require('./fraudAbuseAnalysis.route');
const mfaRoute = require('./mfa.route');
const openaiRoute = require('./openai.route');
const orgRoute = require('./org.route');
const patientRoute = require('./patient.route');
const paymentRoute = require('./payment.route');
const paymentMethodRoute = require('./paymentMethod.route');
const reportRoute = require('./report.route');
const scheduleRoute = require('./schedule.route');
const sentimentRoute = require('./sentiment.route');
const ssoRoute = require('./sso.route');
const stripeRoute = require('./stripe.route');
const telemetryRoute = require('./telemetry.route');
const testRoute = require('./test.route');
const twilioRoute = require('./twilioCall.route');
const callWorkflowRoute = require('./callWorkflow.route');
const docsRoute = require('./docs.route');

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
    path: '/calls',
    route: callWorkflowRoute,
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
    path: '/emergency-phrases',
    route: emergencyPhraseRoute,
  },
  {
    path: '/medical-analysis',
    route: medicalAnalysisRoute,
  },
  {
    path: '/fraud-abuse-analysis',
    route: fraudAbuseAnalysisRoute,
  },
  {
    path: '/mfa',
    route: mfaRoute,
  },
  {
    path: '/openai',
    route: openaiRoute,
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
    path: '/payment-methods',
    route: paymentMethodRoute,
  },
  {
    path: '/payments',
    route: paymentRoute,
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
    path: '/sentiment',
    route: sentimentRoute,
  },
  {
    path: '/sso',
    route: ssoRoute,
  },
  {
    path: '/stripe',
    route: stripeRoute,
  },
  {
    path: '/telemetry',
    route: telemetryRoute,
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
// if (config.env === 'development' || config.env === 'test') {
devRoutes.forEach((route) => {
  router.use(route.path, route.route);
});
// }

module.exports = router;
