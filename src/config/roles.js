const { AccessControl } = require('accesscontrol');
const ac = new AccessControl();

ac.grant('staff')
  .readOwn('caregiver') // assuming 'caregiver' refers to the caregiver's own caregiver
  .updateOwn('caregiver')
  .deleteOwn('caregiver')
  .readOwn('patient') // assuming this role can view their assigned patients
  .updateOwn('patient')
  .deleteOwn('patient');

ac.grant('orgAdmin')
  .extend('staff') // inherit all permissions of 'staff'
  .readOwn('org')
  .updateOwn('org')
  .deleteOwn('org')
  .readAny('caregiver')
  .updateAny('caregiver')
  .deleteAny('caregiver')
  .readAny('patient')
  .updateAny('patient')
  .deleteAny('patient');

ac.grant('superAdmin')
  .extend('orgAdmin') // inherit all permissions of 'orgAdmin'
  .createAny('org')
  .updateAny('org')
  .deleteAny('org')
  .createAny('caregiver')
  .deleteAny('caregiver')
  .createAny('patient')
  .deleteAny('patient');

const roles = ['staff', 'orgAdmin', 'superAdmin'];

module.exports = {
  roles,
  ac
};
