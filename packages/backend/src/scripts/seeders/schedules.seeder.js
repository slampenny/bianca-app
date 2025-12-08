const scheduleFixture = require('../../../tests/fixtures/schedule.fixture');

/**
 * Seed schedules for patients
 * @param {Array} patients - Array of patients to seed schedules for
 * @returns {Promise<Array>} Array of created schedules
 */
async function seedSchedules(patients) {
  console.log('Seeding Schedules...');
  const { scheduleOne, scheduleTwo, insertScheduleAndAddToPatient } = scheduleFixture;
  
  const schedules = [];
  if (patients.length > 0) {
    await insertScheduleAndAddToPatient(patients[0], scheduleOne);
    schedules.push(scheduleOne);
  }
  if (patients.length > 1) {
    await insertScheduleAndAddToPatient(patients[1], scheduleTwo);
    schedules.push(scheduleTwo);
  }
  
  console.log(`Seeded ${schedules.length} schedules`);
  return schedules;
}

module.exports = {
  seedSchedules,
};

