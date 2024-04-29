const passport = require('passport');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const { roleRights } = require('../config/roles');

const verifyCallback = (req, resolve, reject, requiredRights) => async (err, caregiver, info) => {
  if (err || info || !caregiver) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
  }
  req.caregiver = caregiver;

  if (requiredRights.length) {
    const caregiverRights = roleRights.get(caregiver.role);
    const hasRequiredRights = requiredRights.every((requiredRight) => caregiverRights.includes(requiredRight));
    if (!hasRequiredRights && req.params.caregiverId !== caregiver.id) {
      return reject(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
    }
  }

  resolve();
};

const auth = (...requiredRights) => async (req, res, next) => {
  if (!config.authEnabled) {
    return next();
  }

  return new Promise((resolve, reject) => {
    passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject, requiredRights))(req, res, next);
  })
    .then(() => next())
    .catch((err) => next(err));
};

module.exports = auth;
