// auth.js with error handling fix
const httpStatus = require('http-status');
const passport = require('passport');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');
const ownershipChecks = require('../utils/ownershipChecks');
const {ac} = require('../config/roles');

const verifyCallback = (req, resolve, reject, requiredRights) => async (err, caregiver, info) => {
    if (err || info || !caregiver) {
        logger.info(err || 'JWT token not valid');
        return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
    }
    req.caregiver = caregiver;
   
    if (!caregiver.role) {
        // Changed from throw to reject to maintain Promise flow
        return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Caregiver role is not set'));
    }
    if (caregiver.role === 'superAdmin') {
        return resolve();
    }
    // If no required rights are provided, resolve immediately after authentication
    if (requiredRights.length === 0) {
        return resolve();
    }
    
    try {
        const resource = requiredRights[0].split(':')[1];
        const resourceId = req.params[`${resource}Id`];
        
        for (let permission of requiredRights) {
            const [action] = permission.split(':');
            
            const result = ac.can(caregiver.role)[action](resource);
               
            if (result.granted) {
                // If any "Any" permission is granted, resolve immediately
                if (action.includes('Any')) {
                    return resolve();
                }
                // If "Own" permission is required but not granted, check ownership
                if (action.includes('Own')) {
                    // Make sure ownershipChecks[resource] exists before calling
                    if (!ownershipChecks[resource]) {
                        logger.error(`No ownership check function found for resource: ${resource}`);
                        return reject(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Server configuration error'));
                    }
                    
                    const isOwner = ownershipChecks[resource](caregiver, resourceId);
                    if (isOwner) {
                        // If the user is the owner, resolve the promise
                        return resolve();
                    }
                }
            }
        }
        
        // If no permissions match, reject with insufficient permissions error
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