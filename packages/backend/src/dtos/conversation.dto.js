// conversation.dto.js
const { ObjectId } = require('mongodb');
const { SentimentAnalysisDTO } = require('./sentiment.dto');

const ConversationDTO = (conversation) => {
  const { _id, callSid, patientId, lineItemId, messages, history, analyzedData, metadata, startTime, endTime, duration, callStatus, callStartTime, callEndTime, callDuration, callOutcome, callNotes, agentId, status } =
    conversation;

  // Convert _id (ObjectId) to string, or use id if already converted by toJSON plugin
  const id = _id ? (_id.toString ? _id.toString() : _id) : (conversation.id || null);
  
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
