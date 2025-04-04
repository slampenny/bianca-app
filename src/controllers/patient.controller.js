const httpStatus = require('http-status');
const pick = require('../utils/pick');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const config = require('../config/config');
const path = require('path');
const { 
  caregiverService, 
  conversationService, 
  patientService, 
  scheduleService 
} = require('../services');

const {
  ConversationDTO,
  PatientDTO
} = require('../dtos');

const createPatient = catchAsync(async (req, res) => {
  const { schedules, ...patientData } = req.body;
  const file = req.file; // This is the uploaded file

  // Check if a file was uploaded
  if (file) {
    // You can now save the file's path to the caregiver's avatar field
    patientData.avatar = file.path;
  }

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

const uploadPatientAvatar = catchAsync(async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new Error("No file uploaded");
  }
  // Extract the filename from the file path
  const filename = path.basename(file.path);
  // Construct an absolute URL for the avatar using the request's protocol and host (which should be your backend's host and port)
  const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;

  // Update the caregiver with this URL
  const patient = await patientService.updatePatientById(
    req.params.patientId, 
    { avatar: avatarUrl }
  );
  
  res.send(patient);
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
  res.status(httpStatus.OK).send(conversations.map(ConversationDTO));
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
  uploadPatientAvatar,
  deletePatient,
  assignCaregiver,
  removeCaregiver,
  getPatientsByCaregiver,
  getCaregivers,
};
