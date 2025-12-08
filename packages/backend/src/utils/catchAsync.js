const httpStatus = require('http-status');
const ApiError = require('./ApiError');

const catchAsync = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch((err) => {
    // Always pass errors to the error middleware
    // This ensures custom properties (like requiresPasswordLinking) are preserved
    if (err instanceof ApiError) {
      // Pass ApiError to error middleware (which will preserve custom properties)
      next(err);
    } else {
      // If the error is not an ApiError, convert it into one and pass it to the next middleware
      const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
      const message = err.message || httpStatus[statusCode];
      const apiError = new ApiError(statusCode, message, false, err.stack);
      
      // Preserve custom properties from original error
      if (err.requiresPasswordLinking !== undefined) {
        apiError.requiresPasswordLinking = err.requiresPasswordLinking;
      }
      if (err.ssoProvider !== undefined) {
        apiError.ssoProvider = err.ssoProvider;
      }
      
      next(apiError);
    }
  });
};

module.exports = catchAsync;
