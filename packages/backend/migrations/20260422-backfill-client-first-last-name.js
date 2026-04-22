/**
 * Backfill `firstName` and `lastName` on clients that only have `name`.
 * Safe to run multiple times.
 */
const mongoose = require('mongoose');
const config = require('../src/config/config');
const { Client } = require('../src/models');
const { splitFullName } = require('../src/utils/clientName.util');
const logger = require('../src/config/logger');

module.exports = {
  async up() {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.mongoose.url, config.mongoose.options);
      logger.info('[Migration] Connected Mongoose');
    }
    const cursor = Client.find({
      $or: [{ firstName: { $exists: false } }, { firstName: null }, { firstName: '' }],
    })
      .lean()
      .cursor();
    let n = 0;
    for await (const row of cursor) {
      if (!row.name) continue;
      const s = splitFullName(row.name);
      await Client.collection.updateOne(
        { _id: row._id },
        { $set: { firstName: s.firstName, lastName: s.lastName } }
      );
      n += 1;
    }
    logger.info(`[Migration] 20260422-backfill-client-first-last-name: updated ${n} document(s)`);
  },
};
