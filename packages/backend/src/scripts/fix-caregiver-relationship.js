#!/usr/bin/env node

/**
 * Fix Caregiver-Client Relationship Script
 * Ensures bidirectional relationship exists for emergency alerts
 * 
 * Usage: node src/scripts/fix-caregiver-relationship.js <clientId> <caregiverId>
 * Or: node src/scripts/fix-caregiver-relationship.js <clientEmail> <caregiverEmail>
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const { Client, Caregiver } = require('../models');
const { assignCaregiver } = require('../services/client.service');
const logger = require('../config/logger');

async function fixRelationship(clientIdOrEmail, caregiverIdOrEmail) {
  console.log('\n=== Fixing Caregiver-Client Relationship ===\n');
  
  try {
    // Find client
    let client;
    if (mongoose.Types.ObjectId.isValid(clientIdOrEmail)) {
      client = await Client.findById(clientIdOrEmail);
    } else {
      client = await Client.findOne({ email: clientIdOrEmail });
    }
    
    if (!client) {
      console.log('❌ Client not found:', clientIdOrEmail);
      return;
    }
    console.log('✅ Client found:', client.name || client.preferredName || client.email);
    console.log(`   - ID: ${client._id}`);
    console.log(`   - Current caregivers: ${client.caregivers?.length || 0}`);
    
    // Find caregiver
    let caregiver;
    if (mongoose.Types.ObjectId.isValid(caregiverIdOrEmail)) {
      caregiver = await Caregiver.findById(caregiverIdOrEmail);
    } else {
      caregiver = await Caregiver.findOne({ email: caregiverIdOrEmail });
    }
    
    if (!caregiver) {
      console.log('❌ Caregiver not found:', caregiverIdOrEmail);
      return;
    }
    console.log('✅ Caregiver found:', caregiver.name || caregiver.email);
    console.log(`   - ID: ${caregiver._id}`);
    console.log(`   - Phone: ${caregiver.phone || 'MISSING'}`);
    console.log(`   - Current clients: ${caregiver.clients?.length || 0}`);
    
    // Check if relationship exists
    const clientHasCaregiver = client.caregivers?.some(
      cg => cg.toString() === caregiver._id.toString()
    );
    const caregiverHasClient = caregiver.clients?.some(
      c => c.toString() === client._id.toString()
    );
    
    console.log('\n📊 Current Relationship Status:');
    console.log(`   - Client has caregiver: ${clientHasCaregiver ? '✅' : '❌'}`);
    console.log(`   - Caregiver has client: ${caregiverHasClient ? '✅' : '❌'}`);
    
    if (clientHasCaregiver && caregiverHasClient) {
      console.log('\n✅ Relationship is already bidirectional!');
      
      // Check if caregiver has phone
      if (!caregiver.phone) {
        console.log('\n⚠️  WARNING: Caregiver does not have a phone number!');
        console.log('   Emergency SMS alerts will NOT work without a phone number.');
        console.log('   Please add a phone number to the caregiver record.');
      } else {
        console.log('\n✅ Caregiver has phone number - emergency alerts should work!');
      }
      return;
    }
    
    // Fix the relationship
    console.log('\n🔧 Fixing relationship...');
    
    await assignCaregiver(caregiver._id, client._id);
    
    // Verify it worked
    await client.populate('caregivers');
    await caregiver.populate('clients');
    
    const clientHasCaregiverAfter = client.caregivers?.some(
      cg => cg._id.toString() === caregiver._id.toString()
    );
    const caregiverHasClientAfter = caregiver.clients?.some(
      c => c._id.toString() === client._id.toString()
    );
    
    console.log('\n📊 Relationship After Fix:');
    console.log(`   - Client has caregiver: ${clientHasCaregiverAfter ? '✅' : '❌'}`);
    console.log(`   - Caregiver has client: ${caregiverHasClientAfter ? '✅' : '❌'}`);
    
    if (clientHasCaregiverAfter && caregiverHasClientAfter) {
      console.log('\n✅ Relationship fixed successfully!');
      
      if (!caregiver.phone) {
        console.log('\n⚠️  WARNING: Caregiver does not have a phone number!');
        console.log('   Emergency SMS alerts will NOT work without a phone number.');
      } else {
        console.log('\n✅ Emergency alerts should now work!');
      }
    } else {
      console.log('\n❌ Failed to fix relationship. Please check manually.');
    }
    
    // Test emergency processor
    console.log('\n🧪 Testing emergency processor...');
    const { emergencyProcessor } = require('../services/emergencyProcessor.service');
    const caregivers = await emergencyProcessor.getClientCaregivers(client._id);
    console.log(`   Found ${caregivers.length} caregiver(s) with phone numbers`);
    
    if (caregivers.length === 0) {
      console.log('   ❌ No caregivers with phone numbers found!');
      if (!caregiver.phone) {
        console.log('   ⚠️  SOLUTION: Add phone number to caregiver record');
      }
    } else {
      caregivers.forEach((cg, idx) => {
        console.log(`   ${idx + 1}. ${cg.name || cg.email} - Phone: ${cg.phone ? '✅' : '❌'}`);
      });
    }
    
    console.log('\n=== Fix Complete ===\n');
    
  } catch (error) {
    console.error('❌ Error fixing relationship:', error);
    logger.error('Fix caregiver relationship error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Main execution
const clientIdOrEmail = process.argv[2];
const caregiverIdOrEmail = process.argv[3];

if (!clientIdOrEmail || !caregiverIdOrEmail) {
  console.error('Usage: node src/scripts/fix-caregiver-relationship.js <clientId/Email> <caregiverId/Email>');
  console.error('Example: node src/scripts/fix-caregiver-relationship.js client@example.com caregiver@example.com');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    console.log('Connected to MongoDB');
    return fixRelationship(clientIdOrEmail, caregiverIdOrEmail);
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  });



