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
    country,
    caregivers,
    patients,
    callRetrySettings,
    privacyOfficerId,
    requireClientConsent,
    debugAudioUploadEnabled
  } = orgObj;
  
  const id = _id;
  
  // Convert caregivers array to string IDs
  const caregiverIds = (caregivers || []).map((caregiver) => 
    caregiver instanceof ObjectId ? caregiver.toString() : (caregiver?._id || caregiver)
  );
  
  // Convert patients (clients) array to string IDs. Schema field remains "patients" for DB.
  const clientIds = (patients || []).map((p) =>
    p instanceof ObjectId ? p.toString() : (p?._id || p)
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
    country,
    caregivers: caregiverIds,
    clients: clientIds,
    callRetrySettings,
    privacyOfficerId: privacyOfficerId ? (privacyOfficerId instanceof ObjectId ? privacyOfficerId.toString() : (privacyOfficerId?._id || privacyOfficerId)) : null,
    requireClientConsent: requireClientConsent === true,
    debugAudioUploadEnabled: debugAudioUploadEnabled === true,
  };
};

module.exports = OrgDTO;
