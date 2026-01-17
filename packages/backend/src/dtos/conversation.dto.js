// conversation.dto.js
const { ObjectId } = require('mongodb');
const { SentimentAnalysisDTO } = require('./sentiment.dto');
const logger = require('../config/logger');

const ConversationDTO = (conversation) => {
  // Convert Mongoose document to plain object if needed
  // This ensures we can safely access all fields without triggering toJSON transformation
  // which could convert _id to id and delete _id before we can access it
  const conversationObj = conversation && typeof conversation.toObject === 'function' 
    ? conversation.toObject({ virtuals: false, getters: false }) 
    : conversation;
  
  if (!conversationObj) {
    throw new Error('ConversationDTO received null or undefined conversation');
  }
  
  const { _id, callSid, patientId, lineItemId, messages, history, analyzedData, metadata, startTime, endTime, duration, callStatus, callStartTime, callEndTime, callDuration, callOutcome, callNotes, agentId, status } =
    conversationObj;

  // Convert _id (ObjectId) to string, or use id if already converted by toJSON plugin
  // Priority: conversation.id (if already transformed) > _id.toString() > _id (if already string)
  // MongoDB ALWAYS assigns _id to saved documents, so one of these should always exist
  let id = null;
  
  if (conversation.id) {
    // Already transformed by toJSON plugin (has 'id', no '_id')
    id = typeof conversation.id === 'string' ? conversation.id : conversation.id.toString();
  } else if (_id !== undefined && _id !== null) {
    // Raw Mongoose document (has '_id', no 'id')
    // _id could be ObjectId, string, or already converted
    if (typeof _id === 'object' && _id.toString) {
      id = _id.toString();
    } else if (typeof _id === 'string') {
      id = _id;
    } else {
      id = String(_id);
    }
  }
  
  // This should NEVER happen for documents saved in MongoDB
  // If it does, it means the conversation object is malformed or wasn't saved properly
  if (!id || id === 'null' || id === 'undefined') {
    const errorDetails = {
      has_id: !!conversation.id,
      id_value: conversation.id,
      has__id: _id !== undefined && _id !== null,
      _id_value: _id,
      _id_type: typeof _id,
      conversation_type: conversation.constructor?.name || typeof conversation,
      conversation_keys: Object.keys(conversation || {}),
      patientId: patientId?.toString(),
      callSid,
      isMongooseDoc: conversation.constructor?.name === 'model' || conversation._id !== undefined,
    };
    logger.error('[ConversationDTO] CRITICAL: Conversation missing valid ID!', errorDetails);
    // Throw error to prevent conversations without IDs from being sent to frontend
    throw new Error(`Conversation must have an ID. This indicates a data integrity issue. Details: ${JSON.stringify(errorDetails)}`);
  }
  
  // Convert ObjectId fields to strings if needed
  const patientIdStr = patientId ? (patientId instanceof ObjectId ? patientId.toString() : (patientId.toString ? patientId.toString() : patientId)) : null;
  const agentIdStr = agentId ? (agentId instanceof ObjectId ? agentId.toString() : (agentId.toString ? agentId.toString() : agentId)) : null;
  const lineItemIdStr = lineItemId ? (lineItemId instanceof ObjectId ? lineItemId.toString() : (lineItemId.toString ? lineItemId.toString() : lineItemId)) : null;

  return {
    id,
    callSid,
    patientId: patientIdStr,
    lineItemId: lineItemIdStr,
    messages,
    history,
    analyzedData,
    metadata,
    startTime: startTime ? new Date(startTime).toISOString() : null,
    endTime: endTime ? new Date(endTime).toISOString() : null,
    duration,
    callStatus,
    callStartTime: callStartTime ? new Date(callStartTime).toISOString() : null,
    callEndTime: callEndTime ? new Date(callEndTime).toISOString() : null,
    callDuration,
    callOutcome,
    callNotes,
    agentId: agentIdStr,
    status,
    // Include sentiment analysis if available
    sentiment: analyzedData?.sentiment ? SentimentAnalysisDTO(analyzedData.sentiment) : null,
    sentimentAnalyzedAt: analyzedData?.sentimentAnalyzedAt ? new Date(analyzedData.sentimentAnalyzedAt).toISOString() : null,
  };
};

module.exports = ConversationDTO;
