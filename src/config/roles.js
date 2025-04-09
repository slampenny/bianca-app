const { AccessControl } = require('accesscontrol');

const allRoles = {
  invited: [
    'readOwn:caregiver',
    'updateOwn:caregiver'
  ],
  staff: [
    'readOwn:caregiver',
    'updateOwn:caregiver',
    'deleteOwn:caregiver',
    'readOwn:patient',
    'updateOwn:patient',
    'deleteOwn:patient',
    'readOwn:alert',
    'updateOwn:alert',
    'deleteOwn:alert',
    'readOwn:invoice'  // Add this for staff to read their invoices
  ],
  orgAdmin: [
    // Inherited from staff
    'readOwn:caregiver',
    'updateOwn:caregiver',
    'deleteOwn:caregiver',
    'readOwn:patient',
    'updateOwn:patient',
    'deleteOwn:patient',
    'readOwn:alert',
    'updateOwn:alert',
    'deleteOwn:alert',
    // OrgAdmin specific
    'readOwn:org',
    'updateOwn:org',
    'deleteOwn:org',
    'readAny:caregiver',
    'updateAny:caregiver',
    'deleteAny:caregiver',
    'readAny:patient',
    'updateAny:patient',
    'deleteAny:patient',
    'readAny:alert',
    'updateAny:alert',
    'deleteAny:alert',
    'updateAny:conversation',
    'readAny:conversation',
    // Payment and invoice permissions
    'createAny:paymentMethod',
    'readAny:paymentMethod',
    'updateAny:paymentMethod',
    'deleteAny:paymentMethod',
    'createAny:invoice',
    'readAny:invoice',
    'updateAny:invoice',
    'deleteAny:invoice'
  ],
  superAdmin: [] // superAdmin can do everything without explicit permissions
};

// Initialize AccessControl
const ac = new AccessControl();

// Grant permissions from the allRoles object
Object.keys(allRoles).forEach(role => {
  // For superAdmin, we'll handle differently
  if (role === 'superAdmin') {
    // First extend from orgAdmin to inherit those permissions
    ac.grant('superAdmin').extend('orgAdmin');
    // No need to add more permissions as superAdmin is treated specially in the auth middleware
  } else {
    // For all other roles, process permissions from the array
    allRoles[role].forEach(permission => {
      const [action, resource] = permission.split(':');
      ac.grant(role)[action](resource);
    });
  }
});

// Export both the roles array and the AccessControl instance
const roles = Object.keys(allRoles);

module.exports = {
  roles,
  ac
};