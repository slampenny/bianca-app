const httpStatus = require('http-status');
const { Org, Caregiver, Patient, Schedule } = require('../models');
const config = require('../config/config');
const emailService = require('./email.service');
const tokenService = require('./token.service');
const { tokenTypes } = require('../config/tokens');
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
 * Update call retry settings for an org (only org admins can do this)
 * @param {ObjectId} orgId - Org ID
 * @param {Object} retrySettings - Retry settings object
 * @param {number} retrySettings.retryCount - Number of retries (0-10)
 * @param {number} retrySettings.retryIntervalMinutes - Minutes between retries (1-1440)
 * @param {boolean} retrySettings.alertOnAllMissedCalls - Alert on every missed call/retry
 * @returns {Promise<Org>}
 */
const updateCallRetrySettings = async (orgId, retrySettings) => {
  const org = await getOrgById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }
  
  // Initialize callRetrySettings if it doesn't exist
  if (!org.callRetrySettings) {
    org.callRetrySettings = {};
  }
  
  // Validate and update retry settings
  if (retrySettings.retryCount !== undefined) {
    if (!Number.isInteger(retrySettings.retryCount) || retrySettings.retryCount < 0 || retrySettings.retryCount > 10) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Retry count must be an integer between 0 and 10');
    }
    org.callRetrySettings.retryCount = retrySettings.retryCount;
  }
  
  if (retrySettings.retryIntervalMinutes !== undefined) {
    if (!Number.isInteger(retrySettings.retryIntervalMinutes) || retrySettings.retryIntervalMinutes < 1 || retrySettings.retryIntervalMinutes > 1440) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Retry interval must be an integer between 1 and 1440 minutes');
    }
    org.callRetrySettings.retryIntervalMinutes = retrySettings.retryIntervalMinutes;
  }
  
  if (retrySettings.alertOnAllMissedCalls !== undefined) {
    org.callRetrySettings.alertOnAllMissedCalls = Boolean(retrySettings.alertOnAllMissedCalls);
  }
  
  await org.save();
  logger.info(`[Org Service] Updated call retry settings for org ${orgId}: retryCount=${org.callRetrySettings.retryCount}, retryIntervalMinutes=${org.callRetrySettings.retryIntervalMinutes}, alertOnAllMissedCalls=${org.callRetrySettings.alertOnAllMissedCalls}`);
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

const sendInvite = async (orgId, name, email, phone, inviterId = null) => {
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }

  let caregiver = await Caregiver.findOne({ email });

  if (!caregiver) {
    // Create new invited caregiver
    // Email is considered verified since they received the invite email
    caregiver = new Caregiver({
      org: orgId,
      name,
      email,
      phone,
      role: 'invited',
      isEmailVerified: true, // Invite email proves email ownership
    });

    await caregiver.save();
    logger.info('Invited caregiver created:', {
      caregiverId: caregiver.id,
      caregiverEmail: caregiver.email,
      caregiverName: caregiver.name,
      caregiverRole: caregiver.role,
      caregiverOrg: caregiver.org,
      orgId: orgId,
      orgIdType: typeof orgId,
      caregiverOrgType: typeof caregiver.org
    });
    
    org.caregivers.push(caregiver);
    await org.save();
    logger.info('Caregiver added to org.caregivers array:', {
      orgId: org.id,
      caregiversCount: org.caregivers.length,
      caregiverIds: org.caregivers.map(c => c.toString())
    });
  } else if (caregiver.role === 'invited' && caregiver.org?.toString() === orgId.toString()) {
    // Resend invite for existing invited caregiver in the same org
    logger.info('Resending invite to existing invited caregiver:', {
      caregiverId: caregiver.id,
      caregiverEmail: caregiver.email,
      caregiverName: caregiver.name,
      orgId: orgId
    });
    
    // Update name and phone in case they've changed
    caregiver.name = name;
    caregiver.phone = phone;
    await caregiver.save();
  } else {
    // Caregiver exists but is not in invited state or belongs to different org
    throw new ApiError(httpStatus.CONFLICT, 'Caregiver already exists');
  }

  // Generate invite token and send email (for both new and resend cases)
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
  
  // Send invite email with error handling
  try {
    await emailService.sendInviteEmail(email, inviteLink, locale, caregiver.name);
    logger.info('Invite email sent successfully', {
      email,
      caregiverId: caregiver.id,
      locale
    });
  } catch (emailError) {
    logger.error('Failed to send invite email', {
      error: emailError.message,
      stack: emailError.stack,
      email,
      caregiverId: caregiver.id,
      locale,
      inviteLink
    });
    // Don't throw - allow the invite to be created even if email fails
    // The caregiver can still use the invite link if they have it
  }

  return { caregiver, inviteToken };
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
  updateCallRetrySettings,
};
