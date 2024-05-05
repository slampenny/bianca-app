const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { orgService } = require('../services');

const createOrg = catchAsync(async (req, res) => {
  const orgData = req.body.org;
  const caregiver = req.body.caregiver;
  const org = await orgService.createOrg(orgData, caregiver);
  res.status(httpStatus.CREATED).send(org);
});

const getOrgs = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await orgService.queryOrgs(filter, options);
  res.send(result);
});

const getOrg = catchAsync(async (req, res) => {
  const org = await orgService.getOrgById(req.params.orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }
  res.send(org);
});

const updateOrg = catchAsync(async (req, res) => {
  const { ...orgData } = req.body;
  const org = await orgService.updateOrgById(req.params.orgId, orgData);
  res.send(org);
});

const deleteOrg = catchAsync(async (req, res) => {
  await orgService.deleteOrgById(req.params.orgId);
  res.status(httpStatus.NO_CONTENT).send();
});

const addCaregiver = catchAsync(async (req, res) => {
  const { orgId, caregiverId } = req.params;
  const updatedOrg = await orgService.addCaregiver(orgId, caregiverId);
  res.status(httpStatus.OK).send(updatedOrg);
});

const removeCaregiver = catchAsync(async (req, res) => {
  const { orgId, caregiverId } = req.params;
  const updatedOrg = await orgService.removeCaregiver(orgId, caregiverId);
  res.status(httpStatus.OK).send(updatedOrg);
});

const setRole = catchAsync(async (req, res) => {
  const { orgId, caregiverId } = req.params;
  const { role } = req.body;
  const updatedOrg = await orgService.setRole(orgId, caregiverId, role);
  res.status(httpStatus.OK).send(updatedOrg);
});

module.exports = {
  createOrg,
  getOrgs,
  getOrg,
  updateOrg,
  deleteOrg,
  addCaregiver,
  removeCaregiver,
  setRole,
};
