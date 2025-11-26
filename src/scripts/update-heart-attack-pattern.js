#!/usr/bin/env node

/**
 * Update heart attack emergency pattern to better match common phrases
 * 
 * Usage: node src/scripts/update-heart-attack-pattern.js
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const { EmergencyPhrase } = require('../models');
const logger = require('../config/logger');

async function updateHeartAttackPattern() {
  try {
    console.log('Updating heart attack emergency pattern...\n');

    // Find the heart attack phrase
    const heartAttackPhrase = await EmergencyPhrase.findOne({
      phrase: 'heart attack',
      language: 'en',
      severity: 'CRITICAL',
      category: 'Medical'
    });

    if (!heartAttackPhrase) {
      console.log('❌ Heart attack phrase not found in database');
      console.log('   Creating new phrase...');
      
      const systemUserId = '000000000000000000000000';
      await EmergencyPhrase.create({
        phrase: 'heart attack',
        pattern: '\\b(heart\\s+attack|heartattack|having\\s+a\\s+heart\\s+attack|i\'?m\\s+having\\s+a\\s+heart\\s+attack|i\\s+am\\s+having\\s+a\\s+heart\\s+attack)\\b',
        severity: 'CRITICAL',
        category: 'Medical',
        language: 'en',
        isActive: true,
        createdBy: systemUserId,
        lastModifiedBy: systemUserId,
        description: 'Heart attack detection - matches "heart attack", "having a heart attack", "I\'m having a heart attack", etc.'
      });
      
      console.log('✅ Created new heart attack phrase with improved pattern');
    } else {
      console.log('Found existing heart attack phrase:');
      console.log(`   - ID: ${heartAttackPhrase._id}`);
      console.log(`   - Current pattern: ${heartAttackPhrase.pattern}`);
      
      // Update the pattern
      const newPattern = '\\b(heart\\s+attack|heartattack|having\\s+a\\s+heart\\s+attack|i\'?m\\s+having\\s+a\\s+heart\\s+attack|i\\s+am\\s+having\\s+a\\s+heart\\s+attack)\\b';
      
      heartAttackPhrase.pattern = newPattern;
      heartAttackPhrase.lastModifiedBy = '000000000000000000000000';
      await heartAttackPhrase.save();
      
      console.log(`\n✅ Updated pattern to: ${newPattern}`);
      console.log('\n   This pattern now matches:');
      console.log('   - "heart attack"');
      console.log('   - "heartattack"');
      console.log('   - "having a heart attack"');
      console.log('   - "I\'m having a heart attack"');
      console.log('   - "I am having a heart attack"');
    }

    // Test the pattern
    console.log('\n--- Testing Pattern ---');
    const testPhrases = [
      "I'm having a heart attack",
      "I am having a heart attack",
      "having a heart attack",
      "heart attack",
      "heartattack",
      "I think I'm having a heart attack"
    ];

    const patternRegex = new RegExp('\\b(heart\\s+attack|heartattack|having\\s+a\\s+heart\\s+attack|i\'?m\\s+having\\s+a\\s+heart\\s+attack|i\\s+am\\s+having\\s+a\\s+heart\\s+attack)\\b', 'i');
    
    testPhrases.forEach(phrase => {
      const matches = patternRegex.test(phrase);
      console.log(`   "${phrase}" ${matches ? '✅ MATCHES' : '❌ NO MATCH'}`);
    });

    console.log('\n✅ Pattern update complete!');
    console.log('\n⚠️  Note: The localized emergency detector caches patterns.');
    console.log('   You may need to restart the server for changes to take effect.');
    
  } catch (error) {
    console.error('❌ Error updating pattern:', error);
    logger.error('Error updating heart attack pattern:', error);
    throw error;
  }
}

// Main execution
mongoose.connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    console.log('Connected to MongoDB\n');
    return updateHeartAttackPattern();
  })
  .then(() => {
    console.log('\nDisconnecting from MongoDB...');
    return mongoose.disconnect();
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  });

