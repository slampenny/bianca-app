const httpStatus = require('http-status');
const { AccessControl } = require('../models');
const ApiError = require('../utils/ApiError');

const setPermissions = async (permissionsBody) => {
  const accessControl = await AccessControl.findOneAndUpdate(
    { reportId: permissionsBody.reportId },
    { $addToSet: { allowedCaregivers: { $each: permissionsBody.allowedCaregivers } } },
    { new: true, upsert: true }
  );
  return accessControl;
};

const getPermissionsById = async (id) => {
  const accessControl = await AccessControl.findById(id);
  if (!accessControl) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Access control not found');
  }
  return accessControl;
};

module.exports = {
  setPermissions,
  getPermissionsById,
};
