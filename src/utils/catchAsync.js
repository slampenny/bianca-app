const httpStatus = require('http-status');
const ApiError = require('./ApiError');

const catchAsync = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch((err) => {
    if (err instanceof ApiError) {
      // If the error is an ApiError, send it as a response
      res.status(err.statusCode).json({ message: err.message });
    } else {
      // If the error is not an ApiError, convert it into one and pass it to the next middleware
      const statusCode = err.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
      const message = err.message || httpStatus[statusCode];
      err = new ApiError(statusCode, message, false, err.stack);
      next(err);
    }
  });
};

module.exports = catchAsync;
