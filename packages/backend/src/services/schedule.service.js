const httpStatus = require('http-status');
const { Schedule, Client, Org } = require('../models');
const ApiError = require('../utils/ApiError');
const { convertOrgTimeToUTC } = require('../utils/timezone.utils');

const createSchedule = async (clientId, scheduleData) => {
  const client = await Client.findById(clientId).populate('org');
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  const orgTimezone = client.org?.timezone || 'America/Los_Angeles';
  const scheduleDataWithUTCTime = { ...scheduleData };
  if (scheduleData.time) {
    scheduleDataWithUTCTime.time = convertOrgTimeToUTC(scheduleData.time, orgTimezone);
  }
  const schedule = await Schedule.create({ ...scheduleDataWithUTCTime, client: clientId });
  client.schedules.push(schedule.id);
  await client.save();
  await schedule.populate({
    path: 'client',
    populate: { path: 'org' }
  });
  return schedule;
};

const updateSchedule = async (scheduleId, updateBody) => {
  const schedule = await Schedule.findById(scheduleId).populate({
    path: 'client',
    populate: { path: 'org' }
  });
  if (!schedule) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Schedule not found');
  }

  // Get org timezone (default to 'America/New_York' if not set)
  const orgTimezone = schedule.client?.org?.timezone || 'America/New_York';

  // Convert time from org timezone to UTC if time is being updated
  const updateBodyWithUTCTime = { ...updateBody };
  if (updateBody.time) {
    updateBodyWithUTCTime.time = convertOrgTimeToUTC(updateBody.time, orgTimezone);
  }

  Object.keys(updateBodyWithUTCTime).forEach((key) => {
    schedule[key] = updateBodyWithUTCTime[key];
  });

  if (updateBody.client && updateBody.client !== schedule.client.toString()) {
    const oldClient = await Client.findById(schedule.client);
    if (oldClient) {
      oldClient.schedules.pull(schedule.id);
      await oldClient.save();
    }
    const newClient = await Client.findById(updateBody.client);
    if (newClient) {
      newClient.schedules.push(schedule.id);
      await newClient.save();
    }
  }

  await schedule.save();
  
  await schedule.populate({
    path: 'client',
    populate: { path: 'org' }
  });
  return schedule;
};

const patchSchedule = async (id, updateBody) => {
  const schedule = await getScheduleById(id);
  
  // Get org timezone (default to 'America/New_York' if not set)
  const orgTimezone = schedule.client?.org?.timezone || 'America/New_York';

  // Convert time from org timezone to UTC if time is being updated
  const updateBodyWithUTCTime = { ...updateBody };
  if (updateBody.time) {
    updateBodyWithUTCTime.time = convertOrgTimeToUTC(updateBody.time, orgTimezone);
  }

  Object.keys(updateBodyWithUTCTime).forEach((key) => {
    schedule[key] = updateBodyWithUTCTime[key];
  });

  if (updateBody.client && updateBody.client !== schedule.client.toString()) {
    const oldClient = await Client.findById(schedule.client);
    if (oldClient) {
      oldClient.schedules.pull(schedule._id);
      await oldClient.save();
    }
    const newClient = await Client.findById(updateBody.client);
    if (newClient) {
      newClient.schedules.push(schedule._id);
      await newClient.save();
    }
  }
  await schedule.save();
  await schedule.populate({
    path: 'client',
    populate: { path: 'org' }
  });
  
  return schedule;
};

const deleteSchedule = async (id) => {
  const schedule = await getScheduleById(id);
  if (!schedule) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Schedule not found');
  }

  const client = await Client.findById(schedule.client);
  if (!client) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }
  client.schedules.pull(schedule.id);
  await client.save();

  await schedule.delete();
  return schedule;
};

const getScheduleById = async (id) => {
  const schedule = await Schedule.findById(id).populate({
    path: 'client',
    populate: { path: 'org' }
  });
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
