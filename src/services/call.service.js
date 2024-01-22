const httpStatus = require('http-status');
const { Call } = require('../models');
const ApiError = require('../utils/ApiError');

const initiateCall = async (callBody) => {
  // Logic to initiate a call goes here (e.g., integration with telephony service)
  const call = new Call(callBody);
  await call.save();
  return call;
};

const getCallById = async (id) => {
  const call = await Call.findById(id);
  if (!call) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Call not found');
  }
  return call;
};

module.exports = {
  initiateCall,
  getCallById,
};
