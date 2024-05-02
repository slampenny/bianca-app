const allRoles = {
  staff: [
    'getPatients',
    'getOwnPatientConversations',
  ],
  orgAdmin: [
    'manageOwnOrg',
    'getCaregivers',
    'manageCaregivers',
    'getPatients', 
    'managePatients', 
    'changeRole',
    'getOwnPatientConversations',
  ],
  superAdmin: [
    'getOrgs', 
    'manageOwnOrg', 
    'manageOrgs'
  ],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
};
