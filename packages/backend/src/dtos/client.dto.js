const ScheduleDTO = require('./schedule.dto');

const ClientDTO = (client) => {
  if (!client) return null;
  const { _id, name, avatar, email, phone, preferredLanguage, isEmailVerified, consented, consentedAt, consentEmailVersion, org, caregivers } = client;
  // Use direct property access for populated array (destructuring can miss it on Mongoose docs)
  const schedulesRaw = client.schedules;
  const scheduleDTOs = Array.isArray(schedulesRaw) ? schedulesRaw.map(ScheduleDTO) : [];
  const id = _id;
  const orgId = org ? (typeof org === 'object' ? org._id : org) : null;
  const caregiverIds = caregivers && Array.isArray(caregivers)
    ? caregivers.map((cg) => (typeof cg === 'object' ? cg._id : cg))
    : [];
  return {
    id,
    name,
    avatar,
    email,
    phone,
    preferredLanguage,
    isEmailVerified,
    consented,
    consentedAt,
    consentEmailVersion,
    org: orgId,
    caregivers: caregiverIds,
    schedules: scheduleDTOs,
  };
};

module.exports = ClientDTO;
