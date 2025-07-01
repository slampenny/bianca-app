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

    // Insert patients and add them to the caregiverOne (fake@example.org)
    const [patient1, patient2] = await insertPatientsAndAddToCaregiver(caregiverOneRecord, [patientOne, patientTwo]);
    console.log('Inserted patients:', patient1, patient2);

    // Insert conversations for patients.
    conversationOne.patientId = patient1._id;
    conversationTwo.patientId = patient2._id;
    await insertConversations([conversationOne, conversationTwo]);
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