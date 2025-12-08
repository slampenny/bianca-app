// seedDatabase.js - Refactored version using modular seeders
const mongoose = require('mongoose');
const { Alert, Org, Caregiver, Patient, Conversation, Message, Schedule, PaymentMethod, Invoice, EmergencyPhrase } = require('../models');
const config = require('../config/config');

// Import seeders
const orgsSeeder = require('./seeders/orgs.seeder');
const caregiversSeeder = require('./seeders/caregivers.seeder');
const patientsSeeder = require('./seeders/patients.seeder');
const conversationsSeeder = require('./seeders/conversations.seeder');
const schedulesSeeder = require('./seeders/schedules.seeder');
const alertsSeeder = require('./seeders/alerts.seeder');
const paymentMethodsSeeder = require('./seeders/paymentMethods.seeder');
const invoicesSeeder = require('./seeders/invoices.seeder');
const sentimentAnalysisSeeder = require('./seeders/sentimentAnalysis.seeder');
const emergencyPhrasesSeeder = require('./seeders/emergencyPhrases.seeder');

/**
 * Clear all database collections
 */
async function clearDatabase() {
  console.log('Clearing the database...');
  await Org.deleteMany({});
  await Caregiver.deleteMany({});
  await Patient.deleteMany({});
  await Alert.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await Schedule.deleteMany({});
  await PaymentMethod.deleteMany({});
  await Invoice.deleteMany({});
  await EmergencyPhrase.deleteMany({}); // Clear emergency phrases so they can be re-seeded
  console.log('Database cleared');
}

/**
 * Main seed database function
 */
async function seedDatabase() {
  try {
    // Connect to the database
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to database');

    // Clear the database
    await clearDatabase();

    // Seed emergency phrases first (needed for emergency detection)
    const emergencyPhrases = await emergencyPhrasesSeeder.seedEmergencyPhrases();

    // Seed organizations
    const org = await orgsSeeder.seedOrgs();

    // Seed caregivers
    const caregivers = await caregiversSeeder.seedCaregivers(org);
    const caregiverOneRecord = caregivers.find(c => c.email === 'fake@example.org');
    const adminRecord = caregivers.find(c => c.email === 'admin@example.org');
    
    if (!caregiverOneRecord) {
      throw new Error('caregiverOne not found in inserted caregivers');
    }

    // Seed patients
    const patients = await patientsSeeder.seedPatients(caregiverOneRecord);
    const patient1 = patients[0];
    const patient2 = patients[1];

    // Create a third patient for fraud/abuse testing
    const patient3 = new Patient({
      name: 'Margaret Thompson',
      email: 'vulnerable@example.org',
      phone: '1234567892',
      caregivers: [caregiverOneRecord.id],
      org: caregiverOneRecord.org,
      schedules: [],
      isActive: true
    });
    await patient3.save();
    caregiverOneRecord.patients.push(patient3._id);
    await caregiverOneRecord.save();
    patients.push(patient3);

    // Seed conversations
    const conversations = await conversationsSeeder.seedConversations(patient1);
    
    // Add additional conversation types
    await conversationsSeeder.addDecliningPatientConversations(patient1._id);
    await conversationsSeeder.addNormalPatientConversations(patient2._id);
    await conversationsSeeder.addRecentPatientConversations(patient1._id);
    await conversationsSeeder.addRecentPatientConversations(patient2._id);
    
    // Add fraud/abuse pattern conversations for patient3
    await conversationsSeeder.addFraudAbuseConversations(patient3._id);

    // Seed schedules
    await schedulesSeeder.seedSchedules(patients);

    // Seed alerts
    await alertsSeeder.seedAlerts(caregiverOneRecord, patients, conversations);

    // Seed payment methods (with proper test data: one default, one non-default, at least 3 total)
    const paymentMethods = await paymentMethodsSeeder.seedPaymentMethods(org);
    console.log('Seeded payment methods:', paymentMethods.map(pm => ({
      id: pm._id,
      brand: pm.brand,
      last4: pm.last4,
      isDefault: pm.isDefault
    })));

    // Seed invoices
    const invoice = await invoicesSeeder.seedInvoices(org, paymentMethods);

    // Add sentiment analysis to conversations
    await sentimentAnalysisSeeder.seedSentimentAnalysis();

    // Run medical analysis on seeded patient data
    console.log('Running medical analysis on seeded patient data...');
    try {
      const medicalAnalysisScheduler = require('../services/ai/medicalAnalysisScheduler.service');
      
      // Wait a moment for the scheduler to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Run multiple analyses on patient1 to create trend data
      console.log('Triggering multiple medical analyses for patient1...');
      for (let i = 0; i < 3; i++) {
        await medicalAnalysisScheduler.schedulePatientAnalysis(patient1._id.toString(), {
          trigger: 'seeding',
          batchId: `seeding-${Date.now()}-${i}`
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Also run analysis on patient2 for variety
      console.log('Triggering medical analysis for patient2...');
      await medicalAnalysisScheduler.schedulePatientAnalysis(patient2._id.toString(), {
        trigger: 'seeding',
        batchId: `seeding-${Date.now()}`
      });
      
      console.log('Medical analysis jobs scheduled for seeded data');
    } catch (error) {
      console.warn('Failed to run medical analysis on seeded data:', error.message);
      // Don't fail the entire seeding process if medical analysis fails
    }

    console.log('Database seeded successfully!');
    
    // Calculate emergency phrases summary
    const emergencyPhrasesSummary = {
      total: emergencyPhrases.length,
      byLanguage: emergencyPhrases.reduce((acc, p) => {
        acc[p.language] = (acc[p.language] || 0) + 1;
        return acc;
      }, {}),
      bySeverity: emergencyPhrases.reduce((acc, p) => {
        acc[p.severity] = (acc[p.severity] || 0) + 1;
        return acc;
      }, {})
    };
    
    return { 
      org, 
      caregiver: caregiverOneRecord, 
      patients: [patient1, patient2, patient3], 
      invoice, 
      paymentMethods,
      emergencyPhrases: emergencyPhrasesSummary
    };
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Only run the function if this file is being executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

// Export the function so it can be imported elsewhere
module.exports = seedDatabase;

