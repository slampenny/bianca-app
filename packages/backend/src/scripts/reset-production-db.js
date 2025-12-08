#!/usr/bin/env node

/**
 * Reset production database - clears all collections
 * 
 * WARNING: This script will DELETE ALL DATA from the production database!
 * 
 * Usage: 
 *   NODE_ENV=production node src/scripts/reset-production-db.js
 * 
 * For safety, this script:
 * - Only runs when NODE_ENV=production
 * - Requires confirmation before proceeding
 */

const mongoose = require('mongoose');
const readline = require('readline');
const config = require('../config/config');
const {
  Alert,
  Token,
  Org,
  Caregiver,
  Patient,
  EmergencyPhrase,
  Invoice,
  LineItem,
  Call,
  Message,
  Conversation,
  MedicalAnalysis,
  MedicalBaseline,
  FraudAbuseAnalysis,
  PaymentMethod,
  Report,
  Schedule,
  AuditLog,
  BreachLog,
  PrivacyRequest,
  ConsentRecord
} = require('../models');

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function resetDatabase() {
  console.log('\n=== PRODUCTION DATABASE RESET ===\n');
  
  // Safety check: Only allow in production
  if (config.env !== 'production') {
    console.error('❌ ERROR: This script can only be run in production environment!');
    console.error(`   Current environment: ${config.env}`);
    console.error('   Set NODE_ENV=production to proceed\n');
    process.exit(1);
  }

  // Show connection info
  console.log(`Environment: ${config.env}`);
  console.log(`MongoDB URL: ${config.mongoose.url}`);
  console.log('\n⚠️  WARNING: This will DELETE ALL DATA from the production database!');
  console.log('   All collections will be cleared:\n');
  
  const collections = [
    'Alert', 'Token', 'Org', 'Caregiver', 'Patient', 'EmergencyPhrase',
    'Invoice', 'LineItem', 'Call', 'Message', 'Conversation',
    'MedicalAnalysis', 'MedicalBaseline', 'FraudAbuseAnalysis',
    'PaymentMethod', 'Report', 'Schedule', 'AuditLog', 'BreachLog',
    'PrivacyRequest', 'ConsentRecord'
  ];
  
  collections.forEach(col => console.log(`   - ${col}`));
  console.log('');

  // Require explicit confirmation
  const answer = await askQuestion('Type "RESET PRODUCTION DATABASE" (all caps) to confirm: ');
  
  if (answer !== 'RESET PRODUCTION DATABASE') {
    console.log('\n❌ Confirmation failed. Database reset cancelled.\n');
    rl.close();
    process.exit(0);
  }

  try {
    console.log('\n🔄 Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    console.log('✅ Connected to MongoDB\n');

    console.log('🗑️  Starting database reset...\n');

    // Clear all collections in parallel for efficiency
    const deletePromises = [
      Alert.deleteMany({}),
      Token.deleteMany({}),
      Org.deleteMany({}),
      Caregiver.deleteMany({}),
      Patient.deleteMany({}),
      EmergencyPhrase.deleteMany({}),
      Invoice.deleteMany({}),
      LineItem.deleteMany({}),
      Call.deleteMany({}),
      Message.deleteMany({}),
      Conversation.deleteMany({}),
      MedicalAnalysis.deleteMany({}),
      MedicalBaseline.deleteMany({}),
      FraudAbuseAnalysis.deleteMany({}),
      PaymentMethod.deleteMany({}),
      Report.deleteMany({}),
      Schedule.deleteMany({}),
      AuditLog.deleteMany({}),
      BreachLog.deleteMany({}),
      PrivacyRequest.deleteMany({}),
      ConsentRecord.deleteMany({})
    ];

    const results = await Promise.all(deletePromises);
    
    // Count deleted documents
    let totalDeleted = 0;
    results.forEach((result, index) => {
      const deletedCount = result.deletedCount || 0;
      totalDeleted += deletedCount;
      if (deletedCount > 0) {
        console.log(`   ✓ ${collections[index]}: ${deletedCount} document(s) deleted`);
      } else {
        console.log(`   ✓ ${collections[index]}: (empty)`);
      }
    });

    console.log(`\n✅ Database reset complete!`);
    console.log(`   Total documents deleted: ${totalDeleted}\n`);

  } catch (error) {
    console.error('\n❌ Error resetting database:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB\n');
    rl.close();
  }
}

// Run the script
resetDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

