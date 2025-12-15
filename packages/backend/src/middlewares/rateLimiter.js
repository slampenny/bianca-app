const rateLimit = require('express-rate-limit');
const config = require('../config/config');

// Create a more permissive rate limiter for test environments
const createAuthLimiter = () => {
  // In test mode, use a very high limit to effectively disable rate limiting
  // This prevents test failures due to rate limiting while still having some protection
  if (config.env === 'test') {
    return rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10000, // Effectively unlimited for tests
      skipSuccessfulRequests: true,
      message: 'Too many requests, please try again later.',
    });
  }
  
  // Production rate limiter
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    skipSuccessfulRequests: true,
    message: 'Too many requests, please try again later.',
  });
};

const authLimiter = createAuthLimiter();

module.exports = {
  authLimiter,
};
