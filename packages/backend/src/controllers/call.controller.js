const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { callService } = require('../services');

const initiateCall = catchAsync(async (req, res) => {
  const call = await callService.initiateCall(req.body);
  res.status(httpStatus.CREATED).send(call);
});

const getCall = catchAsync(async (req, res) => {
  const call = await callService.getCallById(req.params.callId);
  if (!call) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Call not found');
  }
  res.send(call);
});

module.exports = {
  initiateCall,
  getCall,
};
