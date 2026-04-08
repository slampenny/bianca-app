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
const phoneVerificationRoute = require('./phoneVerification.route');
const clientRoute = require('./client.route');
const paymentRoute = require('./payment.route');
const paymentMethodRoute = require('./paymentMethod.route');
const privacyRoute = require('./privacy.route');
const reportRoute = require('./report.route');
const familyWeeklyDigestRoute = require('./familyWeeklyDigest.route');
const caregiverDailyDigestRoute = require('./caregiverDailyDigest.route');
const facilityReportsRoute = require('./facilityReports.route');
const activityRoute = require('./activity.route');
const adminRoute = require('./admin.route');
const scimRoute = require('./scim.route');
const scheduleRoute = require('./schedule.route');
const sentimentRoute = require('./sentiment.route');
const ssoRoute = require('./sso.route');
const stripeRoute = require('./stripe.route');
const testRoute = require('./test.route');
const twilioRoute = require('./twilioCall.route');
const callWorkflowRoute = require('./callWorkflow.route');
const demoRoute = require('./demo.route');
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
    path: '/clients',
    route: clientRoute,
  },
  {
    path: '/phone-verification',
    route: phoneVerificationRoute,
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
    path: '/privacy',
    route: privacyRoute,
  },
  {
    path: '/reports',
    route: reportRoute,
  },
  {
    path: '/family-weekly-digests',
    route: familyWeeklyDigestRoute,
  },
  {
    path: '/caregiver-daily-digests',
    route: caregiverDailyDigestRoute,
  },
  {
    path: '/facility-reports',
    route: facilityReportsRoute,
  },
  {
    path: '/activity',
    route: activityRoute,
  },
  {
    path: '/admin',
    route: adminRoute,
  },
  {
    path: '/scim',
    route: scimRoute,
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
    path: '/twilio',
    route: twilioRoute,
  },
  {
    path: '/demo',
    route: demoRoute,
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
