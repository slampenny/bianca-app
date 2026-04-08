const httpStatus = require('http-status');
const ApiError = require('./ApiError');
const { ac } = require('../config/roles');

const toIdString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toHexString === 'function') return value.toHexString();
  if (value.id && typeof value.id === 'string') return value.id;
  if (value._id && value._id !== value) return toIdString(value._id);
  if (typeof value.toString === 'function') return value.toString();
  return null;
};

const isSuperAdmin = (caregiver) => caregiver && caregiver.role === 'superAdmin';

const assertCaregiverOrgAccess = (caregiver, orgId, message = 'Access denied') => {
  if (isSuperAdmin(caregiver)) return;
  const caregiverOrgId = toIdString(caregiver && caregiver.org);
  const targetOrgId = toIdString(orgId);
  if (!caregiverOrgId || !targetOrgId || caregiverOrgId !== targetOrgId) {
    throw new ApiError(httpStatus.FORBIDDEN, message);
  }
};

/**
 * GET /clients list: org-wide when the role may read any client in the org (e.g. orgAdmin);
 * otherwise limit to roster / explicit assignments (e.g. staff).
 */
const restrictsClientListingToCaregiverRoster = (caregiver) => {
  if (!caregiver || caregiver.role === 'superAdmin') {
    return false;
  }
  try {
    return !ac.can(caregiver.role).readAny('client').granted;
  } catch {
    return true;
  }
};

const assertCaregiverClientAccess = (caregiver, caregiverDoc, client, message = 'Access denied') => {
  if (isSuperAdmin(caregiver)) return;
  assertCaregiverOrgAccess(caregiver, client && client.org, message);
  if (!caregiver || caregiver.role !== 'staff') return;

  const caregiverId = toIdString((caregiver && caregiver.id) || (caregiver && caregiver._id));
  const roster = ((caregiverDoc && caregiverDoc.clients) || (caregiver && caregiver.clients) || [])
    .map(toIdString)
    .filter(Boolean);
  const clientCaregivers = ((client && client.caregivers) || []).map(toIdString).filter(Boolean);
  const clientId = toIdString((client && client._id) || (client && client.id));
  if (!clientId || (!roster.includes(clientId) && !clientCaregivers.includes(caregiverId))) {
    throw new ApiError(httpStatus.FORBIDDEN, message);
  }
};

module.exports = {
  toIdString,
  assertCaregiverOrgAccess,
  assertCaregiverClientAccess,
  restrictsClientListingToCaregiverRoster,
};
