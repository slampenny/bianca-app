const ConversationDTO = require('./conversation.dto');

/**
 * Facility list row: one Call, optionally with populated Conversation + messages.
 * Reuses ConversationDTO when a conversation exists so the client shape matches GET …/conversations.
 */
function CallListItemDTO(call) {
  if (!call) {
    throw new Error('Call is required');
  }
  const conv = call.conversationId;
  if (conv && (conv._id != null || conv.id != null)) {
    const plain = typeof conv.toObject === 'function' ? conv.toObject({ virtuals: false, getters: false }) : { ...conv };
    plain.callId = call;
    return ConversationDTO(plain);
  }

  const id = call._id.toString();
  const cid = call.clientId;
  const clientIdStr = cid ? (cid._id ? cid._id.toString() : cid.toString()) : null;

  return {
    id,
    callSid: call.callSid,
    clientId: clientIdStr,
    lineItemId: call.lineItemId ? String(call.lineItemId) : null,
    messages: [],
    history: null,
    analyzedData: {},
    metadata: {},
    startTime: call.startTime ? new Date(call.startTime).toISOString() : null,
    endTime: call.endTime ? new Date(call.endTime).toISOString() : null,
    duration: call.duration,
    callStatus: call.callStatus,
    callStartTime: (call.callStartTime || call.startTime) ? new Date(call.callStartTime || call.startTime).toISOString() : null,
    callEndTime: (call.callEndTime || call.endTime) ? new Date(call.callEndTime || call.endTime).toISOString() : null,
    callDuration: call.callDuration ?? call.duration,
    callOutcome: call.callOutcome,
    callNotes: call.callNotes,
    caregiverId: call.caregiverId ? String(call.caregiverId) : null,
    status: call.status,
    sentiment: null,
    sentimentAnalyzedAt: null,
  };
}

module.exports = CallListItemDTO;
