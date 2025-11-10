const alertFixture = require('../../../tests/fixtures/alert.fixture');

/**
 * Seed alerts for a caregiver
 * @param {Object} caregiver - Caregiver to seed alerts for
 * @param {Array} patients - Array of patients for related alerts
 * @param {Array} conversations - Array of conversations for related alerts
 * @returns {Promise<Array>} Array of created alerts
 */
async function seedAlerts(caregiver, patients = [], conversations = []) {
  console.log('Seeding Alerts...');
  const { alertOne, alertTwo, alertThree, expiredAlert, insertAlerts } = alertFixture;
  
  const alertsToSeed = [alertOne, alertTwo, alertThree, expiredAlert];
  
  // Add conversation-related alerts if we have conversations
  if (conversations.length > 0 && patients.length > 0) {
    const conversationAlertThree = {
      ...alertThree,
      relatedPatient: patients[0]._id,
      relatedConversation: conversations[0]?._id,
    };
    
    alertsToSeed.push(conversationAlertThree);
  }
  
  await insertAlerts(caregiver, 'Caregiver', alertsToSeed);
  console.log(`Seeded ${alertsToSeed.length} alerts`);
  
  return alertsToSeed;
}

module.exports = {
  seedAlerts,
};

