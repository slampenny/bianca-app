// alert.dto.js

const AlertDTO = (alert) => {
  const { 
    _id, 
    message, 
    importance, 
    alertType,
    relatedPatient,
    relatedConversation,
    createdBy, 
    createdModel, 
    visibility, 
    readBy, 
    relevanceUntil 
  } = alert;

  const id = _id;

  return {
    id,
    message,
    importance,
    alertType,
    relatedPatient,
    relatedConversation,
    createdBy,
    createdModel,
    visibility,
    readBy,
    relevanceUntil: relevanceUntil ? new Date(relevanceUntil).toISOString() : null,
  };
};

module.exports = AlertDTO;
