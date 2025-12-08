class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
    // Allow custom properties to be set on ApiError instances
    // This is needed for SSO account linking errors (requiresPasswordLinking, ssoProvider)
  }
}

module.exports = ApiError;
