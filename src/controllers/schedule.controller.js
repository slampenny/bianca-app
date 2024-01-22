const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { scheduleService } = require('../services');

const createOrUpdateSchedule = catchAsync(async (req, res) => {
  const schedule = await scheduleService.createOrUpdateSchedule(req.body);
  res.status(httpStatus.CREATED).send(schedule);
});

const getSchedule = catchAsync(async (req, res) => {
  const schedule = await scheduleService.getScheduleById(req.params.scheduleId);
  if (!schedule) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Schedule not found');
  }
  res.send(schedule);
});

module.exports = {
  createOrUpdateSchedule,
  getSchedule,
};
