// conversation.dto.js
const { ObjectId } = require('mongodb');
const { SentimentAnalysisDTO } = require('./sentiment.dto');
const logger = require('../config/logger');

const ConversationDTO = (conversation) => {
  // First check if conversation has runtime-set properties (like status from call data)
  // These are set by controllers but not persisted, so toObject() would lose them
  const hasRuntimeProperties = conversation && (
    conversation.status !== undefined || 
    conversation.callStatus !== undefined ||
    conversation.callNotes !== undefined
  );
  
  // Convert Mongoose document to plain object if needed, but preserve runtime properties
  // This ensures we can safely access all fields without triggering toJSON transformation
  // which could convert _id to id and delete _id before we can access it
  // 
  // CRITICAL: Use depopulate to convert populated refs (like callId) back to IDs
  // This prevents issues where callId population can cause clientId to become undefined
  // BUT we need to preserve populated messages since those should remain as objects
  // AND we need to preserve clientId before depopulation in case it gets lost
  const preserveMessages = conversation && conversation.messages && 
    Array.isArray(conversation.messages) && 
    conversation.messages.length > 0 && 
    conversation.messages[0] && 
    typeof conversation.messages[0] === 'object' && 
    conversation.messages[0].content !== undefined;
  
  // Preserve clientId BEFORE toObject/depopulate in case it gets lost
  const originalClientId = conversation?.clientId;
  
  // Debug logging to understand clientId loss
  if (conversation && !originalClientId) {
    logger.warn('[ConversationDTO] WARN: conversation has no clientId before toObject', {
      conversationId: conversation._id || conversation.id,
      hasCallId: !!conversation.callId,
      callIdType: typeof conversation.callId,
      keys: Object.keys(conversation),
    });
  }
    
  const conversationObj = conversation && typeof conversation.toObject === 'function' && !hasRuntimeProperties
    ? conversation.toObject({ virtuals: false, getters: false, depopulate: true })
    : conversation;
    
  // Restore populated messages if they were depopulated
  if (preserveMessages && conversationObj) {
    conversationObj.messages = conversation.messages;
  }
  
  // Restore clientId if it was lost during toObject/depopulate
  if (originalClientId && conversationObj && !conversationObj.clientId) {
    logger.info('[ConversationDTO] Restoring clientId that was lost during toObject', {
      conversationId: conversationObj._id || conversationObj.id,
      originalClientId: originalClientId.toString ? originalClientId.toString() : originalClientId,
    });
    // Convert to string if it's an ObjectId
    conversationObj.clientId = originalClientId.toString ? originalClientId.toString() : originalClientId;
  }
  
  // Debug: Check if clientId is still missing after restore
  if (conversationObj && !conversationObj.clientId && !originalClientId) {
    logger.error('[ConversationDTO] CRITICAL: clientId is missing and cannot be restored', {
      conversationId: conversationObj._id || conversationObj.id,
      hasCallId: !!conversationObj.callId,
      callIdType: typeof conversationObj.callId,
      keys: Object.keys(conversationObj),
    });
  }
  
  if (!conversationObj) {
    throw new Error('ConversationDTO received null or undefined conversation');
  }
  
  // CRITICAL: When callId is populated, Mongoose replaces it with the Call object
  // This can cause issues with destructuring. Use explicit access for clientId
  // to ensure we get the value even when other fields are populated
  const _id = conversationObj._id || conversation._id;
  const populatedCall =
    conversation && conversation.callId && typeof conversation.callId === 'object' && !Array.isArray(conversation.callId)
      ? conversation.callId
      : null;
  const callSid = conversationObj.callSid || conversation.callSid || (populatedCall && populatedCall.callSid);
  const clientId = conversationObj.clientId || conversation.clientId;
  const lineItemId = conversationObj.lineItemId || conversation.lineItemId || (populatedCall && populatedCall.lineItemId);
  const messages = conversationObj.messages || conversation.messages;
  const history = conversationObj.history || conversation.history;
  const analyzedData = conversationObj.analyzedData || conversation.analyzedData;
  const metadata = conversationObj.metadata || conversation.metadata;
  const startTime =
    conversationObj.startTime ||
    conversation.startTime ||
    (populatedCall && (populatedCall.startTime || populatedCall.callStartTime));
  const endTime =
    conversationObj.endTime ||
    conversation.endTime ||
    (populatedCall && (populatedCall.endTime || populatedCall.callEndTime));
  const duration =
    conversationObj.duration ||
    conversation.duration ||
    (populatedCall && (populatedCall.duration || populatedCall.callDuration));
  const callStatus = conversationObj.callStatus || conversation.callStatus || (populatedCall && populatedCall.callStatus);
  const callStartTime =
    conversationObj.callStartTime || conversation.callStartTime || (populatedCall && (populatedCall.callStartTime || populatedCall.startTime));
  const callEndTime =
    conversationObj.callEndTime || conversation.callEndTime || (populatedCall && (populatedCall.callEndTime || populatedCall.endTime));
  const callDuration =
    conversationObj.callDuration || conversation.callDuration || (populatedCall && (populatedCall.callDuration || populatedCall.duration));
  const callOutcome = conversationObj.callOutcome || conversation.callOutcome || (populatedCall && populatedCall.callOutcome);
  const callNotes = conversationObj.callNotes || conversation.callNotes || (populatedCall && populatedCall.callNotes);
  const caregiverIdRaw =
    conversationObj.caregiverId ||
    conversation.caregiverId ||
    (populatedCall && populatedCall.caregiverId) ||
    conversationObj.agentId ||
    conversation.agentId;
  const status = conversationObj.status || conversation.status || (populatedCall && populatedCall.status);

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
      clientId: clientId?.toString(),
      callSid,
      isMongooseDoc: conversation.constructor?.name === 'model' || conversation._id !== undefined,
    };
    logger.error('[ConversationDTO] CRITICAL: Conversation missing valid ID!', errorDetails);
    // Throw error to prevent conversations without IDs from being sent to frontend
    throw new Error(`Conversation must have an ID. This indicates a data integrity issue. Details: ${JSON.stringify(errorDetails)}`);
  }
  
  // Convert ObjectId fields to strings if needed
  const clientIdStr = clientId ? (clientId instanceof ObjectId ? clientId.toString() : (clientId.toString ? clientId.toString() : clientId)) : null;
  const caregiverIdStr = caregiverIdRaw
    ? caregiverIdRaw instanceof ObjectId
      ? caregiverIdRaw.toString()
      : caregiverIdRaw.toString
        ? caregiverIdRaw.toString()
        : caregiverIdRaw
    : null;
  const lineItemIdStr = lineItemId ? (lineItemId instanceof ObjectId ? lineItemId.toString() : (lineItemId.toString ? lineItemId.toString() : lineItemId)) : null;

  // Debug: Log if clientId conversion resulted in null/undefined
  if (!clientIdStr) {
    logger.warn('[ConversationDTO] clientId converted to null/undefined', {
      conversationId: id,
      clientId_value: clientId,
      clientId_type: typeof clientId,
      clientId_isObjectId: clientId instanceof ObjectId,
      clientId_hasToString: clientId && typeof clientId.toString === 'function',
    });
  }

  return {
    id,
    callSid,
    clientId: clientIdStr,
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
    caregiverId: caregiverIdStr,
    status,
    // Include sentiment analysis if available
    sentiment: analyzedData?.sentiment ? SentimentAnalysisDTO(analyzedData.sentiment) : null,
    sentimentAnalyzedAt: analyzedData?.sentimentAnalyzedAt ? new Date(analyzedData.sentimentAnalyzedAt).toISOString() : null,
  };
};

module.exports = ConversationDTO;
