const httpStatus = require('http-status');
const { Schedule, Patient, Org } = require('../models');
const ApiError = require('../utils/ApiError');
const { convertOrgTimeToUTC } = require('../utils/timezone.utils');

const createSchedule = async (patientId, scheduleData) => {
  // Get the patient to find their org
  const patient = await Patient.findById(patientId).populate('org');

  // Check if the patient exists
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  // Get org timezone (default to 'America/New_York' if not set)
  const orgTimezone = patient.org?.timezone || 'America/New_York';

  // Convert time from org timezone to UTC before storing
  const scheduleDataWithUTCTime = { ...scheduleData };
  if (scheduleData.time) {
    scheduleDataWithUTCTime.time = convertOrgTimeToUTC(scheduleData.time, orgTimezone);
  }

  // Create the schedule with UTC time
  const schedule = await Schedule.create({ ...scheduleDataWithUTCTime, patient: patientId });

  // Add the new schedule's ID to the patient's schedules field
  patient.schedules.push(schedule.id);
  await patient.save();

  // Populate patient.org for DTO conversion
  await schedule.populate({
    path: 'patient',
    populate: { path: 'org' }
  });

  return schedule;
};

const updateSchedule = async (scheduleId, updateBody) => {
  const schedule = await Schedule.findById(scheduleId).populate({
    path: 'patient',
    populate: { path: 'org' }
  });
  if (!schedule) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Schedule not found');
  }

  // Get org timezone (default to 'America/New_York' if not set)
  const orgTimezone = schedule.patient?.org?.timezone || 'America/New_York';

  // Convert time from org timezone to UTC if time is being updated
  const updateBodyWithUTCTime = { ...updateBody };
  if (updateBody.time) {
    updateBodyWithUTCTime.time = convertOrgTimeToUTC(updateBody.time, orgTimezone);
  }

  Object.keys(updateBodyWithUTCTime).forEach((key) => {
    schedule[key] = updateBodyWithUTCTime[key];
  });

  if (updateBody.patient && updateBody.patient !== schedule.patient.toString()) {
    const oldPatient = await Patient.findById(schedule.patientId);
    oldPatient.schedules.pull(schedule.id);
    await oldPatient.save();

    const newPatient = await Patient.findById(updateBody.patient);
    newPatient.schedules.push(schedule.id);
    await newPatient.save();
  }

  await schedule.save();
  
  // Re-populate patient.org after save for DTO conversion
  await schedule.populate({
    path: 'patient',
    populate: { path: 'org' }
  });
  
  return schedule;
};

const patchSchedule = async (id, updateBody) => {
  const schedule = await getScheduleById(id);
  
  // Get org timezone (default to 'America/New_York' if not set)
  const orgTimezone = schedule.patient?.org?.timezone || 'America/New_York';

  // Convert time from org timezone to UTC if time is being updated
  const updateBodyWithUTCTime = { ...updateBody };
  if (updateBody.time) {
    updateBodyWithUTCTime.time = convertOrgTimeToUTC(updateBody.time, orgTimezone);
  }

  Object.keys(updateBodyWithUTCTime).forEach((key) => {
    schedule[key] = updateBodyWithUTCTime[key];
  });

  // If the patientId is updated, remove the schedule's ID from the old patient's schedules field
  // and add it to the new patient's schedules field
  if (updateBody.patient && updateBody.patient !== schedule.patient.toString()) {
    const oldPatient = await Patient.findById(schedule.patient);
    oldPatient.schedules.pull(schedule._id);
    await oldPatient.save();

    const newPatient = await Patient.findById(updateBody.patient);
    newPatient.schedules.push(schedule._id);
    await newPatient.save();
  }

  await schedule.save();
  
  // Re-populate patient.org after save for DTO conversion
  await schedule.populate({
    path: 'patient',
    populate: { path: 'org' }
  });
  
  return schedule;
};

const deleteSchedule = async (id) => {
  const schedule = await getScheduleById(id);
  if (!schedule) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Schedule not found');
  }

  // Remove the schedule's ID from the patient's schedules field
  const patient = await Patient.findById(schedule.patient);

  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  patient.schedules.pull(schedule.id);
  await patient.save();

  await schedule.delete();
  return schedule;
};

const getScheduleById = async (id) => {
  const schedule = await Schedule.findById(id).populate({
    path: 'patient',
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
