#!/usr/bin/env node

/**
 * Initialize Emergency Phrases Script
 * Sets up default emergency phrases for all supported languages
 * Run with: node scripts/initialize-emergency-phrases.js
 */

const mongoose = require('mongoose');
const config = require('../src/config/config');
const { emergencyPhraseService } = require('../src/services');
const logger = require('../src/config/logger');

async function initializeEmergencyPhrases() {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to MongoDB');

    // Initialize default phrases
    await emergencyPhraseService.initializeDefaultPhrases();
    
    logger.info('Emergency phrases initialization completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error initializing emergency phrases:', error);
    process.exit(1);
  }
}

// Run the script
initializeEmergencyPhrases();
