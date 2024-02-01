const express = require('express');
const authRoute = require('./auth.route');
const callRoute = require('./call.route');
const conversationRoute = require('./conversation.route');
const reportRoute = require('./report.route');
const scheduleRoute = require('./schedule.route');
const userRoute = require('./user.route');
const twilioRoute = require('./twilioCall.route');
const docsRoute = require('./docs.route');
const config = require('../../config/config');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/calls',
    route: callRoute,
  },
  {
    path: '/conversations',
    route: conversationRoute,
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
  {
    path: '/users',
    route: userRoute,
  },
];

const devRoutes = [
  // routes available only in development mode
  {
    path: '/docs',
    route: docsRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === 'development') {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

module.exports = router;
