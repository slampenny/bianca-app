// seedDatabase.js - Refactored version using modular seeders
const mongoose = require('mongoose');
const {
  Alert,
  Org,
  Caregiver,
  Client,
  Conversation,
  Message,
  Schedule,
  PaymentMethod,
  Invoice,
  Call,
  MedicalAnalysis,
  FraudAbuseAnalysis,
  OnboardingResponse,
} = require('../models');
const config = require('../config/config');

// Import seeders
const orgsSeeder = require('./seeders/orgs.seeder');
const caregiversSeeder = require('./seeders/caregivers.seeder');
const clientsSeeder = require('./seeders/clients.seeder');
const conversationsSeeder = require('./seeders/conversations.seeder');
const schedulesSeeder = require('./seeders/schedules.seeder');
const alertsSeeder = require('./seeders/alerts.seeder');
const paymentMethodsSeeder = require('./seeders/paymentMethods.seeder');
const invoicesSeeder = require('./seeders/invoices.seeder');
const sentimentAnalysisSeeder = require('./seeders/sentimentAnalysis.seeder');
const emergencyPhrasesSeeder = require('./seeders/emergencyPhrases.seeder');
const clientReportSnapshotSeeder = require('./seeders/clientReportSnapshot.seeder');
const onboardingSeeder = require('./seeders/onboarding.seeder');

/**
 * Clear all database collections
 */
async function clearDatabase() {
  console.log('Clearing the database...');
  await Org.deleteMany({});
  await Caregiver.deleteMany({});
  await Client.deleteMany({});
  await Alert.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});
  await Schedule.deleteMany({});
  await PaymentMethod.deleteMany({});
  await Invoice.deleteMany({});
  await Call.deleteMany({});
  await OnboardingResponse.deleteMany({});
  await MedicalAnalysis.deleteMany({});
  await FraudAbuseAnalysis.deleteMany({});
  // Note: EmergencyPhrase is NOT cleared - it's seeded separately and should persist
  console.log('Database cleared');
}

/**
 * Main seed database function
 */
async function seedDatabase() {
  try {
    // Load secrets from AWS Secrets Manager (required for OpenAI API key in production/staging)
    await config.loadSecrets();
    console.log('Secrets loaded from AWS Secrets Manager');
    
    // Connect to the database
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to database');

    // Clear the database
    await clearDatabase();

    // Seed emergency phrases first (needed for emergency detection)
    await emergencyPhrasesSeeder.seedEmergencyPhrases();

    // Seed organizations
    const org = await orgsSeeder.seedOrgs();

    // Seed caregivers
    const caregivers = await caregiversSeeder.seedCaregivers(org);
    const caregiverOneRecord = caregivers.find(c => c.email === 'fake@example.org');
    const adminRecord = caregivers.find(c => c.email === 'admin@example.org');
    
    if (!caregiverOneRecord) {
      throw new Error('caregiverOne not found in inserted caregivers');
    }

    // Seed clients
    let clients = await clientsSeeder.seedClients(caregiverOneRecord);
    const client1 = clients[0];
    const client2 = clients[1];

    // Create a third client for fraud/abuse testing
    const client3 = new Client({
      name: 'Margaret Thompson',
      preferredName: 'Margaret',
      age: 76,
      room: '203C',
      email: 'vulnerable@example.org',
      phone: '1234567892',
      preferredLanguage: 'en',
      notes: 'Needs extra reassurance during calls; monitor for potential vulnerability cues.',
      moveInDate: new Date('2024-03-20T00:00:00.000Z'),
      emergencyContact: {
        name: 'Elaine Thompson',
        relationship: 'Niece',
        phone: '1234567803',
        email: 'elaine.thompson@example.org',
      },
      caregivers: [caregiverOneRecord.id],
      org: caregiverOneRecord.org,
      schedules: [],
      isActive: true
    });
    await client3.save();
    caregiverOneRecord.clients.push(client3._id);
    await caregiverOneRecord.save();
    clients = [...clients, client3];

    await onboardingSeeder.seedPrimaryTestClientsOnboarding(client1, client2, client3, caregiverOneRecord._id);

    // Seed conversations
    const conversations = await conversationsSeeder.seedConversations(client1);
    
    // Add additional conversation types
    await conversationsSeeder.addDecliningPatientConversations(client1._id);
    await conversationsSeeder.addNormalPatientConversations(client2._id);
    await conversationsSeeder.addRecentPatientConversations(client1._id);
    await conversationsSeeder.addRecentPatientConversations(client2._id);
    
    // Add fraud/abuse pattern conversations for client3
    await conversationsSeeder.addFraudAbuseConversations(client3._id);

    // Seed schedules
    await schedulesSeeder.seedSchedules(clients);

    // Seed alerts
    await alertsSeeder.seedAlerts(caregiverOneRecord, clients, conversations);

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

    // Run medical analysis on seeded client data
    console.log('Running medical analysis on seeded client data...');
    try {
      const medicalAnalysisScheduler = require('../services/ai/medicalAnalysisScheduler.service');
      
      // Wait a moment for the scheduler to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Run multiple analyses on client1 to create trend data
      console.log('Triggering multiple medical analyses for client1...');
      for (let i = 0; i < 3; i++) {
        await medicalAnalysisScheduler.scheduleClientAnalysis(client1._id.toString(), {
          trigger: 'seeding',
          batchId: `seeding-${Date.now()}-${i}`
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Also run analysis on client2 for variety
      console.log('Triggering medical analysis for client2...');
      await medicalAnalysisScheduler.scheduleClientAnalysis(client2._id.toString(), {
        trigger: 'seeding',
        batchId: `seeding-${Date.now()}`
      });
      
      console.log('Medical analysis jobs scheduled for seeded data');
    } catch (error) {
      console.warn('Failed to run medical analysis on seeded data:', error.message);
      // Don't fail the entire seeding process if medical analysis fails
    }

    await clientReportSnapshotSeeder.seedClientReportSnapshots([client1, client2, client3]);

    console.log('Database seeded successfully!');
    return { 
      org, 
      caregiver: caregiverOneRecord, 
      clients: [client1, client2, client3], 
      invoice, 
      paymentMethods 
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

