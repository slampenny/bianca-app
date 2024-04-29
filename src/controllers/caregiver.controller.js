const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { caregiverService } = require('../services');

const createCaregiver = catchAsync(async (req, res) => {
  const { schedules, ...caregiverData } = req.body;
  const caregiver = await caregiverService.createCaregiver(caregiverData);

  res.status(httpStatus.CREATED).send(caregiver);
});

const getCaregivers = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'role']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await caregiverService.queryCaregivers(filter, options);
  res.send(result);
});

const getCaregiver = catchAsync(async (req, res) => {
  const caregiver = await caregiverService.getCaregiverById(req.params.caregiverId);
  if (!caregiver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
  }
  res.send(caregiver);
});

const updateCaregiver = catchAsync(async (req, res) => {
  const { ...caregiverData } = req.body;
  
  const caregiver = await caregiverService.updateCaregiverById(req.params.caregiverId, caregiverData);
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

const getPatientsByCaregiver = catchAsync(async (req, res) => {
  const { caregiverId } = req.params;
  const patients = await caregiverService.getPatientsByCaregiver(caregiverId);
  res.status(httpStatus.OK).send(patients);
});

module.exports = {
  createCaregiver,
  getCaregivers,
  getCaregiver,
  updateCaregiver,
  deleteCaregiver,
  addPatient,
  removePatient,
  getPatientsByCaregiver,
};
