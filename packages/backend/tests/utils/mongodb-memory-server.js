const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

/**
 * Setup MongoDB Memory Server for tests
 * @returns {Promise<string>} MongoDB URI
 */
async function setupMongoMemoryServer() {
  mongoServer = new MongoMemoryServer();
  await mongoServer.start();
  const mongoUri = await mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
  
  return mongoUri;
}

/**
 * Teardown MongoDB Memory Server and disconnect from database
 */
async function teardownMongoMemoryServer() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

/**
 * Clear all collections in the current database
 */
async function clearDatabase() {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
}

module.exports = {
  setupMongoMemoryServer,
  teardownMongoMemoryServer,
  clearDatabase
};

