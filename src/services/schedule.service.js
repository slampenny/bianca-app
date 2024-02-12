const httpStatus = require('http-status');
const { Schedule } = require('../models');
const ApiError = require('../utils/ApiError');

const createSchedule = async (userId, frequency, intervals) => {
  // Create the schedule
  const schedule = new Schedule({ userId, frequency, intervals });

  // Calculate the nextCallDate
  schedule.calculateNextCallDate();

  // Save the schedule
  await schedule.save();

  return schedule;
};

const updateSchedule = async (scheduleId, updateBody) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    throw new Error('Schedule not found');
  }

  if (updateBody.userId) {
    schedule.userId = updateBody.userId;
  }

  if (updateBody.frequency) {
    schedule.frequency = updateBody.frequency;
  }

  if (updateBody.intervals) {
    schedule.intervals = updateBody.intervals;
  }

  if (updateBody.isActive !== undefined) {
    schedule.isActive = updateBody.isActive;
  }

  // If the frequency or intervals are updated, recalculate the nextCallDate
  if (updateBody.frequency || updateBody.intervals) {
    schedule.calculateNextCallDate();
  }

  await schedule.save();
  return schedule;
};

const patchSchedule = async (id, updateBody) => {
  const schedule = await getScheduleById(id);
  Object.keys(updateBody).forEach((key) => {
    schedule[key] = updateBody[key];
  });

  // If the frequency or intervals are updated, recalculate the nextCallDate
  if (updateBody.frequency || updateBody.intervals) {
    schedule.calculateNextCallDate();
  }

  await schedule.save();
  return schedule;
};

const deleteSchedule = async (id) => {
  const schedule = await getScheduleById(id);
  await schedule.remove();
  return schedule;
};

const getScheduleById = async (id) => {
  const schedule = await Schedule.findById(id);
  if (!schedule) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Schedule not found');
  }
  return schedule;
};

module.exports = {
  createSchedule,
  updateSchedule,
  patchSchedule,
  deleteSchedule,
  getScheduleById,
};