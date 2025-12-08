// src/scripts/testCall.js
const mongoose = require('mongoose');
const config = require('../config/config');
const { twilioCallService } = require('../services');
const { Patient } = require('../models');
const logger = require('../config/logger');

(async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongoose.url, config.mongoose.options);
    logger.info('Connected to MongoDB');

    // Find the first patient (your number)
    const patient = await Patient.findOne().sort({ createdAt: 1 });
    
    if (!patient) {
      console.error('No patients found in database');
      process.exit(1);
    }

    console.log(`Found patient: ${patient.name} (${patient.phone})`);
    console.log('Initiating test call...');

    // Initiate the call
    const callSid = await twilioCallService.initiateCall(patient._id);
    
    console.log(`✅ Call initiated successfully!`);
    console.log(`Call SID: ${callSid}`);
    console.log(`Patient: ${patient.name}`);
    console.log(`Phone: ${patient.phone}`);
    console.log(`Time: ${new Date().toISOString()}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initiating test call:', error);
    process.exit(1);
  }
})(); 