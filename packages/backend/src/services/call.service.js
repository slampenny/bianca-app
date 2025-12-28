const httpStatus = require('http-status');
const { Patient } = require('../models'); // Assuming Patient model includes phone number
// Note: openAiService methods are now in openai.realtime.service.js
// This service may need to be updated to use the new service structure
const config = require('../config/config');
const { Call } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

const getCallById = async (id) => {
  const call = await Call.findById(id);
  if (!call) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Call not found');
  }
  return call;
};

/**
 * Processes the recorded speech from a call
 * @param {String} callSid - The SID of the Twilio call
 * @param {String} recordingUrl - The URL of the call recording
 */
const processCallRecording = async (callSid, recordingUrl) => {
  // TODO: Update to use openai.realtime.service or openai.sentiment.service
  // This function needs to be refactored to use the current OpenAI service structure
  throw new ApiError(httpStatus.NOT_IMPLEMENTED, 'processCallRecording needs to be updated to use new OpenAI service structure');
};

/**
 * Sends a text response as a voice message in a call
 * @param {String} callSid - The SID of the Twilio call
 * @param {String} textResponse - The text response to be converted to speech
 */
const sendResponseAsCall = async (callSid, textResponse) => {
  // TODO: Update to use current Twilio service structure
  // This function needs to be refactored to use the current Twilio service
  throw new ApiError(httpStatus.NOT_IMPLEMENTED, 'sendResponseAsCall needs to be updated to use new service structure');
};

/**
 * Get the last contact time for a patient (most recent completed call)
 * @param {string} patientId - The patient ID
 * @returns {Date|null} - The endTime of the most recent completed call, or null if none found
 */
const getLastContactTime = async (patientId) => {
  try {
    // Query Calls directly instead of going through Conversations
    const lastCall = await Call.findOne({
      patientId,
      status: 'completed',
      endTime: { $exists: true }
    })
    .sort({ endTime: -1 }) // Most recent first
    .select('endTime')
    .lean();
    
    return lastCall?.endTime || null;
  } catch (err) {
    logger.error(`[Last Contact Time] Error: ${err.message}`);
    return null;
  }
};

module.exports = {
  getCallById,
  processCallRecording,
  sendResponseAsCall,
  getLastContactTime,
};
