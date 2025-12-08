const mongoose = require('mongoose');
const config = require('../../src/config/config');

const setupTestDB = () => {
  beforeAll(async () => {
    try {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
    }
  });

  beforeEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map(async (collection) => collection.deleteMany()));
  });

  afterAll(async () => {
    await mongoose.disconnect();
  }, 10000);
};

module.exports = setupTestDB;
