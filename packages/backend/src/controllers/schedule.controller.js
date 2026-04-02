const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { scheduleService } = require('../services');
const { clientService, caregiverService } = require('../services');
const ApiError = require('../utils/ApiError');
const ScheduleDTO = require('../dtos/schedule.dto');
const { assertCaregiverClientAccess } = require('../utils/accessControl');

// Create a new schedule or update an existing one
const createSchedule = catchAsync(async (req, res) => {
  // Check if the request body is valid
  if (!req.body.frequency || !req.body.intervals) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid request body');
  }

  const client = await clientService.getClientById(req.params.clientId);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  const caregiverDoc =
    req.caregiver.role === 'staff' ? await caregiverService.getCaregiverById(req.caregiver._id || req.caregiver.id) : null;
  assertCaregiverClientAccess(req.caregiver, caregiverDoc, client, 'You do not have access to this client');

  // Create or update the schedule
  const schedule = await scheduleService.createSchedule(req.params.clientId, {
    frequency: req.body.frequency,
    intervals: req.body.intervals,
    time: req.body.time,
  });

  // Send the created schedule
  res.status(httpStatus.CREATED).send(ScheduleDTO(schedule));
});

// Update an existing schedule
const updateSchedule = catchAsync(async (req, res) => {
  // Check if the request body is valid
  if (!req.body.frequency || !req.body.intervals) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid request body');
  }

  const existing = await scheduleService.getScheduleById(req.params.scheduleId);
  const caregiverDoc =
    req.caregiver.role === 'staff' ? await caregiverService.getCaregiverById(req.caregiver._id || req.caregiver.id) : null;
  assertCaregiverClientAccess(req.caregiver, caregiverDoc, existing.client, 'You do not have access to this schedule');

  // Update the schedule
  const schedule = await scheduleService.updateSchedule(req.params.scheduleId, req.body);

  // Send the updated schedule
  res.send(ScheduleDTO(schedule));
});

// Patch an existing schedule
const patchSchedule = catchAsync(async (req, res) => {
  const existing = await scheduleService.getScheduleById(req.params.scheduleId);
  const caregiverDoc =
    req.caregiver.role === 'staff' ? await caregiverService.getCaregiverById(req.caregiver._id || req.caregiver.id) : null;
  assertCaregiverClientAccess(req.caregiver, caregiverDoc, existing.client, 'You do not have access to this schedule');
  // Patch the schedule
  const schedule = await scheduleService.patchSchedule(req.params.scheduleId, req.body);

  // Send the patched schedule
  res.send(ScheduleDTO(schedule));
});

// Delete a schedule
const deleteSchedule = catchAsync(async (req, res) => {
  const existing = await scheduleService.getScheduleById(req.params.scheduleId);
  const caregiverDoc =
    req.caregiver.role === 'staff' ? await caregiverService.getCaregiverById(req.caregiver._id || req.caregiver.id) : null;
  assertCaregiverClientAccess(req.caregiver, caregiverDoc, existing.client, 'You do not have access to this schedule');
  // Delete the schedule
  await scheduleService.deleteSchedule(req.params.scheduleId);

  // Send a no content status
  res.status(httpStatus.NO_CONTENT).send();
});

// Get a schedule by its ID
const getSchedule = catchAsync(async (req, res) => {
  // Get the schedule
  const schedule = await scheduleService.getScheduleById(req.params.scheduleId);

  // Check if the schedule was found
  if (!schedule) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Schedule not found');
  }
  const caregiverDoc =
    req.caregiver.role === 'staff' ? await caregiverService.getCaregiverById(req.caregiver._id || req.caregiver.id) : null;
  assertCaregiverClientAccess(req.caregiver, caregiverDoc, schedule.client, 'You do not have access to this schedule');

  // Send the schedule
  res.send(ScheduleDTO(schedule));
});

module.exports = {
  createSchedule,
  updateSchedule,
  patchSchedule,
  deleteSchedule,
  getSchedule,
};
