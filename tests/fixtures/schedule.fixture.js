const mongoose = require('mongoose');
const faker = require('faker');
const { Schedule } = require('../../src/models');

// Example schedules for testing
const scheduleOne = {
  frequency: 'weekly',
  intervals: [{ day: 3, weeks: 1 }], // Wednesday every week
  time: '14:30',
  nextCallDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
};

const scheduleTwo = {
  frequency: 'monthly',
  intervals: [{ day: 15 }], // 15th of every month
  time: '09:45',
  nextCallDate: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
};

const insertSchedules = async (schedules) => {
  return await Schedule.insertMany(schedules);
};

// const prepareSchedulesWithPatients = async () => {
//   const [patient1, patient2] = await insertPatients([patientOne, patientTwo]);
  
//   // Assign patient IDs to the schedules
//   scheduleOne.patientId = patient1._id;
//   scheduleTwo.patientId = patient2._id;

//   // Insert the schedules
//   const insertedSchedules = await insertSchedules([scheduleOne, scheduleTwo]);

//   // Add schedule IDs to patients
//   patient1.schedules.push(insertedSchedules[0]._id);
//   patient2.schedules.push(insertedSchedules[1]._id);
//   await Patient.findByIdAndUpdate(patient1._id, { $set: { schedules: patient1.schedules } });
//   await Patient.findByIdAndUpdate(patient2._id, { $set: { schedules: patient2.schedules } });

//   return { insertedPatients: [patient1, patient2], insertedSchedules };
// };

module.exports = {
  scheduleOne,
  scheduleTwo,
  insertSchedules,
};
