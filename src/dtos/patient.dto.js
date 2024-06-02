// patient.dto.js
const PatientDTO = (patient) => {
  const { _id, name, email, phone, isEmailVerified, createdAt, updatedAt, org, caregivers, schedules } = patient;

  const id = _id;
  const orgId = org ? (typeof org === 'object' ? org._id : org) : null;

  // Transform caregivers to only include IDs
  const caregiverIds = caregivers.map((caregiver) => (typeof caregiver === 'object' ? caregiver._id : caregiver));

  return {
    id,
    name,
    email,
    phone,
    isEmailVerified,
    org: orgId,
    caregivers: caregiverIds,
  };
};

module.exports = PatientDTO;
