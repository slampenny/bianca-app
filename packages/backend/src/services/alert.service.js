const mongoose = require('mongoose');
const httpStatus = require('http-status');
const { Alert, Caregiver } = require('../models');
const FinancialExploitationDetector = require('./ai/financialExploitationDetector.service');
const ApiError = require('../utils/ApiError');
const { translateAlertMessage, parseAlertMessage } = require('../utils/alertTranslations');
const { scheduleBroadcastAfterAlertChange } = require('./alertBroadcast.service');

const RELATED_CLIENT_SELECT = 'name preferredName consented consentedAt';

const populateRelatedClient = {
  path: 'relatedClient',
  select: RELATED_CLIENT_SELECT,
};

const populateResolvedBy = {
  path: 'resolvedBy',
  select: 'name email',
};

const alertPopulate = [populateRelatedClient, populateResolvedBy];

/**
 * Same visibility rules as getAlerts (org role + createdBy / visibility / assigned clients).
 * @param {string} caregiverId
 * @returns {Promise<{ $and: object[] }>}
 */
async function buildVisibleAlertsFilter(caregiverId) {
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

  let visibilityConditions;
  if (caregiver.role === 'orgAdmin') {
    visibilityConditions = { $in: ['orgAdmin', 'allCaregivers'] };
  } else if (caregiver.role === 'staff') {
    visibilityConditions = { $eq: 'allCaregivers' };
  } else {
    visibilityConditions = { $eq: 'none' };
  }

  return {
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
}

/**
 * Flatten populated client for API (US-7B) and normalize ObjectIds to strings.
 * @param {import('mongoose').Document|object} doc Mongoose doc (prefer .toJSON()) or plain object
 */
function formatAlertForResponse(doc) {
  if (!doc || typeof doc !== 'object') {
    return doc;
  }
  // Mongoose toJSON plugin strips createdAt/updatedAt; capture from the doc before serializing.
  let createdStamp = doc.createdAt;
  let updatedStamp = doc.updatedAt;
  if ((createdStamp == null || updatedStamp == null) && typeof doc.get === 'function') {
    if (createdStamp == null) createdStamp = doc.get('createdAt');
    if (updatedStamp == null) updatedStamp = doc.get('updatedAt');
  }

  const obj = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
  const out = { ...obj };

  if (createdStamp != null && out.createdAt == null) {
    out.createdAt = createdStamp instanceof Date ? createdStamp.toISOString() : String(createdStamp);
  }
  if (updatedStamp != null && out.updatedAt == null) {
    out.updatedAt = updatedStamp instanceof Date ? updatedStamp.toISOString() : String(updatedStamp);
  }
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
  if (out.resolvedBy && typeof out.resolvedBy === 'object') {
    const rb = out.resolvedBy;
    const rid = rb._id || rb.id;
    if (rid) {
      out.resolvedByCaregiver = {
        id: rid.toString(),
        name: rb.name || rb.email || '',
      };
      out.resolvedBy = rid.toString();
    }
  } else if (out.resolvedBy && mongoose.Types.ObjectId.isValid(out.resolvedBy)) {
    out.resolvedBy = out.resolvedBy.toString();
  }
  if (out.resolvedAt) {
    out.resolvedAt =
      out.resolvedAt instanceof Date ? out.resolvedAt.toISOString() : String(out.resolvedAt);
  }
  return out;
}

const createAlert = async (alertData) => {
  const created = await Alert.create(alertData);
  const populated = await Alert.findById(created._id).populate(alertPopulate);
  scheduleBroadcastAfterAlertChange(populated);
  return formatAlertForResponse(populated);
};

const FRAUD_ABUSE_DOLLAR_DETECTOR = 'fraud_abuse_significant_amount';

/**
 * Dashboard alert when post-call (or manual) fraud analysis estimates ≥ $5K in patient speech.
 * Dedupes: one per related conversation, or at most one per 24h per client when there is no conversation.
 * Same pipeline fields as voicemail alerts (Client-created, assignedCaregivers).
 * @param {{ clientId: string, conversationId?: string|null, maxEstimatedUsd?: number, financialRiskScore?: number }} params
 * @returns {Promise<object|null>} created alert, or null if no-op
 */
const createSignificantDollarFraudAlertIfNeeded = async ({
  clientId,
  conversationId = null,
  maxEstimatedUsd,
  financialRiskScore,
}) => {
  const threshold = FinancialExploitationDetector.SENIOR_CARE_SIGNIFICANT_AMOUNT_USD || 5000;
  if (maxEstimatedUsd == null || maxEstimatedUsd < threshold) {
    return null;
  }
  if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
    return null;
  }
  const clientOid = new mongoose.Types.ObjectId(clientId);
  if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
    const convOid = new mongoose.Types.ObjectId(conversationId);
    const existConv = await Alert.findOne({
      relatedClient: clientOid,
      relatedConversation: convOid,
      'evidence.detector': FRAUD_ABUSE_DOLLAR_DETECTOR,
    })
      .select('_id')
      .lean();
    if (existConv) {
      return null;
    }
  } else {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existRecent = await Alert.findOne({
      relatedClient: clientOid,
      'evidence.detector': FRAUD_ABUSE_DOLLAR_DETECTOR,
      createdAt: { $gte: oneDayAgo },
    })
      .select('_id')
      .lean();
    if (existRecent) {
      return null;
    }
  }

  const est = Math.round(Number(maxEstimatedUsd));
  const message = `Conversation analysis: a large dollar amount was discussed (est. $${est.toLocaleString('en-US')}) — review for possible financial risk`;

  const hasConv = Boolean(conversationId && mongoose.Types.ObjectId.isValid(conversationId));
  const convOid = hasConv ? new mongoose.Types.ObjectId(conversationId) : null;
  const conf =
    typeof financialRiskScore === 'number' && !Number.isNaN(financialRiskScore)
      ? Math.min(1, Math.max(0, financialRiskScore / 100))
      : undefined;

  const record = {
    message,
    importance: 'high',
    alertType: hasConv ? 'conversation' : 'client',
    relatedClient: clientOid,
    createdBy: clientOid,
    createdModel: 'Client',
    visibility: 'assignedCaregivers',
    relevanceUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    evidence: {
      detector: FRAUD_ABUSE_DOLLAR_DETECTOR,
      ...(conf != null ? { confidence: conf } : {}),
      ...(hasConv && convOid ? { conversationId: convOid } : {}),
    },
  };
  if (hasConv && convOid) {
    record.relatedConversation = convOid;
  }

  return createAlert(record);
};

const getAlertById = async (alertId, caregiverId) => {
  const alert = await Alert.findOne({
    _id: alertId,
    relevanceUntil: { $gte: new Date() },
  }).populate(alertPopulate);

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
  const caregiver = await Caregiver.findById(caregiverId)
    .populate({ path: 'org', select: 'caregivers' })
    .populate({ path: 'clients', select: '_id' });
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  const objectCaregiverId = new mongoose.Types.ObjectId(caregiverId);
  const baseConditions = await buildVisibleAlertsFilter(caregiverId);

  let alerts;
  if (showRead) {
    alerts = await Alert.find(baseConditions).populate(alertPopulate).sort({ createdAt: -1 });
  } else {
    alerts = await Alert.find({
      $and: [
        baseConditions,
        { readBy: { $not: { $elemMatch: { $eq: objectCaregiverId } } } },
      ],
    })
      .populate(alertPopulate)
      .sort({ createdAt: -1 });
  }
  const caregiverLanguage = caregiver.preferredLanguage || 'en';

  alerts = alerts.map((alert) => {
    const createdAtIso =
      alert.createdAt instanceof Date ? alert.createdAt.toISOString() : alert.createdAt;
    const updatedAtIso =
      alert.updatedAt instanceof Date ? alert.updatedAt.toISOString() : alert.updatedAt;

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
    return formatAlertForResponse({
      ...plain,
      ...(createdAtIso ? { createdAt: createdAtIso } : {}),
      ...(updatedAtIso ? { updatedAt: updatedAtIso } : {}),
    });
  });

  return alerts;
};

const updateAlertById = async (alertId, updateBody, options = {}) => {
  const { caregiverId } = options;
  const alert = await Alert.findById(alertId);
  if (!alert) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Alert not found');
  }

  const objectId = new mongoose.Types.ObjectId(alertId);
  if (caregiverId) {
    const baseConditions = await buildVisibleAlertsFilter(caregiverId);
    const visible = await Alert.countDocuments({
      $and: [baseConditions, { _id: objectId }],
    });
    if (!visible) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Alert not found');
    }
  }

  const hasResolution = Object.prototype.hasOwnProperty.call(updateBody, 'resolutionNote');
  if (hasResolution) {
    if (!caregiverId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot resolve alert without caregiver context');
    }
    const note = typeof updateBody.resolutionNote === 'string' ? updateBody.resolutionNote.trim() : '';
    if (!note) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Resolution note is required');
    }
    if (alert.resolvedBy) {
      throw new ApiError(httpStatus.CONFLICT, 'Alert is already resolved');
    }
    alert.resolutionNote = note;
    alert.resolvedAt = new Date();
    alert.resolvedBy = new mongoose.Types.ObjectId(caregiverId);
  } else {
    const safeRest = { ...updateBody };
    delete safeRest.resolutionNote;
    delete safeRest.resolvedBy;
    delete safeRest.resolvedAt;
    Object.assign(alert, safeRest);
  }

  await alert.save();
  const populated = await Alert.findById(alertId).populate(alertPopulate);
  scheduleBroadcastAfterAlertChange(populated);
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
  const populated = await Alert.findById(alertId).populate(alertPopulate);
  scheduleBroadcastAfterAlertChange(populated);
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
  const populated = await Alert.findById(alertId).populate(alertPopulate);
  scheduleBroadcastAfterAlertChange(populated);
  return formatAlertForResponse(populated);
};

const deleteAlertById = async (alertId) => {
  const existing = await Alert.findById(alertId);
  if (!existing) {
    return null;
  }
  scheduleBroadcastAfterAlertChange(existing);
  return Alert.findByIdAndDelete(alertId);
};

module.exports = {
  createAlert,
  createSignificantDollarFraudAlertIfNeeded,
  getAlertById,
  getAlerts,
  markAlertAsRead,
  markAlertAsUnread,
  updateAlertById,
  deleteAlertById,
  formatAlertForResponse,
};
