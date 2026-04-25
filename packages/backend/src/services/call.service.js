const httpStatus = require('http-status');
const mongoose = require('mongoose');
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
 * Get the last contact time for a client (most recent completed call)
 * @param {string} clientId - The client ID
 * @returns {Date|null} - The endTime of the most recent completed call, or null if none found
 */
const getLastContactTime = async (clientId) => {
  try {
    // Query Calls directly instead of going through Conversations
    const lastCall = await Call.findOne({
      clientId,
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

/**
 * Latest call attempt (any outcome) and latest answered call per client, in one round-trip.
 * @param {import('mongoose').Types.ObjectId[]|string[]} clientIds
 * @returns {Promise<Record<string, { lastCallAttemptAt: Date|null, lastAnsweredCallAt: Date|null }>>}
 */
const getLastCallTimestampsForClientIds = async (clientIds) => {
  const empty = {};
  if (!clientIds?.length) {
    return empty;
  }
  const ids = clientIds
    .map((id) => {
      if (!id) return null;
      const raw = id._id ?? id;
      if (mongoose.Types.ObjectId.isValid(raw)) {
        return new mongoose.Types.ObjectId(raw);
      }
      return null;
    })
    .filter(Boolean);

  if (!ids.length) {
    return empty;
  }

  try {
    const [attempts, answered] = await Promise.all([
      Call.aggregate([
        { $match: { clientId: { $in: ids } } },
        { $group: { _id: '$clientId', lastCallAttemptAt: { $max: '$startTime' } } },
      ]),
      Call.aggregate([
        {
          $match: {
            clientId: { $in: ids },
            callOutcome: 'answered',
          },
        },
        {
          $addFields: {
            answeredAt: {
              $ifNull: ['$endTime', { $ifNull: ['$callEndTime', '$startTime'] }],
            },
          },
        },
        { $match: { answeredAt: { $ne: null } } },
        { $group: { _id: '$clientId', lastAnsweredCallAt: { $max: '$answeredAt' } } },
      ]),
    ]);

    const map = {};
    attempts.forEach((row) => {
      const key = row._id.toString();
      map[key] = { ...(map[key] || {}), lastCallAttemptAt: row.lastCallAttemptAt || null };
    });
    answered.forEach((row) => {
      const key = row._id.toString();
      map[key] = { ...(map[key] || {}), lastAnsweredCallAt: row.lastAnsweredCallAt || null };
    });
    return map;
  } catch (err) {
    logger.error(`[Last call timestamps] Error: ${err.message}`);
    return empty;
  }
};

/**
 * Paginate calls for a client (source of truth for time ordering / billing). Populates conversation + messages when present.
 * @param {string|import('mongoose').Types.ObjectId} clientId
 * @param {{ limit?: number|string, page?: number|string, sortBy?: string }} options
 */
const queryCallsByClient = async (clientId, options = {}) => {
  const limit = options.limit && parseInt(String(options.limit), 10) > 0 ? parseInt(String(options.limit), 10) : 10;
  const page = options.page && parseInt(String(options.page), 10) > 0 ? parseInt(String(options.page), 10) : 1;
  const skip = (page - 1) * limit;
  const filter = { clientId };

  const [totalResults, results] = await Promise.all([
    Call.countDocuments(filter).exec(),
    Call.find(filter)
      .sort({ startTime: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'conversationId',
        populate: { path: 'messages' },
      })
      .exec(),
  ]);

  const totalPages = limit > 0 ? Math.ceil(totalResults / limit) : 0;

  return {
    results,
    page,
    limit,
    totalPages,
    totalResults,
  };
};

module.exports = {
  getCallById,
  processCallRecording,
  sendResponseAsCall,
  getLastContactTime,
  getLastCallTimestampsForClientIds,
  queryCallsByClient,
};
