const { ObjectId } = require('mongodb');
const PatientDTO = require('./patient.dto');
const OrgDTO = require('./org.dto');

/**
 * Normalize org (ObjectId or populated doc) to a string ID for comparison and DTOs.
 * Use this whenever you need a comparable org ID (e.g. access checks, DTOs).
 */
function toOrgIdString(org) {
  if (org == null) return null;
  const ref = org instanceof ObjectId ? org : (org._id ?? org);
  return ref != null ? ref.toString() : null;
}

const CaregiverDTO = (caregiver) => {
  // Convert Mongoose document to plain object if needed
  // This ensures all fields are accessible, including isPhoneVerified
  const caregiverObj = caregiver && typeof caregiver.toObject === 'function' 
    ? caregiver.toObject() 
    : caregiver;
  
  if (!caregiverObj) {
    return null;
  }
  
  const { _id, name, avatar, email, phone, role, isEmailVerified, isPhoneVerified, org, patients, ssoProvider, ssoProviderId } = caregiverObj;
  
  const id = _id;

  // Check if patients are ObjectIds, if so, convert them to strings
  const patientIds = (patients || []).map((patient) => (patient instanceof ObjectId ? patient.toString() : (patient?._id || patient)));

  return {
    id,
    name,
    avatar,
    email,
    phone,
    role,
    isEmailVerified: isEmailVerified === true,
    // Explicitly check for true - if it's true in DB, return true, otherwise false
    // This ensures we don't lose the true value if the field exists
    isPhoneVerified: isPhoneVerified === true,
    org: toOrgIdString(org),
    patients: patientIds,
    ssoProvider: ssoProvider || undefined,
    ssoProviderId: ssoProviderId || undefined,
  };
};

module.exports = CaregiverDTO;
module.exports.toOrgIdString = toOrgIdString;
