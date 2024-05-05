const httpStatus = require('http-status');
const { Schedule, Patient } = require('../models');
const ApiError = require('../utils/ApiError');

const createSchedule = async (patientId, scheduleData) => {
  // Create the schedule
  const schedule = new Schedule({...scheduleData, patientId});

  // Save the schedule
  const savedSchedule = await schedule.save();

  // Add the new schedule's ID to the patient's schedules field
  const patient = await Patient.findById(patientId);
  
  // Check if the patient exists
  if (!patient) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Patient not found');
  }

  patient.schedules.push(savedSchedule.id);
  await patient.save();

  return savedSchedule;
};

const updateSchedule = async (scheduleId, updateBody) => {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    throw new Error('Schedule not found');
  }

  Object.keys(updateBody).forEach((key) => {
    schedule[key] = updateBody[key];
  });

  if (updateBody.patientId && updateBody.patientId !== schedule.patientId.toString()) {
    const oldPatient = await Patient.findById(schedule.patientId);
    oldPatient.schedules.pull(schedule.id);
    await oldPatient.save();

    const newPatient = await Patient.findById(updateBody.patientId);
    newPatient.schedules.push(schedule.id);
    await newPatient.save();
  }

  await schedule.save();
  return schedule;
};

const patchSchedule = async (id, updateBody) => {
  const schedule = await getScheduleById(id);
  Object.keys(updateBody).forEach((key) => {
    schedule[key] = updateBody[key];
  });

  // If the patientId is updated, remove the schedule's ID from the old patient's schedules field
  // and add it to the new patient's schedules field
  if (updateBody.patientId && updateBody.patientId !== schedule.patientId.toString()) {
    const oldPatient = await Patient.findById(schedule.patientId);
    oldPatient.schedules.pull(schedule._id);
    await oldPatient.save();

    const newPatient = await Patient.findById(updateBody.patientId);
    newPatient.schedules.push(schedule._id);
    await newPatient.save();
  }

  await schedule.save();
  return schedule;
};

const deleteSchedule = async (id) => {
  const schedule = await getScheduleById(id);

  // Remove the schedule's ID from the patient's schedules field
  const patient = await Patient.findById(schedule.patientId);
  patient.schedules.pull(schedule.id);
  await patient.save();

  await schedule.delete();
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