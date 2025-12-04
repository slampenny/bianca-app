#!/usr/bin/env node

/**
 * List all patients in the database
 * Usage: node src/scripts/list-patients-staging.js
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const { Patient } = require('../models');

async function listPatients() {
  console.log('\n=== Listing All Patients ===\n');
  
  try {
    const patients = await Patient.find({}).select('name email preferredName phone caregivers').populate('caregivers', 'name email phone');
    
    console.log(`Found ${patients.length} patient(s):\n`);
    
    patients.forEach((patient, index) => {
      console.log(`${index + 1}. ${patient.name || patient.preferredName || 'Unknown'}`);
      console.log(`   - Email: ${patient.email}`);
      console.log(`   - Phone: ${patient.phone || 'N/A'}`);
      console.log(`   - ID: ${patient._id}`);
      console.log(`   - Caregivers: ${patient.caregivers?.length || 0}`);
      if (patient.caregivers && patient.caregivers.length > 0) {
        patient.caregivers.forEach((cg, idx) => {
          console.log(`     ${idx + 1}. ${cg.name || cg.email} (${cg.email}) - Phone: ${cg.phone || 'MISSING'}`);
        });
      }
      console.log('');
    });
    
    console.log('=== Done ===\n');
    
  } catch (error) {
    console.error('❌ Error listing patients:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Connect to MongoDB
mongoose.connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    console.log('Connected to MongoDB');
    return listPatients();
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  });

