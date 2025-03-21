const express = require('express');
const i18n = require('i18n');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const cors = require('cors');
const passport = require('passport');
const bodyParser = require('body-parser');
const httpStatus = require('http-status');
const config = require('./config/config');
const morgan = require('./config/morgan');
const { jwtStrategy } = require('./config/passport');
const { authLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');
const logger = require('./config/logger');

const app = express();
// Trust proxy headers
app.set('trust proxy', true);

// i18n configuration
i18n.configure({
  locales: ['en', 'es'],
  directory: __dirname + '/locales',
  objectNotation: true,
  logWarnFn: function(msg) {
    // do nothing
  },
});

app.use(i18n.init); // This middleware attaches the i18n object to the request

//if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
//}

// Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));

// sanitize request data
app.use(xss());
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// enable cors
app.use(cors());
app.options('*', cors());

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

app.use(express.json({ limit: '50mb' }));

// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  app.use('/v1/auth', authLimiter);
}

// set security HTTP headers
app.use(helmet());

// v1 api routes
app.use('/v1', routes);

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Log incoming requests
app.use((req, res, next) => {
  //console.log(`Incoming request: ${req.method} ${req.url}`);
  logger.debug(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

require('./agenda');

module.exports = app;
