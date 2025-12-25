const httpStatus = require('http-status');
const path = require('path');
const pick = require('../utils/pick');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const config = require('../config/config');
const { caregiverService, conversationService, patientService, scheduleService } = require('../services');

const { ConversationDTO, PatientDTO } = require('../dtos');

const createPatient = catchAsync(async (req, res) => {
  const { schedules, ...patientData } = req.body;
  const { file } = req; // This is the uploaded file

  // Check if a file was uploaded
  if (file) {
    // You can now save the file's path to the caregiver's avatar field
    patientData.avatar = file.path;
  }

  // Set org from caregiver before creating patient (org is required)
  // EVERY caregiver should ALWAYS have an org assigned
  if (!req.caregiver?.org) {
    logger.error('Patient creation failed: caregiver has no org', {
      caregiverId: req.caregiver?._id,
      caregiverEmail: req.caregiver?.email,
    });
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Your caregiver account does not have an organization assigned. Please contact support to resolve this issue.'
    );
  }

  // Use caregiver's org if not explicitly provided in request body
  if (!patientData.org) {
    // Handle both ObjectId, populated object, and string formats
    const mongoose = require('mongoose');
    let orgId = req.caregiver.org;
    
    // If org is populated (has _id property), use _id
    if (orgId && orgId._id) {
      orgId = orgId._id;
    }
    
    // Convert to string if it's an ObjectId
    if (orgId instanceof mongoose.Types.ObjectId) {
      orgId = orgId.toString();
    } else if (typeof orgId === 'object' && orgId && orgId.toString) {
      orgId = orgId.toString();
    }
    
    patientData.org = orgId;
  }

  // Final check - org should always be set at this point
  if (!patientData.org) {
    logger.error('Patient creation failed: org not set after processing', {
      caregiverId: req.caregiver?._id,
      caregiverOrg: req.caregiver?.org,
      patientData,
    });
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to assign organization to patient. Please contact support.');
  }

  logger.info('Creating patient', {
    caregiverId: req.caregiver._id,
    orgId: patientData.org,
    patientEmail: patientData.email,
    patientName: patientData.name,
  });

  let patient = await patientService.createPatient(patientData);
  
  logger.info('Patient created successfully', {
    patientId: patient._id,
    patientName: patient.name,
    orgId: patient.org,
  });

  if (schedules) {
    for (const schedule of schedules) {
      await scheduleService.createSchedule({ patientId: patient.id, ...schedule });
    }
  }
  
  // Add patient to caregiver (this also ensures two-way relationship)
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
      await scheduleService.updateSchedule(schedule.id, { ...schedule });
    }
  }
  res.send(PatientDTO(patient));
});

const uploadPatientAvatar = catchAsync(async (req, res) => {
  const { file } = req;
  if (!file) {
    throw new Error('No file uploaded');
  }
  // Extract the filename from the file path
  const filename = path.basename(file.path);
  // Construct an absolute URL for the avatar using the request's protocol and host (which should be your backend's host and port)
  const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;

  // Update the caregiver with this URL
  const patient = await patientService.updatePatientById(req.params.patientId, { avatar: avatarUrl });

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
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const caregiver = req.caregiver;

  const patient = await patientService.getPatientById(patientId);
  logger.info(`Fetching conversations for patient: ${patientId}`, { patient });
  if (!patient) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid patient ID');
  }

  // Check if the caregiver has access to this patient
  // For staff users, they can only access conversations of their assigned patients OR conversations they initiated
  // For orgAdmin users, they can access any conversation in their org
  // For superAdmin users, they have full access
  if (caregiver.role === 'staff') {
    const caregiverDoc = await caregiverService.getCaregiverById(caregiver.id);
    
    // Check if caregiver is assigned to this patient (check both directions)
    const hasPatientAccess = caregiverDoc.patients.some(
      (p) => {
        const pId = p._id ? p._id.toString() : p.toString();
        return pId === patientId.toString();
      }
    ) || (patient.caregivers && patient.caregivers.some(
      (c) => {
        const cId = c._id ? c._id.toString() : c.toString();
        return cId === caregiver.id.toString();
      }
    ));
    
    if (!hasPatientAccess) {
      // Check if they initiated any conversations for this patient (agentId)
      const { Conversation } = require('../models');
      const conversationCount = await Conversation.countDocuments({
        patientId,
        agentId: caregiver.id
      });
      
      if (conversationCount === 0) {
        throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this patient\'s conversations');
      }
    }
  } else if (caregiver.role === 'orgAdmin') {
    // OrgAdmin can access conversations in their org
    if (patient.org && patient.org.toString() !== caregiver.org?.toString()) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this patient\'s conversations');
    }
  }
  // superAdmin has full access, no check needed

  // Ensure proper sorting - default to startTime:desc if not specified
  if (!options.sortBy) {
    options.sortBy = 'startTime:desc';
  }

  const result = await conversationService.queryConversationsByPatient(patientId, options);
  
  // Apply DTO to each conversation in the results
  const transformedResult = {
    ...result,
    results: result.results.map((conversation) => ConversationDTO(conversation)),
  };
  
  res.status(httpStatus.OK).send(transformedResult);
});

const getCaregivers = catchAsync(async (req, res) => {
  const { patientId } = req.params;
  const caregivers = await patientService.getCaregivers(patientId);
  if (!caregivers) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Caregivers not found');
  }
  res.status(httpStatus.OK).send(caregivers);
});

const getUnassignedPatients = catchAsync(async (req, res) => {
  const patients = await patientService.getUnassignedPatients();
  res.status(httpStatus.OK).send(patients.map((patient) => PatientDTO(patient)));
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
  getUnassignedPatients,
};
