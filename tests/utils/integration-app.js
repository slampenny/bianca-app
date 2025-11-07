// Integration test app that includes only essential routes and avoids timeout-causing services
const express = require('express');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const cors = require('cors');
const passport = require('passport');
const bodyParser = require('body-parser');
const httpStatus = require('http-status');
const config = require('../../src/config/config');
const { jwtStrategy } = require('../../src/config/passport');
const { errorConverter, errorHandler } = require('../../src/middlewares/error');
const ApiError = require('../../src/utils/ApiError');

// Import only the routes we need for integration tests
const authRoute = require('../../src/routes/v1/auth.route');
const caregiverRoute = require('../../src/routes/v1/caregiver.route');
const orgRoute = require('../../src/routes/v1/org.route');
const patientRoute = require('../../src/routes/v1/patient.route');
const paymentRoute = require('../../src/routes/v1/payment.route');
const paymentMethodRoute = require('../../src/routes/v1/paymentMethod.route');
const conversationRoute = require('../../src/routes/v1/conversation.route');
const alertRoute = require('../../src/routes/v1/alert.route');
const scheduleRoute = require('../../src/routes/v1/schedule.route');
const callWorkflowRoute = require('../../src/routes/v1/callWorkflow.route');
const sentimentRoute = require('../../src/routes/v1/sentiment.route');
const docsRoute = require('../../src/routes/v1/docs.route');
const medicalAnalysisRoute = require('../../src/routes/v1/medicalAnalysis.route');
const emergencyPhraseRoute = require('../../src/routes/v1/emergencyPhrase.route');
const mfaRoute = require('../../src/routes/v1/mfa.route');
// const testRoute = require('../../src/routes/v1/test.route'); // Skip test route to avoid timeout issues

const app = express();

// Basic health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: config.env
  });
});

// Trust proxy headers
app.set('trust proxy', true);

// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// Sanitize request data
app.use(xss());
app.use(mongoSanitize());

// Gzip compression
app.use(compression());

// Enable CORS
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// JWT authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

app.use(express.json({ limit: '50mb' }));

// Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "wss:", "https://app.myphonefriend.com", "https://api.myphonefriend.com"]
    }
  }
}));

// v1 API routes (only essential routes for integration testing)
const router = express.Router();
router.use('/auth', authRoute);
router.use('/caregivers', caregiverRoute);
router.use('/orgs', orgRoute);
router.use('/patients', patientRoute);
router.use('/payments', paymentRoute);
router.use('/payment-methods', paymentMethodRoute);
router.use('/conversations', conversationRoute);
router.use('/alerts', alertRoute);
router.use('/schedules', scheduleRoute);
router.use('/calls', callWorkflowRoute);
router.use('/sentiment', sentimentRoute);
router.use('/docs', docsRoute);
router.use('/medical-analysis', medicalAnalysisRoute);
router.use('/emergency-phrases', emergencyPhraseRoute);
router.use('/mfa', mfaRoute);
// router.use('/test', testRoute); // Skip test route to avoid timeout issues

app.use('/v1', router);

// 404 handler for unknown routes
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// Error conversion and handling
app.use(errorConverter);
app.use(errorHandler);

module.exports = app;
