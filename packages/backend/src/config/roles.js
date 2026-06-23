const { AccessControl } = require('accesscontrol');

const allRoles = {
  invited: [
    'readOwn:caregiver',
    'updateOwn:caregiver',
    'readOwn:caregiverDailyDigest',
    'createOwn:caregiverDailyDigest',
  ],
  staff: [
    'readOwn:caregiver',
    'updateOwn:caregiver',
    'deleteOwn:caregiver',
    'readOwn:client',
    'createOwn:client',
    'updateOwn:client',
    'deleteOwn:client',
    'readOwn:alert',
    'updateOwn:alert',
    'deleteOwn:alert',
    'readOwn:invoice', // Add this for staff to read their invoices
    'readOwn:conversation', // Add this for staff to read conversations of their patients
    'readOwn:medicalAnalysis', // Add this for staff to read medical analysis of their patients
    'createOwn:medicalAnalysis', // Add this for staff to trigger medical analysis for their patients
    'readOwn:familyDigest',
    'createOwn:familyDigest',
    'readOwn:caregiverDailyDigest',
    'createOwn:caregiverDailyDigest',
    'readOwn:facilityReport',
  ],
  orgAdmin: [
    // Inherited from staff
    'readOwn:caregiver',
    'updateOwn:caregiver',
    'deleteOwn:caregiver',
    'readOwn:client',
    'createOwn:client',
    'updateOwn:client',
    'deleteOwn:client',
    'readOwn:alert',
    'updateOwn:alert',
    'deleteOwn:alert',
    // OrgAdmin specific
    'readOwn:org',
    'updateOwn:org',
    'deleteOwn:org',
    'readAny:caregiver',
    'createAny:caregiver',
    'updateAny:caregiver',
    'deleteAny:caregiver',
    'readAny:client',
    'createAny:client',
    'updateAny:client',
    'deleteAny:client',
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
    'deleteAny:invoice',
    'readAny:medicalAnalysis', // Add this for orgAdmin to read medical analysis of any patient
    'createAny:medicalAnalysis', // Add this for orgAdmin to trigger medical analysis
    'readAny:familyDigest',
    'createAny:familyDigest',
    'readOwn:caregiverDailyDigest',
    'createOwn:caregiverDailyDigest',
    'readAny:caregiverDailyDigest',
    'createAny:caregiverDailyDigest',
    'readAny:facilityReport',
    'readAny:privacy',
    'updateAny:privacy',
  ],
  superAdmin: [], // superAdmin can do everything without explicit permissions
  /** Facility family digest recipient — read-only linked residents in mobile app */
  family: [
    'readOwn:caregiver',
    'updateOwn:caregiver',
    'readOwn:client',
    'readOwn:alert',
    'readOwn:familyDigest',
    'readOwn:familyResident',
  ],
};

// Initialize AccessControl
const ac = new AccessControl();

// Grant permissions from the allRoles object
Object.keys(allRoles).forEach((role) => {
  // For superAdmin, we'll handle differently
  if (role === 'superAdmin') {
    // First extend from orgAdmin to inherit those permissions
    ac.grant('superAdmin').extend('orgAdmin');
    // No need to add more permissions as superAdmin is treated specially in the auth middleware
  } else {
    // For all other roles, process permissions from the array
    allRoles[role].forEach((permission) => {
      const [action, resource] = permission.split(':');
      ac.grant(role)[action](resource);
    });
  }
});

// Export both the roles array and the AccessControl instance
const roles = Object.keys(allRoles);

module.exports = {
  roles,
  ac,
};
