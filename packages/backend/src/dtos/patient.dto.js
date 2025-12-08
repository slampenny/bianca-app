// patient.dto.js
const ScheduleDTO = require('./schedule.dto');

const PatientDTO = (patient) => {
  const { _id, name, avatar, email, phone, preferredLanguage, isEmailVerified, org, caregivers, schedules } = patient;

  const id = _id;
  const orgId = org ? (typeof org === 'object' ? org._id : org) : null;

  // Transform caregivers to only include IDs
  const caregiverIds = caregivers && Array.isArray(caregivers) 
    ? caregivers.map((caregiver) => (typeof caregiver === 'object' ? caregiver._id : caregiver))
    : [];

  const scheduleDTOs = schedules && Array.isArray(schedules) 
    ? schedules.map(ScheduleDTO)
    : [];
  return {
    id,
    name,
    avatar,
    email,
    phone,
    preferredLanguage,
    isEmailVerified,
    org: orgId,
    caregivers: caregiverIds,
    schedules: scheduleDTOs,
  };
};

module.exports = PatientDTO;
