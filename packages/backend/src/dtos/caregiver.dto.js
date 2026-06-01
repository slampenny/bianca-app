const { ObjectId } = require('mongodb');
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
  
  const { _id, name, avatar, email, phone, role, isEmailVerified, isPhoneVerified, org, clients, ssoProvider, ssoProviderId, externalId, active, onboardingComplete, persona, mfaEnabled, accountLocked, failedLoginAttempts, preferredLanguage, notificationPreferences } = caregiverObj;
  
  const id = _id;

  // Client IDs (ObjectIds or populated refs) normalized to strings
  const clientIds = (clients || []).map((p) => (p instanceof ObjectId ? p.toString() : (p?._id || p)));

  // Legacy: if onboardingComplete is not set (old record), treat as complete so existing users don't see onboarding
  const completed = Object.prototype.hasOwnProperty.call(caregiverObj, 'onboardingComplete')
    ? onboardingComplete === true
    : true;

  return {
    id,
    name,
    avatar,
    email,
    phone,
    role,
    isEmailVerified: isEmailVerified === true,
    isPhoneVerified: isPhoneVerified === true,
    org: toOrgIdString(org),
    clients: clientIds,
    ssoProvider: ssoProvider || undefined,
    ssoProviderId: ssoProviderId || undefined,
    externalId: externalId || undefined,
    active: active !== false,
    onboardingComplete: completed,
    persona: persona || undefined,
    mfaEnabled: mfaEnabled === true,
    accountLocked: accountLocked === true,
    failedLoginAttempts: failedLoginAttempts ?? 0,
    preferredLanguage: preferredLanguage || undefined,
    notificationPreferences: {
      dailyDigestEmail: notificationPreferences?.dailyDigestEmail === true,
    },
  };
};

module.exports = CaregiverDTO;
module.exports.toOrgIdString = toOrgIdString;