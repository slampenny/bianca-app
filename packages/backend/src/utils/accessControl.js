const httpStatus = require('http-status');
const ApiError = require('./ApiError');

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
};
