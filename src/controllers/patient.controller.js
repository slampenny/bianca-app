const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { 
  caregiverService, 
  conversationService, 
  patientService, 
  scheduleService 
} = require('../services');

const {
  PatientDTO
} = require('../dtos');

const logger = require('../config/logger');

const createPatient = catchAsync(async (req, res) => {
  const { schedules, ...patientData } = req.body;
  let patient = await patientService.createPatient(patientData);
  
  if (schedules) {
    for (const schedule of schedules) {
      await scheduleService.createSchedule({patientId: patient.id, ...schedule});
    }
  }
  patient = await caregiverService.addPatient(req.caregiver, patient.id);
  res.status(httpStatus.CREATED).send(PatientDTO(patient));
});

const getPatients = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'role']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await patientService.queryPatients(filter, options);
  res.send(result);
});

const getPatient = catchAsync(async (req, res) => {
  const patient = await patientService.getPatientById(req.params.patientId);
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }
  res.send(PatientDTO(patient));
});

const updatePatient = catchAsync(async (req, res) => {
  const { schedules, ...patientData } = req.body;
  
  const patient = await patientService.updatePatientById(req.params.patientId, patientData);
  if (schedules) {
    for (const schedule of schedules) {
      await scheduleService.updateSchedule(schedule.id, {...schedule});
    }
  }
  res.send(PatientDTO(patient));
});

const deletePatient = catchAsync(async (req, res) => {
  await patientService.deletePatientById(req.params.patientId);
  res.status(httpStatus.NO_CONTENT).send();
});

const assignCaregiver = catchAsync(async (req, res) => {
  const { patientId, caregiverId } = req.params;
  const updatedPatient = await patientService.assignCaregiver(caregiverId, patientId);
  res.status(httpStatus.OK).send(PatientDTO(updatedPatient));
});

const removeCaregiver = catchAsync(async (req, res) => {
  const { patientId, caregiverId } = req.params;
  const updatedPatient = await patientService.removeCaregiver(caregiverId, patientId);
  res.status(httpStatus.OK).send(PatientDTO(updatedPatient));
});

const getPatientsByCaregiver = catchAsync(async (req, res) => {
  const { caregiverId } = req.params;
  const patients = await patientService.getPatientsByCaregiver(caregiverId);
  res.status(httpStatus.OK).send(patients);
});

const getConversationsByPatient = catchAsync(async (req, res) => {
  const { patientId } = req.params;

  const patient = await patientService.getPatientById(patientId);
  if (!patient) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid patient ID');
  }

  const conversations = await conversationService.getConversationsByPatient(patientId);
  res.status(httpStatus.OK).send(conversations);
});

const getCaregivers = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const caregivers = await patientService.getCaregivers(patientId);
  if (!caregivers) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregivers not found');
  }
  res.status(httpStatus.OK).send(caregivers);
});

module.exports = {
  createPatient,
  getPatients,
  getPatient,
  getConversationsByPatient,
  updatePatient,
  deletePatient,
  assignCaregiver,
  removeCaregiver,
  getPatientsByCaregiver,
  getCaregivers,
};
