const allRoles = {
  staff: [],
  orgAdmin: [
    'manageOwnOrg',
    'getPatients', 
    'managePatients', 
    'changeRole'
  ],
  superAdmin: ['getOrgs', 'manageOwnOrg', 'manageOrgs'],
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
};
