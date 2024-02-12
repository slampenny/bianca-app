const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { scheduleService }  = require('../services');
const ApiError = require('../utils/ApiError');

// Create a new schedule or update an existing one
const createSchedule = catchAsync(async (req, res) => {
  // Check if the request body is valid
  if (!req.body.frequency || !req.body.intervals) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid request body');
  }

  // Create or update the schedule
  const schedule = await scheduleService.createSchedule(req.userId, req.body.frequency, req.body.intervals);

  // Send the created schedule
  res.status(httpStatus.CREATED).send(schedule);
});

// Update an existing schedule
const updateSchedule = catchAsync(async (req, res) => {
  // Check if the request body is valid
  if (!req.body.frequency || !req.body.intervals) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid request body');
  }

  // Update the schedule
  const schedule = await scheduleService.updateSchedule(req.params.scheduleId, req.body.frequency, req.body.intervals);

  // Send the updated schedule
  res.send(schedule);
});

// Patch an existing schedule
const patchSchedule = catchAsync(async (req, res) => {
  // Patch the schedule
  const schedule = await scheduleService.patchSchedule(req.params.scheduleId, req.body);

  // Send the patched schedule
  res.send(schedule);
});

// Delete a schedule
const deleteSchedule = catchAsync(async (req, res) => {
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

  // Send the schedule
  res.send(schedule);
});

module.exports = {
  createSchedule,
  updateSchedule,
  patchSchedule,
  deleteSchedule,
  getSchedule,
};