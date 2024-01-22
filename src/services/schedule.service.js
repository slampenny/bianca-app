const httpStatus = require('http-status');
const { Schedule } = require('../models');
const ApiError = require('../utils/ApiError');

const createOrUpdateSchedule = async (scheduleBody) => {
  const schedule = await Schedule.findOneAndUpdate(
    { userId: scheduleBody.userId },
    scheduleBody,
    { new: true, upsert: true }
  );
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
  createOrUpdateSchedule,
  getScheduleById,
};
