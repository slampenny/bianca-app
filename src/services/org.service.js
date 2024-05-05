const httpStatus = require('http-status');
const { Org, Caregiver, Patient } = require('../models');
const config = require('../config/config');
const inviteService = require('./invite.service');
const emailService = require('./email.service');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

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
  for (let caregiver of caregivers) {
    await caregiver.delete();
  }

  // Soft delete all patients that belong to the org
  const patients = await Patient.find({ org: orgId });
  for (let patient of patients) {
    await patient.delete();
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

const sendInvite = async (orgId, email) => {
  const inviteToken = await inviteService.generateInviteToken(orgId, email);
  const inviteLink = `${config.app.url}/signup?token=${inviteToken}`;
  await emailService.sendInviteEmail(email, inviteLink);
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

  return org;
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
};
