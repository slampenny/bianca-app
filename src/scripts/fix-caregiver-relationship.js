#!/usr/bin/env node

/**
 * Fix Caregiver-Patient Relationship Script
 * Ensures bidirectional relationship exists for emergency alerts
 * 
 * Usage: node src/scripts/fix-caregiver-relationship.js <patientId> <caregiverId>
 * Or: node src/scripts/fix-caregiver-relationship.js <patientEmail> <caregiverEmail>
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const { Patient, Caregiver } = require('../models');
const { assignCaregiver } = require('../services/patient.service');
const logger = require('../config/logger');

async function fixRelationship(patientIdOrEmail, caregiverIdOrEmail) {
  console.log('\n=== Fixing Caregiver-Patient Relationship ===\n');
  
  try {
    // Find patient
    let patient;
    if (mongoose.Types.ObjectId.isValid(patientIdOrEmail)) {
      patient = await Patient.findById(patientIdOrEmail);
    } else {
      patient = await Patient.findOne({ email: patientIdOrEmail });
    }
    
    if (!patient) {
      console.log('❌ Patient not found:', patientIdOrEmail);
      return;
    }
    console.log('✅ Patient found:', patient.name || patient.preferredName || patient.email);
    console.log(`   - ID: ${patient._id}`);
    console.log(`   - Current caregivers: ${patient.caregivers?.length || 0}`);
    
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
    console.log(`   - Current patients: ${caregiver.patients?.length || 0}`);
    
    // Check if relationship exists
    const patientHasCaregiver = patient.caregivers?.some(
      cg => cg.toString() === caregiver._id.toString()
    );
    const caregiverHasPatient = caregiver.patients?.some(
      pt => pt.toString() === patient._id.toString()
    );
    
    console.log('\n📊 Current Relationship Status:');
    console.log(`   - Patient has caregiver: ${patientHasCaregiver ? '✅' : '❌'}`);
    console.log(`   - Caregiver has patient: ${caregiverHasPatient ? '✅' : '❌'}`);
    
    if (patientHasCaregiver && caregiverHasPatient) {
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
    
    // Use the assignCaregiver service method which ensures bidirectional relationship
    await assignCaregiver(caregiver._id, patient._id);
    
    // Verify it worked
    await patient.populate('caregivers');
    await caregiver.populate('patients');
    
    const patientHasCaregiverAfter = patient.caregivers?.some(
      cg => cg._id.toString() === caregiver._id.toString()
    );
    const caregiverHasPatientAfter = caregiver.patients?.some(
      pt => pt._id.toString() === patient._id.toString()
    );
    
    console.log('\n📊 Relationship After Fix:');
    console.log(`   - Patient has caregiver: ${patientHasCaregiverAfter ? '✅' : '❌'}`);
    console.log(`   - Caregiver has patient: ${caregiverHasPatientAfter ? '✅' : '❌'}`);
    
    if (patientHasCaregiverAfter && caregiverHasPatientAfter) {
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
    const caregivers = await emergencyProcessor.getPatientCaregivers(patient._id);
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
const patientIdOrEmail = process.argv[2];
const caregiverIdOrEmail = process.argv[3];

if (!patientIdOrEmail || !caregiverIdOrEmail) {
  console.error('Usage: node src/scripts/fix-caregiver-relationship.js <patientId/Email> <caregiverId/Email>');
  console.error('Example: node src/scripts/fix-caregiver-relationship.js patient@example.com caregiver@example.com');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    console.log('Connected to MongoDB');
    return fixRelationship(patientIdOrEmail, caregiverIdOrEmail);
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  });

