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
    const caregiver = await Caregiver.findById(caregiverId)
      .populate({ path: 'org', select: 'caregivers' }) // Assuming 'caregivers' is an array of IDs
      .populate({ path: 'patients', select: '_id' }); // Only populate patient IDs
  
    if (!caregiver) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
    }
  
    let visibilityConditions;
    if (caregiver.role === 'orgAdmin') {
      // Org admins see alerts for all caregivers and orgAdmin-specific alerts
      visibilityConditions = { $in: ['orgAdmin', 'allCaregivers'] };
    } else if (caregiver.role === 'staff') {
      // Regular staff see only alerts for all caregivers
      visibilityConditions = { $eq: 'allCaregivers' };
    } else {
      // 'invited' role or any other roles not specified shouldn't see any alerts
      visibilityConditions = { $eq: 'none' }; // 'none' is a placeholder; adjust as needed
    }
  
    // Original conditions for relevant alerts
    const baseConditions = {
      $or: [
        { createdBy: caregiver._id },
        { createdBy: { $in: caregiver.org.caregivers }, visibility: visibilityConditions },
        { createdBy: { $in: caregiver.patients.map(pt => pt._id) }, visibility: 'assignedCaregivers' }
      ],
 //     relevanceUntil: { $gte: new Date() }
    };
  
    if (!showRead) {
      // Combine the base conditions with an extra condition ensuring the alert hasn't been read
      // using an $and operator.
      const unreadCondition = {
        $or: [
          { readBy: { $exists: false } },
          { readBy: { $eq: [] } },
          { readBy: { $not: { $elemMatch: { $eq: caregiverId } } } }
        ]
      };
      // Final query requires both base conditions and the unread condition.
      const conditions = { $and: [baseConditions, unreadCondition] };
      const alerts = await Alert.find(conditions);
      return alerts;
    } else {
      // If showRead is true, just use base conditions.
      const alerts = await Alert.find(baseConditions);
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
    if (!alert.readBy.includes(caregiverId)) {
        alert.readBy.push(caregiverId);
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
