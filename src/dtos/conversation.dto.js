// conversation.dto.js

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
  };
};

module.exports = ConversationDTO;
