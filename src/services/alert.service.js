const mongoose = require('mongoose');
const httpStatus = require('http-status');
const { Alert, Caregiver } = require('../models');
const ApiError = require('../utils/ApiError');

const createAlert = async (alertData) => {
    return await Alert.create(alertData);
};

const getAlertById = async (alertId, caregiverId) => {
    const alert = await Alert.findOne({
        _id: alertId,
        relevanceUntil: { $gte: new Date() }  // Ensure the alert is still relevant
    });

    if (!alert) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Alert not found');
    }

    // Optionally check if the alert has been read by this caregiver, if required
    if (alert.readBy && alert.readBy.includes(caregiverId)) {
        throw new ApiError(httpStatus.FORBIDDEN, 'Alert has already been read');
    }

    return alert;
};

const getAlerts = async (caregiverId, showRead = false) => {
  if (!mongoose.Types.ObjectId.isValid(caregiverId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiverId format');
  }
  
  const caregiver = await Caregiver.findById(caregiverId)
    .populate({ path: 'org', select: 'caregivers' })
    .populate({ path: 'patients', select: '_id' });
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  const objectCaregiverId = new mongoose.Types.ObjectId(caregiverId); // Convert caregiverId to ObjectId

  let visibilityConditions;
  if (caregiver.role === 'orgAdmin') {
    visibilityConditions = { $in: ['orgAdmin', 'allCaregivers'] };
  } else if (caregiver.role === 'staff') {
    visibilityConditions = { $eq: 'allCaregivers' };
  } else {
    visibilityConditions = { $eq: 'none' };
  }

  const baseConditions = {
    $and: [
      {
        $or: [
          { createdBy: caregiver._id },
          { createdBy: { $in: caregiver.org.caregivers }, visibility: visibilityConditions },
          { createdBy: { $in: caregiver.patients.map(pt => pt._id) }, visibility: 'assignedCaregivers' }
        ]
      },
      { relevanceUntil: { $gte: new Date() } } // ADDED RELEVANCE FILTER
    ]
  };

  if (showRead) {
    const alerts = await Alert.find(baseConditions);
    return alerts;
  } else {
    // Only include alerts that have NOT been read by the caregiver.
    const conditions = {
      $and: [
        baseConditions,
        { readBy: { $not: { $elemMatch: { $eq: objectCaregiverId } } } } // Use ObjectId for comparison
      ]
    };
    const alerts = await Alert.find(conditions);
    return alerts;
  }
};

const updateAlertById = async (alertId, updateBody) => {
    const alert = await Alert.findById(alertId);
    if (!alert) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Alert not found');
    }
    Object.assign(alert, updateBody);
    await alert.save();
    return alert;
};

const markAlertAsRead = async (alertId, caregiverId) => {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Alert not found');
  }
  const objectCaregiverId = new mongoose.Types.ObjectId(caregiverId); // Convert to ObjectId
  if (!alert.readBy.some(id => id.equals(objectCaregiverId))) { // Use .equals() for ObjectId comparison
    alert.readBy.push(objectCaregiverId);
    await alert.save();
  }
  return alert;
};

const deleteAlertById = async (alertId) => {
    const alert = await Alert.findByIdAndDelete(alertId);
    return alert;
};

module.exports = {
    createAlert,
    getAlertById,
    getAlerts,
    markAlertAsRead,
    updateAlertById,
    deleteAlertById
};
