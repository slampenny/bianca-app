const mongoose = require('mongoose');

/**
 * Build in-memory conversation objects with populated patient (client) messages only.
 * LLM/assistant turns are omitted — analysis uses client role messages.
 */
function buildPatientConversations(messageContents) {
  const contents = Array.isArray(messageContents) ? messageContents : [messageContents];
  const base = Date.now();
  return [
    {
      _id: new mongoose.Types.ObjectId(),
      messages: contents.map((content, index) => ({
        role: 'client',
        content,
        createdAt: new Date(base + index * 60_000),
      })),
      createdAt: new Date(base),
    },
  ];
}

module.exports = {
  buildPatientConversations,
};
