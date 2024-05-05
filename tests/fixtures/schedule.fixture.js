const mongoose = require('mongoose');
const faker = require('faker');
const { Patient, Schedule } = require('../../src/models');

// Example schedules for testing
const scheduleOne = {
  frequency: 'weekly',
  intervals: [{ day: 3, weeks: 1 }], // Wednesday every week
  time: '14:30',
};

const scheduleTwo = {
  frequency: 'monthly',
  intervals: [{ day: 15 }], // 15th of every month
  time: '09:45',
};

const insertSchedules = async (schedules) => {
  const dbSchedules = schedules.map(data => new Schedule(data));
  dbSchedules.forEach(schedule => schedule.calculateNextCallDate());
  return await Schedule.insertMany(dbSchedules.map(schedule => schedule.toObject()));
};

const insertScheduleAndAddToPatient = async (patient, scheduleParam) => {
  const [schedule] = await insertSchedules([{patientId: patient.id, ...scheduleParam}]);
  return schedule;
}

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
  insertScheduleAndAddToPatient,
};
