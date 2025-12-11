const { ObjectId } = require('mongodb');

const OrgDTO = (org) => {
  if (!org) return null;
  
  // Convert Mongoose document to plain object if needed
  const orgObj = org && typeof org.toObject === 'function' 
    ? org.toObject() 
    : org;
  
  const { 
    _id, 
    stripeCustomerId, 
    name, 
    avatar, 
    logo, 
    email, 
    phone, 
    isEmailVerified,
    timezone,
    caregivers,
    patients,
    callRetrySettings
  } = orgObj;
  
  const id = _id;
  
  // Convert caregivers array to string IDs
  const caregiverIds = (caregivers || []).map((caregiver) => 
    caregiver instanceof ObjectId ? caregiver.toString() : (caregiver?._id || caregiver)
  );
  
  // Convert patients array to string IDs
  const patientIds = (patients || []).map((patient) => 
    patient instanceof ObjectId ? patient.toString() : (patient?._id || patient)
  );
  
  return {
    id,
    stripeCustomerId,
    name,
    avatar,
    logo,
    email,
    phone,
    isEmailVerified: isEmailVerified === true,
    timezone,
    caregivers: caregiverIds,
    patients: patientIds,
    callRetrySettings,
  };
};

module.exports = OrgDTO;
