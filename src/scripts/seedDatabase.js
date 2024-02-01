const mongoose = require('mongoose');
const faker = require('faker');
const User = require('../models/user.model.js');
const Call = require('../models/call.model.js');
const config = require('../config/config');

async function seedDatabase() {
    // Connect to the database
    await mongoose.connect(config.mongoose.url, { useNewUrlParser: true, useUnifiedTopology: true });

    // Clear the database
    await User.deleteMany({});
    await Call.deleteMany({});

    // Create some users
    const user1 = await User.create({
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password1',
        role: 'user',
        phone: faker.phone.phoneNumberFormat(1)
    });

    const user2 = await User.create({
        name: faker.name.findName(),
        email: faker.internet.email().toLowerCase(),
        password: 'password2',
        role: 'user',
        phone: faker.phone.phoneNumberFormat(1)
    });

    const user3 = await User.create({
        name: 'fake@example.com',
        email: 'fake@example.com',
        password: 'password1',
        role: 'admin',
        phone: faker.phone.phoneNumberFormat(1)
    });

    console.log('Database seeded!');
}

seedDatabase().catch(console.error);