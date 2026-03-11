const mongoose = require('mongoose');
const faker = require('faker');
const { Client, Schedule } = require('../../src/models');

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
  const dbSchedules = schedules.map((data) => new Schedule(data));
  dbSchedules.forEach((schedule) => schedule.calculateNextCallDate());
  return await Schedule.insertMany(dbSchedules.map((schedule) => schedule.toObject()));
};

const insertScheduleAndAddToClient = async (client, scheduleParam) => {
  const [schedule] = await insertSchedules([{ client: client._id, ...scheduleParam }]);

  client.schedules.push(schedule._id);
  await client.save();

  return schedule;
};

// const prepareSchedulesWithClients = async () => {
//   const [client1, client2] = await insertClients([clientOne, clientTwo]);
//   scheduleOne.client = client1._id;
//   scheduleTwo.client = client2._id;

//   const insertedSchedules = await insertSchedules([scheduleOne, scheduleTwo]);
//   client1.schedules.push(insertedSchedules[0]._id);
//   client2.schedules.push(insertedSchedules[1]._id);
//   await Client.findByIdAndUpdate(client1._id, { $set: { schedules: client1.schedules } });
//   await Client.findByIdAndUpdate(client2._id, { $set: { schedules: client2.schedules } });
//   return { insertedClients: [client1, client2], insertedSchedules };
// };

module.exports = {
  scheduleOne,
  scheduleTwo,
  insertSchedules,
  insertScheduleAndAddToClient,
  /** @deprecated Use insertScheduleAndAddToClient */
  insertScheduleAndAddToPatient: insertScheduleAndAddToClient,
};
