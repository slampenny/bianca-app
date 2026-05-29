#!/usr/bin/env node
/**
 * Insert any default embedding anchor phrases missing from Mongo (idempotent).
 * Usage: NODE_ENV=staging MONGODB_URL='...' node src/scripts/mergeEmbeddingAnchorDefaults.js
 */
const mongoose = require('mongoose');
const config = require('../config/config');
const { EmbeddingAnchorPhrase } = require('../models');
const embeddingAnchorPhraseService = require('../services/embeddingAnchorPhrase.service');
const { countUniquePhrases } = require('../config/embeddingAnchor.defaults');

async function main() {
  try {
    console.log('Merging missing embedding anchor phrases from defaults...');
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to database');

    const before = await EmbeddingAnchorPhrase.countDocuments();
    const out = await embeddingAnchorPhraseService.mergeMissingFromDefaults();
    const after = await EmbeddingAnchorPhrase.countDocuments();

    console.log(`Defaults define ~${countUniquePhrases()} unique phrases`);
    console.log(`Documents before: ${before}, after: ${after}, newly merged: ${out.merged}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Merge failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
