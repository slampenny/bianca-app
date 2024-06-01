const passport = require('passport');
const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const config = require('../config/config');
const { ac } = require('../config/roles'); 
const ownershipChecks = require('../utils/ownershipChecks');
const logger = require('../config/logger');

const verifyCallback = (req, resolve, reject, requiredRights) => async (err, caregiver, info) => {
    if (err || info || !caregiver) {
        logger.info(err || 'JWT token not valid');
        return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
    }
    req.caregiver = caregiver;
    
    if (!caregiver.role) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Caregiver role is not set');
    }

    if (caregiver.role === 'superAdmin') {
        return resolve();
    }

    // If no required rights are provided, resolve immediately after authentication
    if (requiredRights.length === 0) {
        return resolve();
    }

    const resource = requiredRights[0].split(':')[1];
    const resourceId = req.params[`${resource}Id`];

    for (let permission of requiredRights) {
        const [action] = permission.split(':');

        try {
            const result = ac.can(caregiver.role)[action](resource);
            
            if (result.granted) {
                // If any "Any" permission is granted, resolve immediately
                if (action.includes('Any')) {
                    return resolve();
                }

                // If "Own" permission is required but not granted, check ownership
                if (action.includes('Own')) {
                    const isOwner = ownershipChecks[resource](caregiver, resourceId);
                    if (isOwner) {
                        // If the user is the owner, resolve the promise
                        return resolve();
                    }
                }
            }
        } catch (error) {
            return reject(new ApiError(httpStatus.INTERNAL_SERVER_ERROR, JSON.stringify(error)));
        }
    }

    // If no permissions match, reject with insufficient permissions error
    return reject(new ApiError(httpStatus.FORBIDDEN, 'Access Denied: You do not have sufficient permissions.'));
};

const auth = (...requiredRights) => async (req, res, next) => {
    if (!config.authEnabled) {
        return next();
    }

    try {
        await new Promise((resolve, reject) => {
            passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject, requiredRights))(req, res, next);
        });
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = auth;
