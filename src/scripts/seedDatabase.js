// seedDatabase.js
const mongoose = require('mongoose');
const faker = require('faker');
const { Alert, Org, Caregiver, Patient, Conversation, Message, Schedule, PaymentMethod, Invoice } = require('../models');
const config = require('../config/config');

const { orgOne, insertOrgs } = require('../../tests/fixtures/org.fixture');
// Use only these two caregivers to be in the same org:
const { caregiverOne, admin, insertCaregiversAndAddToOrg } = require('../../tests/fixtures/caregiver.fixture');
const { patientOne, patientTwo, insertPatientsAndAddToCaregiver } = require('../../tests/fixtures/patient.fixture');
const { alertOne, alertTwo, alertThree, expiredAlert, insertAlerts } = require('../../tests/fixtures/alert.fixture');
const { scheduleOne, scheduleTwo, insertScheduleAndAddToPatient } = require('../../tests/fixtures/schedule.fixture');
const { conversationOne, conversationTwo, insertConversations } = require('../../tests/fixtures/conversation.fixture');
const { paymentMethodOne, paymentMethodTwo, insertPaymentMethods } = require('../../tests/fixtures/paymentMethod.fixture');

async function seedDatabase() {
  try {
    // Connect to the database
    await mongoose.connect(config.mongoose.url, { useNewUrlParser: true, useUnifiedTopology: true });

    // Clear the database
    await Org.deleteMany({});
    await Caregiver.deleteMany({});
    await Patient.deleteMany({});
    await Alert.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Schedule.deleteMany({});
    await PaymentMethod.deleteMany({});
    await Invoice.deleteMany({});
    console.log('Cleared the database');

    // Insert a single organization
    const [org1] = await insertOrgs([orgOne]);
    console.log('Inserted org:', org1);

    // Set both caregivers to belong to the same org.
    caregiverOne.org = org1._id;
    admin.org = org1._id;

    // Insert caregivers and add them to org1.
    // This will insert both admin and caregiverOne to org1.
    const caregivers = await insertCaregiversAndAddToOrg(org1, [admin, caregiverOne]);
    console.log('Inserted caregivers:', caregivers);

    // Find the caregiverOne (fake@example.org) to associate patients with
    const caregiverOneRecord = caregivers.find(c => c.email === 'fake@example.org');
    const adminRecord = caregivers.find(c => c.email === 'admin@example.org');
    
    if (!caregiverOneRecord) {
      throw new Error('caregiverOne not found in inserted caregivers');
    }

    // Insert alerts
    await insertAlerts(caregiverOneRecord, 'Caregiver', [alertOne, alertTwo, alertThree, expiredAlert]);
    
    // Create additional alerts for testing
    const alertFour = {
      message: "Patient John Smith missed their scheduled medication dose",
      importance: 'high',
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 12), // 12 hours from now
      readBy: [],
    };
    
    const alertFive = {
      message: "New patient registration completed for Sarah Johnson",
      importance: 'low',
      visibility: 'allCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 72), // 72 hours from now
      readBy: [],
    };
    
    const alertSix = {
      message: "System maintenance scheduled for tonight at 2 AM",
      importance: 'medium',
      visibility: 'orgAdmin',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 6), // 6 hours from now
      readBy: [],
    };
    
    const alertSeven = {
      message: "Patient Mary Wilson reported feeling dizzy after medication",
      importance: 'urgent',
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 2), // 2 hours from now
      readBy: [],
    };
    
    const alertEight = {
      message: "Monthly billing report is ready for review",
      importance: 'low',
      visibility: 'orgAdmin',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 168), // 1 week from now
      readBy: [],
    };
    
    const alertNine = {
      message: "Patient Robert Davis completed their wellness check",
      importance: 'low',
      visibility: 'allCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
      readBy: [],
    };
    
    const alertTen = {
      message: "New caregiver training materials available",
      importance: 'medium',
      visibility: 'allCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 120), // 5 days from now
      readBy: [],
    };
    
    const alertEleven = {
      message: "Patient Lisa Brown needs follow-up appointment scheduling",
      importance: 'high',
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 48), // 48 hours from now
      readBy: [],
    };
    
    const alertTwelve = {
      message: "Database backup completed successfully",
      importance: 'low',
      visibility: 'orgAdmin',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours from now
      readBy: [],
    };
    
    const alertThirteen = {
      message: "Patient Michael Chen reported improved symptoms",
      importance: 'low',
      visibility: 'allCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 36), // 36 hours from now
      readBy: [],
    };
    
    const alertFourteen = {
      message: "Emergency contact protocol updated",
      importance: 'high',
      visibility: 'allCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 168), // 1 week from now
      readBy: [],
    };
    
    const alertFifteen = {
      message: "Patient Jennifer Lee missed their wellness check call",
      importance: 'medium',
      visibility: 'assignedCaregivers',
      relevanceUntil: new Date(Date.now() + 1000 * 60 * 60 * 4), // 4 hours from now
      readBy: [],
    };
    
    await insertAlerts(caregiverOneRecord, 'Caregiver', [
      alertOne, alertTwo, alertThree, expiredAlert, alertFour, alertFive, alertSix, alertSeven,
      alertEight, alertNine, alertTen, alertEleven, alertTwelve, alertThirteen, alertFourteen, alertFifteen
    ]);

    // Insert patients and add them to the caregiverOne (fake@example.org)
    const [patient1, patient2] = await insertPatientsAndAddToCaregiver(caregiverOneRecord, [patientOne, patientTwo]);
    
    // Create additional patients for testing
    const patientThree = {
      name: faker.name.findName(),
      email: faker.internet.email().toLowerCase(),
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientFour = {
      name: faker.name.findName(),
      email: faker.internet.email().toLowerCase(),
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientFive = {
      name: faker.name.findName(),
      email: faker.internet.email().toLowerCase(),
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientSix = {
      name: faker.name.findName(),
      email: faker.internet.email().toLowerCase(),
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientSeven = {
      name: faker.name.findName(),
      email: faker.internet.email().toLowerCase(),
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientEight = {
      name: faker.name.findName(),
      email: faker.internet.email().toLowerCase(),
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientNine = {
      name: faker.name.findName(),
      email: faker.internet.email().toLowerCase(),
      phone: '+16045624263',
      schedules: [],
    };
    
    const patientTen = {
      name: faker.name.findName(),
      email: faker.internet.email().toLowerCase(),
      phone: '+16045624263',
      schedules: [],
    };
    
    const [patient3, patient4, patient5, patient6, patient7, patient8, patient9, patient10] = 
      await insertPatientsAndAddToCaregiver(caregiverOneRecord, [
        patientThree, patientFour, patientFive, patientSix, 
        patientSeven, patientEight, patientNine, patientTen
      ]);
    
    console.log('Inserted patients:', patient1, patient2, patient3, patient4, patient5, patient6, patient7, patient8, patient9, patient10);

    // Insert conversations for patients.
    conversationOne.patientId = patient1._id;
    conversationTwo.patientId = patient2._id;
    
    // Create additional conversations for patient1 to test autoload
    const conversationThree = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 minutes later
      duration: faker.datatype.number({ min: 15, max: 45 }),
      status: 'completed',
      callType: 'wellness-check',
    };
    
    const conversationFour = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      endTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000), // 45 minutes later
      duration: faker.datatype.number({ min: 20, max: 60 }),
      status: 'completed',
      callType: 'follow-up',
    };
    
    const conversationFive = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      endTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000), // 25 minutes later
      duration: faker.datatype.number({ min: 10, max: 35 }),
      status: 'completed',
      callType: 'inbound',
    };
    
    const conversationSix = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      endTime: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000 + 35 * 60 * 1000), // 35 minutes later
      duration: faker.datatype.number({ min: 15, max: 40 }),
      status: 'completed',
      callType: 'wellness-check',
    };
    
    const conversationSeven = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
      endTime: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000 + 50 * 60 * 1000), // 50 minutes later
      duration: faker.datatype.number({ min: 25, max: 55 }),
      status: 'completed',
      callType: 'follow-up',
    };
    
    const conversationEight = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      endTime: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000), // 20 minutes later
      duration: faker.datatype.number({ min: 10, max: 25 }),
      status: 'completed',
      callType: 'inbound',
    };
    
    const conversationNine = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000), // 16 days ago
      endTime: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000 + 40 * 60 * 1000), // 40 minutes later
      duration: faker.datatype.number({ min: 20, max: 45 }),
      status: 'completed',
      callType: 'wellness-check',
    };
    
    const conversationTen = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), // 18 days ago
      endTime: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000), // 30 minutes later
      duration: faker.datatype.number({ min: 15, max: 35 }),
      status: 'completed',
      callType: 'follow-up',
    };
    
    const conversationEleven = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      endTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000 + 55 * 60 * 1000), // 55 minutes later
      duration: faker.datatype.number({ min: 30, max: 60 }),
      status: 'completed',
      callType: 'inbound',
    };
    
    const conversationTwelve = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000), // 22 days ago
      endTime: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000 + 25 * 60 * 1000), // 25 minutes later
      duration: faker.datatype.number({ min: 10, max: 30 }),
      status: 'completed',
      callType: 'wellness-check',
    };
    
    const conversationThirteen = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      endTime: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000), // 45 minutes later
      duration: faker.datatype.number({ min: 20, max: 50 }),
      status: 'completed',
      callType: 'follow-up',
    };
    
    const conversationFourteen = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000), // 28 days ago
      endTime: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000 + 35 * 60 * 1000), // 35 minutes later
      duration: faker.datatype.number({ min: 15, max: 40 }),
      status: 'completed',
      callType: 'inbound',
    };
    
    const conversationFifteen = {
      patientId: patient1._id,
      messages: [],
      history: faker.lorem.paragraph(),
      analyzedData: {},
      metadata: {},
      startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000 + 50 * 60 * 1000), // 50 minutes later
      duration: faker.datatype.number({ min: 25, max: 55 }),
      status: 'completed',
      callType: 'wellness-check',
    };
    
    await insertConversations([
      conversationOne, conversationTwo, conversationThree, conversationFour, conversationFive,
      conversationSix, conversationSeven, conversationEight, conversationNine, conversationTen,
      conversationEleven, conversationTwelve, conversationThirteen, conversationFourteen, conversationFifteen
    ]);
    console.log('Inserted conversations');

    // Seed schedules for patients.
    await insertScheduleAndAddToPatient(patient1, scheduleOne);
    await insertScheduleAndAddToPatient(patient2, scheduleTwo);
    console.log('Inserted schedules');

    // ----------------------
    // SEED PAYMENT DATA
    // ----------------------
    console.log('Seeding PaymentMethod and Invoice data...');

    // Insert dummy PaymentMethods for org1 using your fixture.
    const paymentMethods = await insertPaymentMethods(org1, [paymentMethodOne, paymentMethodTwo]);
    console.log('Seeded PaymentMethods:', paymentMethods);

    // Create a dummy invoice for org1.
    const dummyInvoiceData = {
      org: org1._id,
      invoiceNumber: 'INV-000001',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'pending',
      totalAmount: 100,
      paymentMethod: paymentMethods[0]._id,
      stripePaymentIntentId: 'pi_test',
      stripeInvoiceId: 'in_test',
      notes: 'Dummy invoice seeded for frontend display',
    };

    const invoiceRecord = await Invoice.create(dummyInvoiceData);
    console.log('Seeded Invoice:', invoiceRecord);

    console.log('Database seeded!');
    return { org1, caregiver: caregiverOneRecord, patients: [patient1, patient2], invoiceRecord, paymentMethods };
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Only run the function if this file is being executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

// Export the function so it can be imported elsewhere
module.exports = seedDatabase;