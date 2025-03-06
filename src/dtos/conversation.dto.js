// conversation.dto.js

const ConversationDTO = (conversation) => {
    
    const { 
        _id, 
        callSid,
        patientId,
        lineItemId,
        messages,
        history,
        analyzedData,
        metadata,
        startTime,
        endTime,
        duration, 
    } = conversation;
  
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
    };
  };
  
  module.exports = ConversationDTO;