const httpStatus = require('http-status');
const mongoose = require('mongoose');
const { Org, Caregiver, Client } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Normalize phone number to E.164 format (+1XXXXXXXXXX)
 * @param {string} phone - Phone number in any format
 * @returns {string|null} - Normalized phone number in E.164 format, or null if invalid
 */
const normalizePhoneToE164 = (phone) => {
  if (!phone) return null;
  
  // If already in E.164 format, return as-is
  if (phone.startsWith('+')) {
    const e164Regex = /^\+[1-9]\d{9,14}$/;
    if (e164Regex.test(phone)) {
      return phone;
    }
    return null; // Invalid E.164 format
  }
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Convert 10-digit US number to E.164 format
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Convert 11-digit number starting with 1 to E.164 format
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If longer, assume it's an international number and add +
  if (digits.length > 11) {
    return `+${digits}`;
  }
  
  // Invalid format
  return null;
};
/**
 * Create a caregiver
 * @param {ObjectId} orgId
 * @param {Object} caregiverBody
 * @returns {Promise<Caregiver>}
 */
const createCaregiver = async (orgId, caregiverBody) => {
  if (await Caregiver.isEmailTaken(caregiverBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  // Normalize phone number to E.164 format if provided
  if (caregiverBody.phone) {
    const normalizedPhone = normalizePhoneToE164(caregiverBody.phone);
    if (!normalizedPhone) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid phone number format. Please use 10 digits or E.164 format (e.g., +1234567890)');
    }
    caregiverBody.phone = normalizedPhone;
  }

  // Add org to caregiver
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Organization not found');
  }

  // CRITICAL: Set org at creation time, not after
  const caregiver = await Caregiver.create({
    ...caregiverBody,
    org: org._id, // Set org at creation time
  });

  // Add caregiver to org's caregivers array
  org.caregivers.push(caregiver._id);
  await org.save();

  return caregiver;
};

/**
 * Query for caregivers
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryCaregivers = async (filter, options) => {
  return await Caregiver.paginate(filter, options);
};

/**
 * Get caregiver by id
 * @param {ObjectId} id
 * @returns {Promise<Caregiver>}
 */
const getCaregiverById = async (id) => {
  return await Caregiver.findById(id).populate('org');
};

const getClientById = async (id) => {
  return await Client.findById(id).populate('schedules');
};

/**
 * Get caregiver by email
 * @param {string} email
 * @param {Object} options - Optional query options
 * @param {boolean} options.populatePatients - Whether to populate clients (default: false)
 * @param {boolean} options.populateOrg - Whether to populate org (default: false)
 * @returns {Promise<Caregiver>}
 */
const getCaregiverByEmail = async (email, options = {}) => {
  const { populatePatients = false, populateOrg = false } = options;
  
  let query = Caregiver.findOne({ email });
  
  if (populateOrg) {
    query = query.populate('org');
  }
  
  if (populatePatients) {
    query = query.populate({
      path: 'clients',
      populate: {
        path: 'schedules',
        model: 'Schedule',
      },
    });
  }
  
  return await query;
};

const getLoginCaregiverData = async (email) => {
  // Check MongoDB connection before querying
  const mongoose = require('mongoose');
  const config = require('../config/config');
  
  if (mongoose.connection.readyState !== 1) {
    // Try to reconnect if not connected
    logger.warn(`MongoDB not connected (state: ${mongoose.connection.readyState}). Attempting to reconnect...`);
    try {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      // Wait a moment for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (mongoose.connection.readyState === 1) {
        logger.info('MongoDB reconnected successfully');
      } else {
        throw new Error(`MongoDB reconnection failed. Connection state: ${mongoose.connection.readyState}`);
      }
    } catch (reconnectError) {
      const error = new Error(`MongoDB not connected. Connection state: ${mongoose.connection.readyState}. Connection URL: ${config.mongoose.url}. Error: ${reconnectError.message}`);
      error.code = 'MONGOOSE_NOT_CONNECTED';
      error.originalError = reconnectError;
      logger.error(`MongoDB connection error: ${error.message}`);
      throw error;
    }
  }
  
  const caregiver = await Caregiver.findOne({ email })
    .populate('org')
    .populate({
      path: 'clients',
      populate: {
        path: 'schedules',
        model: 'Schedule',
      },
    });

  if (!caregiver) {
    return null;
  }

  return {
    org: caregiver.org,
    caregiver,
    clients: caregiver.clients,
  };
};

/**
 * Load caregiver + org + clients (same shape as login) by id — for super-admin impersonation.
 * @param {string|mongoose.Types.ObjectId} id
 * @returns {Promise<{ org: *, caregiver: *, clients: * } | null>}
 */
const getCaregiverSessionContextById = async (id) => {
  const caregiver = await Caregiver.findById(id)
    .populate('org')
    .populate({
      path: 'clients',
      populate: {
        path: 'schedules',
        model: 'Schedule',
      },
    });

  if (!caregiver) {
    return null;
  }

  return {
    org: caregiver.org,
    caregiver,
    clients: caregiver.clients || [],
  };
};

/**
 * Update caregiver by id
 * @param {ObjectId} caregiverId
 * @param {Object} updateBody
 * @returns {Promise<Caregiver>}
 */
const updateCaregiverById = async (caregiverId, updateBody) => {
  const caregiver = await getCaregiverById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }
  // SSO users cannot change email - it must match their identity provider
  if (caregiver.ssoProvider && updateBody.email !== undefined && updateBody.email !== caregiver.email) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'SSO users cannot change their email address');
  }
  if (caregiver.ssoProvider && updateBody.email !== undefined) {
    delete updateBody.email; // Ignore email updates for SSO users
  }
  if (updateBody.email && (await Caregiver.isEmailTaken(updateBody.email, caregiverId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  
  // Normalize phone number to E.164 format if provided
  if (updateBody.phone) {
    const normalizedPhone = normalizePhoneToE164(updateBody.phone);
    if (!normalizedPhone) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid phone number format. Please use 10 digits or E.164 format (e.g., +1234567890)');
    }
    updateBody.phone = normalizedPhone;
  }
  
  // If this is an invited user completing registration (setting password), promote them to staff
  // Also promote if they already have a password and are adding a phone (completing profile)
  if (caregiver.role === 'invited' && (updateBody.password || (updateBody.phone && caregiver.password))) {
    // Invited user completing registration - promote to staff
    // Phone and verification status are separate concerns
    updateBody.role = 'staff';
  }
  
  // If orgAdmin or staff is updating their phone, also update the organization's phone if it's not set
  if ((caregiver.role === 'orgAdmin' || caregiver.role === 'superAdmin') && updateBody.phone) {
    const org = await Org.findById(caregiver.org);
    if (org && !org.phone) {
      org.phone = updateBody.phone;
      await org.save();
    }
  }
  
  Object.assign(caregiver, updateBody);
  await caregiver.save();
  return caregiver;
};

/**
 * Delete caregiver by id
 * @param {ObjectId} caregiverId
 * @returns {Promise<Caregiver>}
 */
const deleteCaregiverById = async (caregiverId) => {
  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  try {
    // Remove caregiver from org's caregivers array
    const org = await Org.findById(caregiver.org).populate('caregivers');
    org.caregivers = org.caregivers.filter((id) => !id.equals(caregiverId));
    await org.save();

    // Remove caregiver from all patients' caregivers array
    const clients = await Client.find({ caregivers: { $in: [new mongoose.Types.ObjectId(caregiverId)] } });
    for (const client of clients) {
      client.caregivers = client.caregivers.filter((id) => !id.equals(caregiverId));
      await client.save();
      logger.debug(`Caregiver ${caregiverId} removed from client ${client._id}`);
    }

    // Remove caregiver
    await caregiver.delete();
  } catch (error) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Error while removing caregiver ${caregiverId}: ${JSON.stringify(error)}`);
  }

  return caregiver;
};

/**
 * Assign a client to a caregiver
 * @param {ObjectId} caregiverId
 * @param {ObjectId} clientId
 * @returns {Promise<Caregiver>}
 */
const addClient = async (caregiverId, clientId) => {
  const caregiver = await getCaregiverById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  const client = await getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  const caregiverObjectId = mongoose.Types.ObjectId.isValid(caregiverId)
    ? new mongoose.Types.ObjectId(caregiverId)
    : caregiverId;
  const clientObjectId = mongoose.Types.ObjectId.isValid(clientId)
    ? new mongoose.Types.ObjectId(clientId)
    : clientId;
  const caregiverClientIds = caregiver.clients.map((id) => id.toString());
  // Atomic $addToSet avoids VersionError when parallel requests / Jest integration tests update the same doc
  if (!caregiverClientIds.includes(clientObjectId.toString())) {
    await Caregiver.findByIdAndUpdate(
      caregiverObjectId,
      { $addToSet: { clients: clientObjectId } },
      { new: true }
    );
  }
  const clientCaregiverIds = client.caregivers.map((id) => id.toString());
  if (!clientCaregiverIds.includes(caregiverObjectId.toString())) {
    client.caregivers.push(caregiverObjectId);
  }
  client.org = caregiver.org;
  await client.save();
  return getClientById(clientId);
};

/**
 * Remove client from caregiver
 * @param {ObjectId} caregiverId
 * @param {ObjectId} clientId
 * @returns {Promise<Caregiver>}
 */
const removeClient = async (caregiverId, clientId) => {
  const caregiver = await getCaregiverById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }

  const client = await getClientById(clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  caregiver.clients = caregiver.clients.filter((id) => !id.equals(clientId));
  await caregiver.save();
  client.caregivers = client.caregivers.filter((id) => !id.equals(caregiverId));
  await client.save();
  return caregiver;
};

/**
 * Get clients for a caregiver
 * @param {ObjectId} caregiverId
 * @returns {Promise<Array<Client>>}
 */
const getClients = async (caregiverId) => {
  const caregiver = await Caregiver.findById(caregiverId).populate({
    path: 'clients',
    populate: {
      path: 'schedules',
      model: 'Schedule',
    },
  });
  if (!caregiver) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }

  return caregiver.clients;
};

const checkCaregiverOwnsClient = async (caregiverId, clientId) => {
  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }
  if (caregiver.role === 'staff' && !caregiver.clients.some((id) => id.toString() === clientId.toString())) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this client');
  }
  if (caregiver.role === 'orgAdmin') {
    const pop = await Caregiver.findById(caregiverId).populate('org');
    if (pop.org && !pop.org.clients.some((id) => id.toString() === clientId.toString())) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this client');
    }
  }
  return true;
};

module.exports = {
  createCaregiver,
  queryCaregivers,
  getCaregiverById,
  getCaregiverByEmail,
  getLoginCaregiverData,
  getCaregiverSessionContextById,
  updateCaregiverById,
  deleteCaregiverById,
  getClientById,
  addClient,
  removeClient,
  getClients,
  checkCaregiverOwnsClient,
};
