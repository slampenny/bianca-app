const httpStatus = require("http-status");
const ApiError = require("./ApiError");

// Define helper functions for ownership checking
const isOwnerOrg = (caregiver, targetId) => {
    // Ensure caregiver object and targetId are provided
    if (!caregiver || !targetId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid parameters for isOwnerOrg function.');
    }
    
    // Check if the caregiver's ID matches the target ID
    return caregiver.org.id === targetId;
};

// Define helper functions for ownership checking
const isOwnerCaregiver = (caregiver, targetId) => {
    // Ensure caregiver object and targetId are provided
    if (!caregiver || !targetId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid parameters for isOwnerCaregiver function.');
    }
    
    // Check if the caregiver's ID matches the target ID
    return caregiver.id === targetId;
};

const isOwnerPatient = (caregiver, patientId) => {
    // Ensure caregiver object and patientId are provided, and caregiver has patients array
    if (!caregiver || !patientId || !caregiver.patients || !Array.isArray(caregiver.patients)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid parameters for isOwnerPatient function.');
    }

    // Check if the patientId exists in the caregiver's patients array
    return caregiver.patients.includes(patientId);
};

// Map of resources to their respective ownership checking functions
const ownershipChecks = {
    orgs: isOwnerOrg,
    caregiver: isOwnerCaregiver,
    patients: isOwnerPatient
};

module.exports = ownershipChecks;
