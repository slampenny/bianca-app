const mongoose = require('mongoose');
const httpStatus = require('http-status');
const { Alert, Caregiver } = require('../models');
const ApiError = require('../utils/ApiError');
const { translateAlertMessage, parseAlertMessage } = require('../utils/alertTranslations');

const createAlert = async (alertData) => {
  // For patient-type alerts, check if a similar alert already exists to prevent duplicates
  // This ensures the same alert never shows up more than once for a caregiver
  if (alertData.alertType === 'patient' && alertData.relatedPatient) {
    // Check for existing alert with same message, relatedPatient, and still relevant
    const existingAlert = await Alert.findOne({
      message: alertData.message,
      alertType: 'patient',
      relatedPatient: alertData.relatedPatient,
      visibility: alertData.visibility,
      relevanceUntil: { $gte: new Date() }, // Still relevant
    });

    if (existingAlert) {
      // Return existing alert instead of creating a duplicate
      return existingAlert;
    }
  }

  return await Alert.create(alertData);
};

const getAlertById = async (alertId, caregiverId) => {
  const alert = await Alert.findOne({
    _id: alertId,
    relevanceUntil: { $gte: new Date() }, // Ensure the alert is still relevant
  });

  if (!alert) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Alert not found');
  }

  // Optionally check if the alert has been read by this caregiver, if required
  if (alert.readBy && alert.readBy.includes(caregiverId)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Alert has already been read');
  }

  // Translate alert message based on caregiver's preferred language
  if (caregiverId) {
    const caregiver = await Caregiver.findById(caregiverId).select('preferredLanguage');
    if (caregiver && caregiver.preferredLanguage) {
      const alertData = parseAlertMessage(alert.message);
      if (alertData) {
        alert.message = translateAlertMessage(alert.message, caregiver.preferredLanguage, {
          severity: alertData.severity,
          category: alertData.category,
          phrase: alertData.phrase,
          patientName: alertData.patientName,
          originalText: alertData.originalText
        });
      }
    }
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
          { createdBy: { $in: caregiver.patients.map((pt) => pt._id) }, visibility: 'assignedCaregivers' },
        ],
      },
      { relevanceUntil: { $gte: new Date() } }, // ADDED RELEVANCE FILTER
    ],
  };

  let alerts;
  if (showRead) {
    alerts = await Alert.find(baseConditions);
  } else {
    // Only include alerts that have NOT been read by the caregiver.
    const conditions = {
      $and: [
        baseConditions,
        { readBy: { $not: { $elemMatch: { $eq: objectCaregiverId } } } }, // Use ObjectId for comparison
      ],
    };
    alerts = await Alert.find(conditions);
  }

  // MongoDB's find() already returns unique documents, so no deduplication needed
  // Duplicates are prevented at creation time in createAlert()

  // Translate alert messages based on caregiver's preferred language
  const caregiverLanguage = caregiver.preferredLanguage || 'en';
  if (caregiverLanguage !== 'en') {
    alerts = alerts.map(alert => {
      const alertData = parseAlertMessage(alert.message);
      if (alertData) {
        // Create a new object to avoid modifying the original Mongoose document
        const translatedAlert = alert.toObject();
        translatedAlert.message = translateAlertMessage(alert.message, caregiverLanguage, {
          severity: alertData.severity,
          category: alertData.category,
          phrase: alertData.phrase,
          patientName: alertData.patientName,
          originalText: alertData.originalText
        });
        return translatedAlert;
      }
      return alert;
    });
  }

  return alerts;
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
  if (!alert.readBy.some((id) => id.equals(objectCaregiverId))) {
    // Use .equals() for ObjectId comparison
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
  deleteAlertById,
};
