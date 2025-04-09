const httpStatus = require('http-status');
const passport = require('passport');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const ownershipChecks = require('../utils/ownershipChecks');
const {ac} = require('../config/roles');

// Add this debugging helper function
const debugPermission = (caregiver, action, resource, result) => {
  logger.debug(`
    Permission check:
    - Caregiver role: ${caregiver.role}
    - Action: ${action}
    - Resource: ${resource}
    - Result: ${result ? 'Granted' : 'Denied'}
  `);
};

const verifyCallback = (req, resolve, reject, requiredRights) => async (err, caregiver, info) => {
    if (err || info || !caregiver) {
        logger.info(err || info || 'JWT token not valid');
        return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
    }
    req.caregiver = caregiver;
   
    if (!caregiver.role) {
        logger.error(`Caregiver ${caregiver.id} has no role assigned`);
        return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Caregiver role is not set'));
    }
    
    // Debug: Log the permission being checked
    logger.debug(`Auth middleware: Checking permissions for ${caregiver.role}, rights: ${JSON.stringify(requiredRights)}`);
    
    if (caregiver.role === 'superAdmin') {
        logger.debug('Caregiver is superAdmin, granting access');
        return resolve();
    }
    
    // If no required rights are provided, resolve immediately after authentication
    if (requiredRights.length === 0) {
        logger.debug('No required rights specified, granting access');
        return resolve();
    }
   
    try {
        const permission = requiredRights[0]; // Take the first permission
        const [action, resource] = permission.split(':');
        
        // Debug: Log the permission check
        logger.debug(`Checking if ${caregiver.role} can ${action} ${resource}`);
        const permissionObj = ac.can(caregiver.role);
        if (typeof permissionObj[action] !== 'function') {
            logger.error(`Permission method for action "${action}" is not defined for role "${caregiver.role}".`);
            return reject(new ApiError(httpStatus.FORBIDDEN, 'Authorization configuration error'));
        }

        // Check if this resource exists in AC configuration
        const permissionCheck = ac.can(caregiver.role)[action](resource);
        debugPermission(caregiver, action, resource, permissionCheck.granted);
        
        if (permissionCheck.granted) {
            logger.debug(`Permission ${permission} granted for ${caregiver.role}`);
            return resolve();
        }
        
        // If permission is not granted, log and reject
        logger.debug(`Permission ${permission} denied for ${caregiver.role}. Available permissions: ${JSON.stringify(ac.getGrants()[caregiver.role])}`);
        return reject(new ApiError(httpStatus.FORBIDDEN, 'Access Denied: You do not have sufficient permissions.'));
        
    } catch (error) {
        logger.error('Auth middleware error:', error);
        // Ensure the error is properly formatted
        return reject(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message || 'Authorization error'));
    }
};

// Your auth middleware that wraps this callback
const auth = (...requiredRights) => {
  return async (req, res, next) => {
    logger.debug(`Auth middleware called with rights: ${JSON.stringify(requiredRights)}`);
    
    return new Promise((resolve, reject) => {
      passport.authenticate(
        'jwt',
        { session: false },
        verifyCallback(req, resolve, reject, requiredRights)
      )(req, res, next);
    })
      .then(() => next())
      .catch((err) => next(err));
  };
};

module.exports = auth;