const mongoose = require('mongoose');
const faker = require('faker');
const { Org, Caregiver, Patient } = require('../models');
const config = require('../config/config');

const { orgOne, orgTwo, insertOrgs } = require('../../tests/fixtures/org.fixture');
const { caregiverOne, caregiverTwo, insertCaregiversAndAddToOrg } = require('../../tests/fixtures/caregiver.fixture');
const { patientOne, patientTwo, insertPatientsAndAddToCaregiver } = require('../../tests/fixtures/patient.fixture');

async function seedDatabase() {
    // Connect to the database
    await mongoose.connect(config.mongoose.url, { useNewUrlParser: true, useUnifiedTopology: true });

    // Clear the database
    await Org.deleteMany({});
    await Caregiver.deleteMany({});
    await Patient.deleteMany({});
    const [org1, org2] = await insertOrgs([orgOne, orgTwo]);
    caregiverOne.org = org1._id;
    caregiverTwo.org = org2._id;
    
    const [caregiver1] = await insertCaregiversAndAddToOrg(org1, [caregiverOne, caregiverTwo]);
    
    await insertPatientsAndAddToCaregiver(caregiver1, [patientOne, patientTwo]);

    console.log('Database seeded!');
}

seedDatabase().catch(console.error);