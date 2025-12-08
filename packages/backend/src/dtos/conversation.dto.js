// conversation.dto.js
const { SentimentAnalysisDTO } = require('./sentiment.dto');

const ConversationDTO = (conversation) => {
  const { _id, callSid, patientId, lineItemId, messages, history, analyzedData, metadata, startTime, endTime, duration, callStatus, callStartTime, callEndTime, callDuration, callOutcome, callNotes, agentId, status } =
    conversation;

  const id = _id;

  return {
    id,
    callSid,
    patientId,
    lineItemId,
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
    agentId,
    status,
    // Include sentiment analysis if available
    sentiment: analyzedData?.sentiment ? SentimentAnalysisDTO(analyzedData.sentiment) : null,
    sentimentAnalyzedAt: analyzedData?.sentimentAnalyzedAt ? new Date(analyzedData.sentimentAnalyzedAt).toISOString() : null,
  };
};

module.exports = ConversationDTO;
