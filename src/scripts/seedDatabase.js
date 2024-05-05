const mongoose = require('mongoose');
const faker = require('faker');
const { Org, Caregiver, Patient } = require('../models');
const config = require('../config/config');

const { orgOne, orgTwo, insertOrgs } = require('../../tests/fixtures/org.fixture');
const { caregiverOne, caregiverTwo, insertCaregivers } = require('../../tests/fixtures/caregiver.fixture');
const { patientOne, patientTwo, insertPatients } = require('../../tests/fixtures/patient.fixture');

async function seedDatabase() {
    // Connect to the database
    await mongoose.connect(config.mongoose.url, { useNewUrlParser: true, useUnifiedTopology: true });

    // Clear the database
    await Org.deleteMany({});
    await Caregiver.deleteMany({});
    await Patient.deleteMany({});
    await insertOrgs([orgOne, orgTwo]);
    await insertCaregivers([caregiverOne, caregiverTwo]);
    
    await insertPatients([patientOne, patientTwo]);

    console.log('Database seeded!');
}

seedDatabase().catch(console.error);