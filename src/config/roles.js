const { AccessControl } = require('accesscontrol');
const ac = new AccessControl();

ac.grant('staff')
  .readOwn('caregiver') // assuming 'caregiver' refers to the caregiver's own caregiver
  .updateOwn('caregiver')
  .deleteOwn('caregiver')
  .readOwn('patients') // assuming this role can view their assigned patients
  .updateOwn('patients')
  .deleteOwn('patients');

ac.grant('orgAdmin')
  .extend('staff') // inherit all permissions of 'staff'
  .readOwn('org')
  .updateOwn('org')
  .deleteOwn('org')
  .readAny('caregiver')
  .updateAny('caregiver')
  .deleteAny('caregiver')
  .readAny('patients')
  .updateAny('patients')
  .deleteAny('patients');

ac.grant('superAdmin')
  .extend('orgAdmin') // inherit all permissions of 'orgAdmin'
  .createAny('org')
  .updateAny('org')
  .deleteAny('org')
  .createAny('caregiver')
  .deleteAny('caregiver')
  .createAny('patients')
  .deleteAny('patients');

const roles = ['staff', 'orgAdmin', 'superAdmin'];

module.exports = {
  roles,
  ac
};
