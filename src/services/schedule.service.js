const httpStatus = require('http-status');
const { Schedule, User } = require('../models');
const ApiError = require('../utils/ApiError');

const createSchedule = async (scheduleData) => {
  // Create the schedule
  const schedule = new Schedule(scheduleData);

  // Calculate the nextCallDate
  schedule.calculateNextCallDate();

  // Save the schedule
  const savedSchedule = await schedule.save();

  // Add the new schedule's ID to the user's schedules field
  const user = await User.findById(schedule.userId);
  user.schedules.push(savedSchedule._id);
  await user.save();


  return savedSchedule;
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

  if (updateBody.userId && updateBody.userId !== schedule.userId.toString()) {
    const oldUser = await User.findById(schedule.userId);
    oldUser.schedules.pull(schedule._id);
    await oldUser.save();

    const newUser = await User.findById(updateBody.userId);
    newUser.schedules.push(schedule._id);
    await newUser.save();

    schedule.userId = updateBody.userId;
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

  // If the userId is updated, remove the schedule's ID from the old user's schedules field
  // and add it to the new user's schedules field
  if (updateBody.userId && updateBody.userId !== schedule.userId.toString()) {
    const oldUser = await User.findById(schedule.userId);
    oldUser.schedules.pull(schedule._id);
    await oldUser.save();

    const newUser = await User.findById(updateBody.userId);
    newUser.schedules.push(schedule._id);
    await newUser.save();
  }

  await schedule.save();
  return schedule;
};

const deleteSchedule = async (id) => {
  const schedule = await getScheduleById(id);

  // Remove the schedule's ID from the user's schedules field
  const user = await User.findById(schedule.userId);
  user.schedules.pull(schedule._id);
  await user.save();

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