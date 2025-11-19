const { ObjectId } = require('mongodb');
const PatientDTO = require('./patient.dto');
const OrgDTO = require('./org.dto');

const CaregiverDTO = (caregiver) => {
  const { _id, name, avatar, email, phone, role, isEmailVerified, isPhoneVerified, org, patients } = caregiver;

  const id = _id;

  // Check if org is an object, if so, extract the _id
  const orgId = org instanceof ObjectId ? org : org._id;

  // Check if patients are ObjectIds, if so, convert them to strings
  const patientIds = patients.map((patient) => (patient instanceof ObjectId ? patient.toString() : patient._id));

  return {
    id,
    name,
    avatar,
    email,
    phone,
    role,
    isEmailVerified,
    isPhoneVerified: isPhoneVerified || false, // Default to false if not set
    org: orgId,
    patients: patientIds,
  };
};

module.exports = CaregiverDTO;
