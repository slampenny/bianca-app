const mongoose = require('mongoose');
const faker = require('faker');
const { Alert, Org, Caregiver, Patient, Conversation, Message, Schedule } = require('../models');
const config = require('../config/config');

const { orgOne, orgTwo, insertOrgs } = require('../../tests/fixtures/org.fixture');
const { caregiverOne, caregiverTwo, admin, insertCaregiversAndAddToOrg } = require('../../tests/fixtures/caregiver.fixture');
const { patientOne, patientTwo, insertPatientsAndAddToCaregiver } = require('../../tests/fixtures/patient.fixture');
const { alertOne, alertTwo, alertThree, expiredAlert, insertAlerts } = require('../../tests/fixtures/alert.fixture');
const { scheduleOne, scheduleTwo, insertScheduleAndAddToPatient } = require('../../tests/fixtures/schedule.fixture');
const { conversationOne, conversationTwo, insertConversations } = require('../../tests/fixtures/conversation.fixture');

async function seedDatabase() {
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
    console.log('Cleared the database');

    // Insert organizations
    const [org1, org2] = await insertOrgs([orgOne, orgTwo]);
    caregiverOne.org = org1._id;
    caregiverTwo.org = org2._id;

    // Insert caregivers and add to organizations
    const [caregiver1] = await insertCaregiversAndAddToOrg(org1, [caregiverOne, caregiverTwo, admin]);

    // Insert alerts
    await insertAlerts(caregiver1, 'Caregiver', [alertOne, alertTwo, alertThree, expiredAlert]);

    // Insert patients and add to caregiver
    const [patient1, patient2] = await insertPatientsAndAddToCaregiver(caregiver1, [patientOne, patientTwo]);
    // Generate and insert conversations for patients
    conversationOne.patientId = patient1._id;
    conversationTwo.patientId = patient2._id;
    await insertConversations([conversationOne, conversationTwo]);

    // Now seed schedules for one or both patients:
    // This function creates a schedule and updates the patient’s schedules array
    const scheduleForPatient1 = await insertScheduleAndAddToPatient(patient1, scheduleOne);
    const scheduleForPatient2 = await insertScheduleAndAddToPatient(patient2, scheduleTwo);

    console.log('Database seeded!');
}

seedDatabase().catch(console.error);
