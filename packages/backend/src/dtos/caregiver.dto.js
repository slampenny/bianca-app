const { ObjectId } = require('mongodb');
const PatientDTO = require('./patient.dto');
const OrgDTO = require('./org.dto');

const CaregiverDTO = (caregiver) => {
  // Convert Mongoose document to plain object if needed
  // This ensures all fields are accessible, including isPhoneVerified
  const caregiverObj = caregiver && typeof caregiver.toObject === 'function' 
    ? caregiver.toObject() 
    : caregiver;
  
  if (!caregiverObj) {
    return null;
  }
  
  const { _id, name, avatar, email, phone, role, isEmailVerified, isPhoneVerified, org, patients } = caregiverObj;
  
  const id = _id;

  // Check if org is an object, if so, extract the _id
  const orgId = org instanceof ObjectId ? org : (org?._id || org);

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
    org: orgId,
    patients: patientIds,
  };
};

module.exports = CaregiverDTO;
