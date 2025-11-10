const patientFixture = require('../../../tests/fixtures/patient.fixture');

/**
 * Seed patients for a caregiver
 * @param {Object} caregiver - Caregiver to seed patients for
 * @returns {Promise<Array>} Array of created patients
 */
async function seedPatients(caregiver) {
  console.log('Seeding Patients for caregiver:', caregiver._id);
  const { patientOne, patientTwo, insertPatientsAndAddToCaregiver } = patientFixture;
  
  const patients = await insertPatientsAndAddToCaregiver(caregiver, [patientOne, patientTwo]);
  console.log(`Seeded ${patients.length} patients`);
  
  return patients;
}

module.exports = {
  seedPatients,
};

