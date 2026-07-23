const httpStatus = require('http-status');
const { Org, Caregiver, Client, Schedule, Token } = require('../models');
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
/**
 * @param {string} orgId
 * @param {object} updateBody
 * @param {{ role?: string|null }} [opts] - requesting caregiver role (privacy lint)
 */
const updateOrgById = async (orgId, updateBody, opts = {}) => {
  const org = await getOrgById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }
  if (updateBody.email && (await Org.isEmailTaken(updateBody.email, orgId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  if (Object.prototype.hasOwnProperty.call(updateBody, 'facilityType')) {
    // null/empty clears facility type (falls back to global default when useDefault)
    org.facilityType = updateBody.facilityType || undefined;
    delete updateBody.facilityType;
  }
  
  // Handle nested callRetrySettings update separately to merge properly
  if (updateBody.callRetrySettings) {
    if (!org.callRetrySettings) {
      org.callRetrySettings = {};
    }
    // Merge the nested object
    Object.assign(org.callRetrySettings, updateBody.callRetrySettings);
    // Remove from updateBody so Object.assign doesn't overwrite it
    const { callRetrySettings, ...restUpdateBody } = updateBody;
    Object.assign(org, restUpdateBody);
  } else if (updateBody.voiceOnboarding) {
    const { assertValidVoiceOnboardingConfig } = require('./onboardingPlan.service');
    let warnings = [];
    try {
      const result = assertValidVoiceOnboardingConfig(updateBody.voiceOnboarding, { role: opts.role });
      warnings = result?.warnings || [];
    } catch (err) {
      throw new ApiError(httpStatus.BAD_REQUEST, err.message);
    }
    org.voiceOnboarding = updateBody.voiceOnboarding;
    const { voiceOnboarding, ...restUpdateBody } = updateBody;
    Object.assign(org, restUpdateBody);
    org.$locals = org.$locals || {};
    org.$locals.voiceOnboardingPrivacyWarnings = warnings;
  } else if (updateBody.requiredCallQuestions) {
    const { assertValidRequiredCallQuestionsConfig } = require('./requiredCallQuestions.service');
    try {
      assertValidRequiredCallQuestionsConfig(updateBody.requiredCallQuestions);
    } catch (err) {
      throw new ApiError(httpStatus.BAD_REQUEST, err.message);
    }
    org.requiredCallQuestions = updateBody.requiredCallQuestions;
    const { requiredCallQuestions, ...restUpdateBody } = updateBody;
    Object.assign(org, restUpdateBody);
  } else if (updateBody.dailyDigestSettings) {
    if (!org.dailyDigestSettings) {
      org.dailyDigestSettings = { enabled: false, sendTime: null };
    }
    const { enabled, sendTime } = updateBody.dailyDigestSettings;
    if (enabled !== undefined) {
      org.dailyDigestSettings.enabled = enabled === true;
    }
    if (sendTime !== undefined) {
      org.dailyDigestSettings.sendTime = sendTime ? String(sendTime).trim() : null;
    }
    const { dailyDigestSettings, ...restUpdateBody } = updateBody;
    Object.assign(org, restUpdateBody);
  } else {
    Object.assign(org, updateBody);
  }
  
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

  const digestCleanup = require('./caregiverDailyDigestCleanup.service');
  const familyDigestCleanup = require('./familyWeeklyDigestCleanup.service');
  await digestCleanup.cleanupDigestsForOrg(orgId, 'org_deleted');
  await familyDigestCleanup.cleanupDigestsForOrg(orgId, 'org_deleted');

  // Soft delete org
  await org.delete();

  // Soft delete all caregivers that belong to the org
  const caregivers = await Caregiver.find({ org: orgId });
  for (const caregiver of caregivers) {
    await caregiver.delete();
  }

  // Soft delete all clients that belong to the org
  const clients = await Client.find({ org: orgId });
  for (const client of clients) {
    await client.delete();

    // Soft delete all schedules that belong to the client
    const schedules = await Schedule.find({ client: client.id });
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

/**
 * Org used to anchor invited caregivers for platform super-admin invites (caregivers require an org).
 * Override with BIANCA_PLATFORM_ORG_ID.
 */
const getPlatformAnchorOrg = async () => {
  if (process.env.BIANCA_PLATFORM_ORG_ID) {
    const org = await Org.findById(process.env.BIANCA_PLATFORM_ORG_ID);
    if (!org) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Platform organization not found (BIANCA_PLATFORM_ORG_ID)');
    }
    return org;
  }
  const org = await Org.findOne({}).sort({ _id: 1 });
  if (!org) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'No organization in database. Create an organization before sending super-admin invites.'
    );
  }
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

  await Token.deleteMany({ caregiver: caregiver._id, type: tokenTypes.SUPERADMIN_INVITE });

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

/**
 * Invite someone to complete signup as superAdmin on the admin console (mirrors sendInvite).
 * @param {string} name
 * @param {string} email
 * @param {string} phone
 * @param {string|null} [inviterId]
 */
const sendSuperAdminInvite = async (name, email, phone, inviterId = null) => {
  const org = await getPlatformAnchorOrg();
  const orgId = org._id;

  let caregiver = await Caregiver.findOne({ email });

  if (!caregiver) {
    caregiver = new Caregiver({
      org: orgId,
      name,
      email,
      phone,
      role: 'invited',
      isEmailVerified: true,
    });
    await caregiver.save();
    org.caregivers.push(caregiver);
    await org.save();
  } else if (caregiver.role === 'invited' && caregiver.org?.toString() === orgId.toString()) {
    caregiver.name = name;
    caregiver.phone = phone;
    await caregiver.save();
  } else {
    throw new ApiError(httpStatus.CONFLICT, 'Caregiver already exists');
  }

  await Token.deleteMany({ caregiver: caregiver._id, type: tokenTypes.INVITE });

  const inviteToken = await tokenService.generateSuperAdminInviteToken(caregiver);
  const inviteLink = `${config.adminFrontendUrl}/signup?token=${inviteToken}`;

  let locale = 'en';
  if (inviterId) {
    const inviter = await Caregiver.findById(inviterId).select('preferredLanguage');
    if (inviter?.preferredLanguage) {
      locale = inviter.preferredLanguage;
    }
  }

  try {
    await emailService.sendSuperAdminInviteEmail(email, inviteLink, locale, caregiver.name);
    logger.info('Super-admin invite email sent', { email, caregiverId: caregiver.id, locale });
  } catch (emailError) {
    logger.error('Failed to send super-admin invite email', {
      error: emailError.message,
      email,
      caregiverId: caregiver.id,
      inviteLink,
    });
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

/**
 * Update call retry settings for an org
 * @param {ObjectId} orgId
 * @param {Object} retrySettings - Partial retry settings object
 * @returns {Promise<Org>}
 */
const updateCallRetrySettings = async (orgId, retrySettings) => {
  const org = await getOrgById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }

  // Merge the new settings with existing settings
  if (!org.callRetrySettings) {
    org.callRetrySettings = {};
  }

  // Update only the provided fields
  if (retrySettings.retryCount !== undefined) {
    // Allow 0 (retries disabled) or 1-5 (retries enabled)
    if (!Number.isInteger(retrySettings.retryCount) || retrySettings.retryCount < 0 || retrySettings.retryCount > 5) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Retry count must be 0 (disabled) or an integer between 1 and 5');
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
  sendInvite,
  sendSuperAdminInvite,
  verifyInvite,
  updateCallRetrySettings,
};
