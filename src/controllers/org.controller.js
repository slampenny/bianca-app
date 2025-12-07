const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { orgService } = require('../services');

const createOrg = catchAsync(async (req, res) => {
  const orgData = req.body.org;
  const { caregiver } = req.body;
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

const sendInvite = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const { name, email, phone } = req.body;
  // Get inviterId from the authenticated user (req.caregiver)
  const inviterId = req.caregiver?.id || null;
  const caregiver = await orgService.sendInvite(orgId, name, email, phone, inviterId);
  res.status(httpStatus.OK).send(caregiver);
});

const verifyInvite = catchAsync(async (req, res) => {
  const { token } = req.query;
  const { caregiverBody } = req.body;
  const orgId = await orgService.verifyInvite(token, caregiverBody);
  res.status(httpStatus.OK).send({ orgId });
});

const updateCallRetrySettings = catchAsync(async (req, res) => {
  const { orgId } = req.params;
  const { retrySettings } = req.body;
  
  // Check if user is org admin
  const caregiver = req.caregiver;
  if (!caregiver) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Not authenticated');
  }
  
  // Verify caregiver is org admin for this org
  const org = await orgService.getOrgById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }
  
  // Check if caregiver belongs to this org and is orgAdmin
  const caregiverInOrg = org.caregivers.find(c => c.toString() === caregiver.id.toString());
  if (!caregiverInOrg) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Caregiver does not belong to this organization');
  }
  
  // Get full caregiver object to check role
  const { Caregiver } = require('../models');
  const fullCaregiver = await Caregiver.findById(caregiver.id);
  if (!fullCaregiver || fullCaregiver.role !== 'orgAdmin') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only org admins can update call retry settings');
  }
  
  const updatedOrg = await orgService.updateCallRetrySettings(orgId, retrySettings);
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
  sendInvite,
  verifyInvite,
  updateCallRetrySettings,
};
