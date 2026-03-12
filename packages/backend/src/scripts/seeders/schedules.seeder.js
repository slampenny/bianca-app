const scheduleFixture = require('../../../tests/fixtures/schedule.fixture');

/**
 * Seed schedules for clients
 * @param {Array} clients - Array of clients to seed schedules for
 * @returns {Promise<Array>} Array of created schedules
 */
async function seedSchedules(clients) {
  console.log('Seeding Schedules...');
  const { scheduleOne, scheduleTwo, insertScheduleAndAddToClient } = scheduleFixture;
  
  const schedules = [];
  if (clients.length > 0) {
    await insertScheduleAndAddToClient(clients[0], scheduleOne);
    schedules.push(scheduleOne);
  }
  if (clients.length > 1) {
    await insertScheduleAndAddToClient(clients[1], scheduleTwo);
    schedules.push(scheduleTwo);
  }
  
  console.log(`Seeded ${schedules.length} schedules`);
  return schedules;
}

module.exports = {
  seedSchedules,
};

