const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const scimService = require('../services/scim.service');

function sendScimJson(res, status, body) {
  res.status(status);
  res.setHeader('Content-Type', 'application/scim+json');
  res.send(body);
}

function handleScimError(res, err) {
  if (err.isScimError) {
    return sendScimJson(res, err.statusCode, {
      schemas: [scimService.SCIM_ERROR_SCHEMA],
      status: String(err.statusCode),
      detail: err.scimDetail || err.message,
    });
  }
  return sendScimJson(res, httpStatus.INTERNAL_SERVER_ERROR, {
    schemas: [scimService.SCIM_ERROR_SCHEMA],
    status: String(httpStatus.INTERNAL_SERVER_ERROR),
    detail: 'Internal error',
  });
}

const serviceProviderConfig = catchAsync(async (req, res) => {
  try {
    return sendScimJson(res, httpStatus.OK, scimService.serviceProviderConfig(req.params.orgId));
  } catch (err) {
    return handleScimError(res, err);
  }
});

const resourceTypes = catchAsync(async (req, res) => {
  try {
    return sendScimJson(res, httpStatus.OK, scimService.resourceTypes(req.params.orgId));
  } catch (err) {
    return handleScimError(res, err);
  }
});

const getResourceType = catchAsync(async (req, res) => {
  try {
    const resource = scimService.getResourceType(req.params.orgId, req.params.typeId);
    return sendScimJson(res, httpStatus.OK, resource);
  } catch (err) {
    return handleScimError(res, err);
  }
});

const listUsers = catchAsync(async (req, res) => {
  try {
    const { orgId } = req.params;
    const result = await scimService.listUsers(orgId, {
      filter: req.query.filter,
      startIndex: req.query.startIndex,
      count: req.query.count,
    });
    return sendScimJson(res, httpStatus.OK, result);
  } catch (err) {
    return handleScimError(res, err);
  }
});

const getUser = catchAsync(async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    const user = await scimService.getUser(orgId, userId);
    return sendScimJson(res, httpStatus.OK, user);
  } catch (err) {
    return handleScimError(res, err);
  }
});

const createUser = catchAsync(async (req, res) => {
  try {
    const { orgId } = req.params;
    const user = await scimService.createUser(orgId, req.body);
    res.status(httpStatus.CREATED);
    res.setHeader('Content-Type', 'application/scim+json');
    res.setHeader('Location', user.meta.location);
    return res.send(user);
  } catch (err) {
    return handleScimError(res, err);
  }
});

const patchUser = catchAsync(async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    const user = await scimService.patchUser(orgId, userId, req.body);
    if (!user) {
      return res.status(httpStatus.NO_CONTENT).send();
    }
    return sendScimJson(res, httpStatus.OK, user);
  } catch (err) {
    return handleScimError(res, err);
  }
});

const deleteUser = catchAsync(async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    await scimService.deleteUser(orgId, userId);
    return res.status(httpStatus.NO_CONTENT).send();
  } catch (err) {
    return handleScimError(res, err);
  }
});

module.exports = {
  serviceProviderConfig,
  resourceTypes,
  getResourceType,
  listUsers,
  getUser,
  createUser,
  patchUser,
  deleteUser,
};
