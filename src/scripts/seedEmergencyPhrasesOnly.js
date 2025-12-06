// seedEmergencyPhrasesOnly.js
// Standalone script to seed emergency phrases for production
// This can be run independently without clearing the entire database

const mongoose = require('mongoose');
const { EmergencyPhrase } = require('../models');
const config = require('../config/config');
const emergencyPhrasesSeeder = require('./seeders/emergencyPhrases.seeder');

/**
 * Seed emergency phrases only (for production updates)
 * This will delete existing phrases and re-seed them
 */
async function seedEmergencyPhrasesOnly() {
  try {
    console.log('🌱 Seeding emergency phrases for production...');
    
    // Connect to the database
    await mongoose.connect(config.mongoose.url);
    console.log('✅ Connected to database');

    // Check existing count
    const existingCount = await EmergencyPhrase.countDocuments();
    console.log(`📊 Found ${existingCount} existing emergency phrases`);

    // Delete existing phrases to allow re-seeding
    if (existingCount > 0) {
      console.log('🗑️  Deleting existing emergency phrases...');
      await EmergencyPhrase.deleteMany({});
      console.log('✅ Deleted existing phrases');
    }

    // Seed emergency phrases
    await emergencyPhrasesSeeder.seedEmergencyPhrases();

    console.log('✅ Emergency phrases seeded successfully!');
    
    // Verify the seed
    const newCount = await EmergencyPhrase.countDocuments();
    console.log(`📊 Total emergency phrases in database: ${newCount}`);

    // Show breakdown by language
    const byLanguage = await EmergencyPhrase.aggregate([
      {
        $group: {
          _id: '$language',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    console.log('\n📋 Breakdown by language:');
    byLanguage.forEach(({ _id: lang, count }) => {
      console.log(`   - ${lang}: ${count} phrases`);
    });

    // Show breakdown by severity
    const bySeverity = await EmergencyPhrase.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    console.log('\n📋 Breakdown by severity:');
    bySeverity.forEach(({ _id: severity, count }) => {
      console.log(`   - ${severity}: ${count} phrases`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding emergency phrases:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedEmergencyPhrasesOnly();
}

module.exports = { seedEmergencyPhrasesOnly };
