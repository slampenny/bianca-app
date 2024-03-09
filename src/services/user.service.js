const httpStatus = require('http-status');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */
const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  userBody.role = userBody.role || 'user'; // set the role to 'user' if it's not provided
  return await User.create(userBody);
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async (filter, options) => {
  const users = await User.paginate(filter, options);
  return users;
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
  return User.findById(id).populate('schedules');
};

/**
 * Get user by email
 * @param {string} email
 * @returns {Promise<User>}
 */
const getUserByEmail = async (email) => {
  return User.findOne({ email }).populate('schedules');
};

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(user, updateBody);
  await user.save();
  return user;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await user.remove();
  return user;
};

/**
 * Assign a caregiver to a user
 * @param {ObjectId} userId
 * @param {ObjectId} caregiverId
 * @returns {Promise<User>}
 */
const assignCaregiver = async (userId, caregiverId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }

  const caregiver = await getUserById(caregiverId);
  if (!caregiver || caregiver.role !== 'caregiver') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }

  user.caregiver = caregiverId;
  await user.save();
  return user;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const removeCaregiverUserById = async (caregiverId, userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (caregiverId == userId) {
    user.caregiverId = null;
    await user.save();
    return user;
  } else { 
    await user.remove();
    return user;
  }
};

/**
 * Get clients for a caregiver
 * @param {ObjectId} caregiverId
 * @returns {Promise<Array<User>>}
 */
const getClientsForCaregiver = async (caregiverId) => {
  const caregiver = await getUserById(caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid caregiver ID');
  }

  if (caregiver.role !== 'caregiver') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'User is not a caregiver');
  }

  const clients = await User.find({ caregiver: caregiverId }).populate('schedules');
  return clients;
};

module.exports = {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmail,
  updateUserById,
  deleteUserById,
  assignCaregiver,
  getClientsForCaregiver,
};
