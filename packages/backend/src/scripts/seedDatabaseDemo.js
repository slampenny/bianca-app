// seedDatabaseDemo.js - Comprehensive demo data seeder for showcasing all app features
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
  await MedicalAnalysis.deleteMany({});
  await FraudAbuseAnalysis.deleteMany({});
  // Note: EmergencyPhrase is NOT cleared - it's seeded separately and should persist
  console.log('Database cleared');
}

/**
 * Create additional demo clients with various scenarios
 */
async function createDemoClients(caregiver, org) {
  console.log('Creating additional demo clients...');
  const demoClients = [];
  
  const clientData = [
    {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@demo.com',
      phone: '1234567893',
      age: 72,
      preferredName: 'Sarah',
      preferredLanguage: 'en',
      notes: 'Active client with regular wellness checks. Enjoys talking about her grandchildren.',
      isActive: true,
      isEmailVerified: true,
    },
    {
      name: 'Robert Martinez',
      email: 'robert.martinez@demo.com',
      phone: '1234567894',
      age: 68,
      preferredName: 'Bob',
      preferredLanguage: 'es',
      notes: 'Spanish-speaking client. Prefers morning calls.',
      isActive: true,
      isEmailVerified: true,
    },
    {
      name: 'Emily Chen',
      email: 'emily.chen@demo.com',
      phone: '1234567895',
      age: 75,
      preferredName: 'Emily',
      preferredLanguage: 'zh',
      notes: 'Chinese-speaking client. Needs medication reminders.',
      isActive: true,
      isEmailVerified: true,
    },
    {
      name: 'James Wilson',
      email: 'james.wilson@demo.com',
      phone: '1234567896',
      age: 80,
      preferredName: 'Jim',
      preferredLanguage: 'en',
      notes: 'Veteran. Shows signs of declining health. Monitor closely.',
      isActive: true,
      isEmailVerified: true,
    },
    {
      name: 'Maria Garcia',
      email: 'maria.garcia@demo.com',
      phone: '1234567897',
      age: 65,
      preferredName: 'Maria',
      preferredLanguage: 'es',
      notes: 'Recently discharged from hospital. Needs frequent check-ins.',
      isActive: true,
      isEmailVerified: true,
    },
    {
      name: 'David Lee',
      email: 'david.lee@demo.com',
      phone: '1234567898',
      age: 70,
      preferredName: 'David',
      preferredLanguage: 'en',
      notes: 'Lives alone. Has mobility issues. Regular wellness checks important.',
      isActive: true,
      isEmailVerified: true,
    },
  ];

  for (const data of clientData) {
    const client = new Client({
      ...data,
      caregivers: [caregiver._id],
      org: org._id,
      schedules: [],
    });
    await client.save();
    caregiver.clients.push(client._id);
    demoClients.push(client);
  }
  
  await caregiver.save();
  console.log(`Created ${demoClients.length} additional demo clients`);
  return demoClients;
}

/**
 * Create demo conversations for clients
 */
async function createDemoConversations(clients) {
  console.log('Creating demo conversations...');
  const conversations = [];
  const now = new Date();
  
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    const daysAgo = [1, 3, 7, 14, 21, 30, 45, 60];
    
    for (let j = 0; j < daysAgo.length; j++) {
      const days = daysAgo[j];
      const convDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      convDate.setHours(10 + (j % 8), 0, 0, 0);
      
      const call = new Call({
        callSid: `DEMO_CALL_${client._id}_${Date.now()}_${j}_${Math.random().toString(36).substr(2, 9)}`,
        clientId: client._id,
        callType: 'wellness-check',
        status: 'completed',
        callStatus: 'ended',
        callOutcome: 'answered',
        startTime: convDate,
        endTime: new Date(convDate.getTime() + (20 + Math.random() * 15) * 60 * 1000),
        callStartTime: convDate,
        callEndTime: new Date(convDate.getTime() + (20 + Math.random() * 15) * 60 * 1000),
        duration: Math.floor(20 + Math.random() * 15),
        callDuration: Math.floor(20 + Math.random() * 15),
        cost: 0.20 + Math.random() * 0.15,
        lineItemId: null
      });
      await call.save();
      
      const conversationMessages = [
        {
          role: 'assistant',
          content: `Hello ${client.preferredName || client.name.split(' ')[0]}! This is Bianca calling for your wellness check. How are you feeling today?`
        },
        {
          role: 'client',
          content: j === 0 
            ? 'Hello! I am feeling really good today. I had a great week and I am very happy with how things are going. My medications are working well and I have been sleeping better.'
            : j === 1
            ? 'I am doing okay today. Some days are better than others, but overall I am managing well. I have been taking my medications as prescribed.'
            : j === 2
            ? 'I wanted to check in about my health. I have been feeling a bit tired lately, but I am still managing my daily activities. I am following my medication schedule.'
            : 'Thank you for calling. I appreciate the check-in. Everything is going well and I am taking care of myself.'
        },
        {
          role: 'assistant',
          content: j === 0
            ? 'That is wonderful to hear! I am so glad you are feeling positive and that your medications are working well.'
            : 'Thank you for the update. It is good to hear that you are managing well overall. Consistency with medications is important.'
        }
      ];
      
      const conv = new Conversation({
        callId: call._id,
        clientId: client._id,
        messages: [],
        history: `Wellness check conversation from ${days} days ago.`,
        analyzedData: {},
        metadata: { source: 'demo_seed', daysAgo: days, clientIndex: i },
        createdAt: convDate,
        updatedAt: convDate,
        startTime: convDate,
        endTime: new Date(convDate.getTime() + (20 + Math.random() * 15) * 60 * 1000),
        duration: Math.floor(20 + Math.random() * 15),
        status: 'completed',
        callType: 'wellness-check',
        cost: 0.20 + Math.random() * 0.15,
        lineItemId: null
      });
      await conv.save();
      
      for (const msgData of conversationMessages) {
        const msg = new Message({
          role: msgData.role,
          content: msgData.content,
          conversationId: conv._id
        });
        await msg.save();
        conv.messages.push(msg._id);
      }
      
      await conv.save();
      conversations.push(conv);
    }
  }
  
  console.log(`Created ${conversations.length} demo conversations`);
  return conversations;
}

/**
 * Create demo schedules for clients
 */
async function createDemoSchedules(clients) {
  console.log('Creating demo schedules...');
  const schedules = [];
  
  for (let i = 0; i < clients.length; i++) {
    const client = clients[i];
    
    // Create different schedule types
    const scheduleTypes = [
      {
        frequency: 'daily',
        time: '09:00',
        isActive: true,
      },
      {
        frequency: 'weekly',
        time: '14:00',
        intervals: [{ day: 1, weeks: 1 }], // Monday every week
        isActive: true,
      },
      {
        frequency: 'monthly',
        time: '16:00',
        intervals: [{ day: 15 }], // 15th of every month
        isActive: i % 2 === 0, // Some active, some inactive
      },
    ];
    
    for (const scheduleData of scheduleTypes) {
      const schedule = new Schedule({
        ...scheduleData,
        client: client._id,
        org: client.org,
      });
      schedule.calculateNextCallDate();
      await schedule.save();
      client.schedules.push(schedule._id);
      schedules.push(schedule);
    }
    
    await client.save();
  }
  
  console.log(`Created ${schedules.length} demo schedules`);
  return schedules;
}

/**
 * Create demo alerts with various severities
 */
async function createDemoAlerts(caregiver, clients, conversations) {
  console.log('Creating demo alerts...');
  const alerts = [];
  const now = new Date();
  
  const alertData = [
    {
      importance: 'urgent',
      alertType: 'conversation',
      message: 'Emergency Detected: Client mentioned feeling chest pain and shortness of breath.',
      relatedClient: clients[0]?._id,
      relatedConversation: conversations[0]?._id,
      visibility: 'allCaregivers',
      createdBy: caregiver._id,
      createdModel: 'Caregiver',
      relevanceUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours from now
      readBy: [],
    },
    {
      importance: 'high',
      alertType: 'client',
      message: 'Medication Missed: Client has missed medication for 3 consecutive days.',
      relatedClient: clients[1]?._id,
      visibility: 'assignedCaregivers',
      createdBy: caregiver._id,
      createdModel: 'Caregiver',
      relevanceUntil: new Date(now.getTime() + 48 * 60 * 60 * 1000), // 48 hours from now
      readBy: [],
    },
    {
      importance: 'medium',
      alertType: 'conversation',
      message: 'Declining Health Pattern: Client showing signs of declining health over the past month.',
      relatedClient: clients[2]?._id,
      relatedConversation: conversations[10]?._id,
      visibility: 'allCaregivers',
      createdBy: caregiver._id,
      createdModel: 'Caregiver',
      relevanceUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      readBy: [caregiver._id], // Mark as read
    },
    {
      importance: 'high',
      alertType: 'conversation',
      message: 'Potential Financial Exploitation: Client mentioned sending large amounts of money to unknown individuals.',
      relatedClient: clients[3]?._id,
      relatedConversation: conversations[15]?._id,
      visibility: 'orgAdmin',
      createdBy: caregiver._id,
      createdModel: 'Caregiver',
      relevanceUntil: new Date(now.getTime() + 72 * 60 * 60 * 1000), // 72 hours from now
      readBy: [],
    },
    {
      importance: 'medium',
      alertType: 'client',
      message: 'Missed Call: Client did not answer scheduled wellness check call.',
      relatedClient: clients[4]?._id,
      visibility: 'assignedCaregivers',
      createdBy: caregiver._id,
      createdModel: 'Caregiver',
      relevanceUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours from now
      readBy: [caregiver._id], // Mark as read
    },
    {
      importance: 'low',
      alertType: 'system',
      message: 'Schedule Updated: Client schedule has been updated successfully.',
      visibility: 'allCaregivers',
      createdBy: caregiver._id,
      createdModel: 'Caregiver',
      relevanceUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours from now
      readBy: [caregiver._id], // Mark as read
    },
  ];
  
  for (const data of alertData) {
    const alert = new Alert(data);
    await alert.save();
    alerts.push(alert);
  }
  
  console.log(`Created ${alerts.length} demo alerts`);
  return alerts;
}

/**
 * Create additional demo invoices
 */
async function createDemoInvoices(org, paymentMethods) {
  console.log('Creating demo invoices...');
  const invoices = [];
  const now = new Date();
  
  const invoiceData = [
    {
      invoiceNumber: `INV-DEMO-${Date.now()}-1`,
      issueDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      status: 'paid',
      totalAmount: 299.99,
      paymentMethod: paymentMethods[0]?._id,
      stripePaymentIntentId: 'pi_demo_paid_1',
      stripeInvoiceId: 'in_demo_paid_1',
      notes: 'Monthly subscription - Paid',
    },
    {
      invoiceNumber: `INV-DEMO-${Date.now()}-2`,
      issueDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
      status: 'pending',
      totalAmount: 299.99,
      paymentMethod: paymentMethods[0]?._id,
      stripePaymentIntentId: 'pi_demo_pending_1',
      stripeInvoiceId: 'in_demo_pending_1',
      notes: 'Monthly subscription - Pending payment',
    },
    {
      invoiceNumber: `INV-DEMO-${Date.now()}-3`,
      issueDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      status: 'overdue',
      totalAmount: 299.99,
      paymentMethod: paymentMethods[1]?._id,
      stripePaymentIntentId: 'pi_demo_overdue_1',
      stripeInvoiceId: 'in_demo_overdue_1',
      notes: 'Monthly subscription - Overdue',
    },
  ];
  
  for (const data of invoiceData) {
    const invoice = new Invoice({
      ...data,
      org: org._id,
    });
    await invoice.save();
    invoices.push(invoice);
  }
  
  console.log(`Created ${invoices.length} demo invoices`);
  return invoices;
}

/**
 * Main demo seed database function
 */
async function seedDatabaseDemo() {
  const isCalledFromCommandLine = require.main === module;
  let shouldDisconnect = false;
  
  try {
    // Load secrets from AWS Secrets Manager (required for OpenAI API key in production/staging)
    await config.loadSecrets();
    console.log('Secrets loaded from AWS Secrets Manager');
    
    // Connect to the database only if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoose.url);
      shouldDisconnect = isCalledFromCommandLine; // Only disconnect if called from command line
      console.log('Connected to database');
    } else {
      console.log('Using existing database connection');
    }

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

    // Seed base clients
    const baseClients = await clientsSeeder.seedClients(caregiverOneRecord);
    const client1 = baseClients[0];
    const client2 = baseClients[1];

    // Create fraud/abuse test client
    const client3 = new Client({
      name: 'Margaret Thompson',
      email: 'vulnerable@example.org',
      phone: '1234567892',
      caregivers: [caregiverOneRecord.id],
      org: caregiverOneRecord.org,
      schedules: [],
      isActive: true
    });
    await client3.save();
    caregiverOneRecord.clients.push(client3._id);
    await caregiverOneRecord.save();

    // Create additional demo clients
    const demoClients = await createDemoClients(caregiverOneRecord, org);
    const allClients = [...baseClients, client3, ...demoClients];

    // Seed base conversations
    const baseConversations = await conversationsSeeder.seedConversations(client1);
    
    // Add additional conversation types
    await conversationsSeeder.addDecliningPatientConversations(client1._id);
    await conversationsSeeder.addNormalPatientConversations(client2._id);
    await conversationsSeeder.addRecentPatientConversations(client1._id);
    await conversationsSeeder.addRecentPatientConversations(client2._id);
    
    // Add fraud/abuse pattern conversations for client3
    await conversationsSeeder.addFraudAbuseConversations(client3._id);

    // Create additional demo conversations
    const demoConversations = await createDemoConversations(allClients);
    const allConversations = [...baseConversations, ...demoConversations];

    // Seed base schedules
    await schedulesSeeder.seedSchedules(baseClients);

    // Create additional demo schedules
    await createDemoSchedules(allClients);

    // Seed base alerts
    await alertsSeeder.seedAlerts(caregiverOneRecord, baseClients, baseConversations);

    // Create additional demo alerts
    await createDemoAlerts(caregiverOneRecord, allClients, allConversations);

    // Seed payment methods
    const paymentMethods = await paymentMethodsSeeder.seedPaymentMethods(org);
    console.log('Seeded payment methods:', paymentMethods.map(pm => ({
      id: pm._id,
      brand: pm.brand,
      last4: pm.last4,
      isDefault: pm.isDefault
    })));

    // Seed base invoice
    await invoicesSeeder.seedInvoices(org, paymentMethods);

    // Create additional demo invoices
    await createDemoInvoices(org, paymentMethods);

    // Add sentiment analysis to conversations
    await sentimentAnalysisSeeder.seedSentimentAnalysis();

    // Run medical analysis on seeded client data
    console.log('Running medical analysis on seeded client data...');
    try {
      const medicalAnalysisScheduler = require('../services/ai/medicalAnalysisScheduler.service');
      
      // Wait a moment for the scheduler to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Run analyses on multiple clients to create comprehensive demo data
      for (let i = 0; i < Math.min(5, allClients.length); i++) {
        const client = allClients[i];
        console.log(`Triggering medical analysis for client ${i + 1}...`);
        await medicalAnalysisScheduler.scheduleClientAnalysis(client._id.toString(), {
          trigger: 'demo_seeding',
          batchId: `demo-seeding-${Date.now()}-${i}`
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('Medical analysis jobs scheduled for demo data');
    } catch (error) {
      console.warn('Failed to run medical analysis on demo data:', error.message);
      // Don't fail the entire seeding process if medical analysis fails
    }

    await clientReportSnapshotSeeder.seedClientReportSnapshots(allClients);

    console.log('Demo database seeded successfully!');
    console.log(`Created:`);
    console.log(`- ${allClients.length} clients`);
    console.log(`- ${allConversations.length} conversations`);
    console.log(`- ${paymentMethods.length} payment methods`);
    console.log(`- Multiple schedules, alerts, and invoices`);
    
    return { 
      org, 
      caregiver: caregiverOneRecord, 
      clients: allClients, 
      paymentMethods 
    };
  } catch (error) {
    console.error('Error seeding demo database:', error);
    throw error;
  } finally {
    // Only disconnect if we connected in this function and it was called from command line
    if (shouldDisconnect && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('Disconnected from database');
    }
  }
}

// Only run the function if this file is being executed directly
if (require.main === module) {
  seedDatabaseDemo()
    .then(() => {
      console.log('Demo seeding completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Demo seeding failed:', error);
      process.exit(1);
    });
}

// Export the function so it can be imported elsewhere
module.exports = seedDatabaseDemo;
