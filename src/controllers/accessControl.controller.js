const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { accessControlService } = require('../services');

const setPermissions = catchAsync(async (req, res) => {
  const accessControl = await accessControlService.setPermissions(req.body);
  res.status(httpStatus.CREATED).send(accessControl);
});

const getPermissions = catchAsync(async (req, res) => {
  const accessControl = await accessControlService.getPermissionsById(req.params.accessControlId);
  if (!accessControl) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Access control not found');
  }
  res.send(accessControl);
});

module.exports = {
  setPermissions,
  getPermissions,
};
