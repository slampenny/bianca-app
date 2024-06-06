// alert.dto.js

const AlertDTO = (alert) => {
    const { _id, message, importance, createdBy, createdModel, visibility, readBy, relevanceUntil } = alert;
  
    const id = _id;
  
    return {
      id,
      message,
      importance,
      createdBy,
      createdModel,
      visibility,
      readBy,
      relevanceUntil,
    };
  };
  
  module.exports = AlertDTO;