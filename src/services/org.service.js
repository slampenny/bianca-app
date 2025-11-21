const httpStatus = require('http-status');
const { Org, Caregiver, Patient, Schedule } = require('../models');
const config = require('../config/config');
const emailService = require('./email.service');
const tokenService = require('./token.service');
const { tokenTypes } = require('../config/tokens');
const ApiError = require('../utils/ApiError');

/**
 * Create a org and a caregiver
 * @param {Object} org
 * * @param {Object} caregiver
 * @returns {Promise<Org>}
 */
const createOrg = async (org, caregiver) => {
  return await Org.createOrgAndCaregiver(org, caregiver);
};

/**
 * Query for orgs
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryOrgs = async (filter, options) => {
  const orgs = await Org.paginate(filter, options);
  return orgs;
};

/**
 * Get org by id
 * @param {ObjectId} id
 * @returns {Promise<Org>}
 */
const getOrgById = async (id) => {
  return Org.findById(id);
};

/**
 * Get org by email
 * @param {string} email
 * @returns {Promise<Org>}
 */
const getOrgByEmail = async (email) => {
  return Org.findOne({ email });
};

/**
 * Update org by id
 * @param {ObjectId} orgId
 * @param {Object} updateBody
 * @returns {Promise<Org>}
 */
const updateOrgById = async (orgId, updateBody) => {
  const org = await getOrgById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }
  if (updateBody.email && (await Org.isEmailTaken(updateBody.email, orgId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(org, updateBody);
  await org.save();
  return org;
};

/**
 * Soft delete org by id and all its caregivers and patients
 * @param {ObjectId} orgId
 * @returns {Promise<Org>}
 */
const deleteOrgById = async (orgId) => {
  const org = await getOrgById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }

  // Soft delete org
  await org.delete();

  // Soft delete all caregivers that belong to the org
  const caregivers = await Caregiver.find({ org: orgId });
  for (const caregiver of caregivers) {
    await caregiver.delete();
  }

  // Soft delete all patients that belong to the org
  const patients = await Patient.find({ org: orgId });
  for (const patient of patients) {
    await patient.delete();

    // Soft delete all schedules that belong to the patient
    const schedules = await Schedule.find({ patient: patient.id });
    for (const schedule of schedules) {
      await schedule.delete();
    }
  }

  return org;
};

/**
 * Assign a caregiver to a org
 * @param {ObjectId} orgId
 * @param {ObjectId} caregiverId
 * @returns {Promise<Org>}
 */
const addCaregiver = async (orgId, caregiverId) => {
  const org = await getOrgById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }

  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }

  if (org.caregivers.includes(caregiverId)) {
    throw new ApiError(httpStatus.CONFLICT, 'Caregiver already assigned to this org');
  }

  org.caregivers.push(caregiverId);
  await org.save();
  return org;
};

/**
 * Delete org by id
 * @param {ObjectId} orgId
 * @returns {Promise<Org>}
 */
const removeCaregiver = async (orgId, caregiverId) => {
  const org = await getOrgById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }
  org.caregivers.pull(caregiverId);
  await org.save();
  return org;
};

const sendInvite = async (orgId, name, email, phone) => {
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }

  let caregiver = await Caregiver.findOne({ email });

  if (!caregiver) {
    caregiver = new Caregiver({
      org: orgId,
      name,
      email,
      phone,
      role: 'invited',
    });

    await caregiver.save();
    org.caregivers.push(caregiver);
    await org.save();

    // Generate invite token and send email
    const inviteToken = await tokenService.generateInviteToken(caregiver);
    const inviteLink = `${config.frontendUrl}/signup?token=${inviteToken}`;
    // Get inviter's preferred language for the invite email
    // If inviter is not found, default to English
    let locale = 'en';
    if (inviterId) {
      const inviter = await Caregiver.findById(inviterId).select('preferredLanguage');
      if (inviter?.preferredLanguage) {
        locale = inviter.preferredLanguage;
      }
    }
    
    await emailService.sendInviteEmail(email, inviteLink, locale);

    return { caregiver, inviteToken };
  }

  // Option 1: Throw error if caregiver already exists.
  throw new ApiError(httpStatus.CONFLICT, 'Caregiver already invited');
};

const verifyInvite = async (token, caregiverBody = {}) => {
  const payload = await tokenService.verifyToken(token, tokenTypes.INVITE);
  const caregiver = await Caregiver.findById(payload.caregiver);

  // Update the caregiver document with the fields in caregiverBody
  caregiver.set(caregiverBody);
  await caregiver.save();

  return await setRole(caregiver.org, caregiver.id, 'staff');
};

const setRole = async (orgId, caregiverId, role) => {
  const org = await getOrgById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }

  if (!org.caregivers.includes(caregiverId)) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found in this org');
  }

  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  caregiver.role = role;
  await caregiver.save();

  return caregiver;
};

module.exports = {
  createOrg,
  queryOrgs,
  getOrgById,
  getOrgByEmail,
  updateOrgById,
  deleteOrgById,
  addCaregiver,
  removeCaregiver,
  setRole,
  sendInvite,
  verifyInvite,
};
