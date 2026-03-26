const mongoose = require('mongoose');
const httpStatus = require('http-status');
const { Alert, Caregiver } = require('../models');
const ApiError = require('../utils/ApiError');
const { translateAlertMessage, parseAlertMessage } = require('../utils/alertTranslations');

const RELATED_CLIENT_SELECT = 'name preferredName consented consentedAt';

const populateRelatedClient = {
  path: 'relatedClient',
  select: RELATED_CLIENT_SELECT,
};

/**
 * Flatten populated client for API (US-7B) and normalize ObjectIds to strings.
 * @param {import('mongoose').Document|object} doc Mongoose doc (prefer .toJSON()) or plain object
 */
function formatAlertForResponse(doc) {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }
  const obj = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  const out = { ...obj };
  if (out.relatedClient && typeof out.relatedClient === 'object') {
    const rid = out.relatedClient._id || out.relatedClient.id;
    if (rid) {
      out.relatedResidentConsent = {
        onFile: !!out.relatedClient.consented,
        recordedAt: out.relatedClient.consentedAt || null,
      };
      out.relatedClient = rid.toString();
    }
  } else if (out.relatedClient && mongoose.Types.ObjectId.isValid(out.relatedClient)) {
    out.relatedClient = out.relatedClient.toString();
  }
  if (out.relatedConversation && mongoose.Types.ObjectId.isValid(out.relatedConversation)) {
    out.relatedConversation = out.relatedConversation.toString();
  }
  if (out.evidence && out.evidence.conversationId && mongoose.Types.ObjectId.isValid(out.evidence.conversationId)) {
    out.evidence = {
      ...out.evidence,
      conversationId: out.evidence.conversationId.toString(),
    };
  }
  if (out.evidence?.messageIds?.length) {
    out.evidence = {
      ...out.evidence,
      messageIds: out.evidence.messageIds.map((id) =>
        id && mongoose.Types.ObjectId.isValid(id) ? id.toString() : id
      ),
    };
  }
  return out;
}

const createAlert = async (alertData) => {
  const created = await Alert.create(alertData);
  const populated = await Alert.findById(created._id).populate(populateRelatedClient);
  return formatAlertForResponse(populated);
};

const getAlertById = async (alertId, caregiverId) => {
  const alert = await Alert.findOne({
    _id: alertId,
    relevanceUntil: { $gte: new Date() },
  }).populate(populateRelatedClient);

  if (!alert) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Alert not found');
  }

  const caregiverObjectId = caregiverId ? new mongoose.Types.ObjectId(caregiverId) : null;
  if (caregiverObjectId && alert.readBy && alert.readBy.some((id) => id.equals(caregiverObjectId))) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Alert has already been read');
  }

  if (caregiverId) {
    const caregiver = await Caregiver.findById(caregiverId).select('preferredLanguage');
    if (caregiver && caregiver.preferredLanguage) {
      const parsed = parseAlertMessage(alert.message);
      if (parsed) {
        alert.message = translateAlertMessage(alert.message, caregiver.preferredLanguage, {
          severity: parsed.severity,
          category: parsed.category,
          phrase: parsed.phrase,
          patientName: parsed.patientName,
          originalText: parsed.originalText,
        });
      }
    }
  }

  return formatAlertForResponse(alert);
};

const getAlerts = async (caregiverId, showRead = false) => {
  if (!mongoose.Types.ObjectId.isValid(caregiverId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiverId format');
  }

  const caregiver = await Caregiver.findById(caregiverId)
    .populate({ path: 'org', select: 'caregivers' })
    .populate({ path: 'clients', select: '_id' });
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  const orgCaregiverIds = caregiver.org && caregiver.org.caregivers ? caregiver.org.caregivers : [];
  const clientIds = caregiver.clients && Array.isArray(caregiver.clients) ? caregiver.clients.map((pt) => pt._id) : [];

  const objectCaregiverId = new mongoose.Types.ObjectId(caregiverId);

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
          { createdBy: { $in: orgCaregiverIds }, visibility: visibilityConditions },
          { createdBy: { $in: clientIds }, visibility: 'assignedCaregivers' },
        ],
      },
      { relevanceUntil: { $gte: new Date() } },
    ],
  };

  let alerts;
  if (showRead) {
    alerts = await Alert.find(baseConditions).populate(populateRelatedClient).sort({ createdAt: -1 });
  } else {
    alerts = await Alert.find({
      $and: [
        baseConditions,
        { readBy: { $not: { $elemMatch: { $eq: objectCaregiverId } } } },
      ],
    })
      .populate(populateRelatedClient)
      .sort({ createdAt: -1 });
  }
  const caregiverLanguage = caregiver.preferredLanguage || 'en';

  alerts = alerts.map((alert) => {
    let plain = alert.toJSON();
    if (caregiverLanguage !== 'en') {
      const parsed = parseAlertMessage(alert.message);
      if (parsed) {
        plain = {
          ...plain,
          message: translateAlertMessage(alert.message, caregiverLanguage, {
            severity: parsed.severity,
            category: parsed.category,
            phrase: parsed.phrase,
            patientName: parsed.patientName,
            originalText: parsed.originalText,
          }),
        };
      }
    }
    return formatAlertForResponse(plain);
  });

  return alerts;
};

const updateAlertById = async (alertId, updateBody) => {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Alert not found');
  }
  Object.assign(alert, updateBody);
  await alert.save();
  const populated = await Alert.findById(alertId).populate(populateRelatedClient);
  return formatAlertForResponse(populated);
};

const markAlertAsRead = async (alertId, caregiverId) => {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Alert not found');
  }
  const objectCaregiverId = new mongoose.Types.ObjectId(caregiverId);
  if (!alert.readBy.some((id) => id.equals(objectCaregiverId))) {
    alert.readBy.push(objectCaregiverId);
    await alert.save();
  }
  const populated = await Alert.findById(alertId).populate(populateRelatedClient);
  return formatAlertForResponse(populated);
};

const markAlertAsUnread = async (alertId, caregiverId) => {
  const alert = await Alert.findById(alertId);
  if (!alert) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Alert not found');
  }
  const objectCaregiverId = new mongoose.Types.ObjectId(caregiverId);
  alert.readBy = alert.readBy.filter((id) => !id.equals(objectCaregiverId));
  await alert.save();
  const populated = await Alert.findById(alertId).populate(populateRelatedClient);
  return formatAlertForResponse(populated);
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
  markAlertAsUnread,
  updateAlertById,
  deleteAlertById,
  formatAlertForResponse,
};
