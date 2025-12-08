const httpStatus = require('http-status');
const ApiError = require('./ApiError');
const logger = require('../config/logger');

// Define helper functions for ownership checking
const isOwnerOrg = (caregiver, targetId) => {
  // Ensure caregiver object and targetId are provided
  if (!caregiver || !targetId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid parameters for isOwnerOrg function.');
  }
  // logger.info(`Checking if caregiver is owner of org: ${caregiver.org} === ${targetId}`);
  // Check if the caregiver's ID matches the target ID
  return caregiver.org.toString() === targetId.toString();
};

// Define helper functions for ownership checking
const isOwnerCaregiver = (caregiver, targetId) => {
  // Ensure caregiver object and targetId are provided
  if (!caregiver || !targetId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid parameters for isOwnerCaregiver function.');
  }

  // Check if the caregiver's ID matches the target ID
  return caregiver.id.toString() === targetId.toString();
};

const isOwnerPatient = (caregiver, targetId) => {
  if (!targetId) {
    return true;
  }

  // Ensure caregiver object and patientId are provided, and caregiver has patients array
  if (!caregiver || !caregiver.patients || !Array.isArray(caregiver.patients)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid parameters for isOwnerPatient function.');
  }

  // Check if the patientId exists in the caregiver's patients array
  return caregiver.patients.includes(targetId);
};

// Map of resources to their respective ownership checking functions
const ownershipChecks = {
  org: isOwnerOrg,
  caregiver: isOwnerCaregiver,
  patient: isOwnerPatient,
  alert: () => {
    return true;
  },
};

module.exports = ownershipChecks;
