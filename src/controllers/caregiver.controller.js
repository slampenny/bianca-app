const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { caregiverService } = require('../services');
const config = require('../config/config');
const path = require('path');

const getCaregivers = catchAsync(async (req, res) => {
  console.log("getCaregivers called");
  console.log("Request caregiver:", req.caregiver);

  // Start with query filters for name and role from req.query
  let filter = pick(req.query, ['name', 'role']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);

  // If the requesting caregiver's role is 'invited' or 'staff',
  // restrict the result to only itself.
  if (req.caregiver.role === 'invited' || req.caregiver.role === 'staff') {
    // Use _id instead of id
    filter._id = req.caregiver._id;
    console.log("Filtering by caregiver _id:", req.caregiver._id);
  } else {
    // Otherwise, return caregivers in the same organization.
    filter.org = req.caregiver.org;
    console.log("Filtering by organization:", req.caregiver.org);
  }

  console.log("Final filter:", filter);

  const result = await caregiverService.queryCaregivers(filter, options);
  console.log("Query result:", result);

  res.send(result);
});


const getCaregiver = catchAsync(async (req, res) => {
  const caregiver = await caregiverService.getCaregiverById(req.params.caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }
  res.send(caregiver);
});

const createCaregiver = catchAsync(async (req, res) => {
  const caregiver = await caregiverService.createCaregiver(req.body.orgId, req.body);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }
  res.send(caregiver);
});

const updateCaregiver = catchAsync(async (req, res) => {
  const { org, patients, ...caregiverData } = req.body;
  const caregiver = await caregiverService.updateCaregiverById(req.params.caregiverId, caregiverData);
  res.send(caregiver);
});

const uploadCaregiverAvatar = catchAsync(async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new Error("No file uploaded");
  }
  // Extract the filename from the file path
  const filename = path.basename(file.path);
  // Construct an absolute URL for the avatar using the request's protocol and host (which should be your backend's host and port)
  const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;

  // Update the caregiver with this URL
  const caregiver = await caregiverService.updateCaregiverById(
    req.params.caregiverId, 
    { avatar: avatarUrl }
  );
  
  res.send(caregiver);
});

const deleteCaregiver = catchAsync(async (req, res) => {
  await caregiverService.deleteCaregiverById(req.params.caregiverId);
  res.status(httpStatus.NO_CONTENT).send();
});

const addPatient = catchAsync(async (req, res) => {
  const { caregiverId, patientId } = req.params;
  const updatedCaregiver = await caregiverService.addPatient(caregiverId, patientId);
  res.status(httpStatus.OK).send(updatedCaregiver);
});

const removePatient = catchAsync(async (req, res) => {
  const { caregiverId, patientId } = req.params;
  const updatedCaregiver = await caregiverService.removePatient(caregiverId, patientId);
  res.status(httpStatus.OK).send(updatedCaregiver);
});

const updatePatient = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const updatedCaregiver = await caregiverService.removePatient(req.caregiver, patientId);
  res.status(httpStatus.OK).send(updatedCaregiver);
});

const deletePatient = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const updatedCaregiver = await caregiverService.deletePatient(req.caregiver, patientId);
  res.status(httpStatus.OK).send(updatedCaregiver);
});

const getPatient = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const patients = await caregiverService.getPatient(req.caregiver, patientId);
  res.status(httpStatus.OK).send(patients);
});

const getPatients = catchAsync(async (req, res) => {
  const { caregiverId } = req.params;
  const patients = await caregiverService.getPatients(caregiverId);
  res.status(httpStatus.OK).send(patients);
});

module.exports = {
  getCaregivers,
  getCaregiver,
  createCaregiver,
  updateCaregiver,
  uploadCaregiverAvatar,
  deleteCaregiver,
  addPatient,
  removePatient,
  updatePatient,
  deletePatient,
  getPatient,
  getPatients
};
