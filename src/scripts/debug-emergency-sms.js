#!/usr/bin/env node

/**
 * Emergency SMS Debugging Script
 * Helps diagnose why emergency SMS alerts aren't being sent
 * 
 * Usage: node src/scripts/debug-emergency-sms.js <patientId>
 */

const mongoose = require('mongoose');
const config = require('../config/config');
const { emergencyProcessor } = require('../services/emergencyProcessor.service');
const { snsService } = require('../services/sns.service');
const { twilioSmsService } = require('../services/twilioSms.service');
const { Patient, Caregiver } = require('../models');
const logger = require('../config/logger');

async function debugEmergencySMS(patientId) {
  console.log('\n=== Emergency SMS Debugging ===\n');
  
  try {
    // 1. Check patient exists
    console.log('1. Checking patient...');
    const patient = await Patient.findById(patientId).populate('caregivers');
    if (!patient) {
      console.log('❌ Patient not found:', patientId);
      return;
    }
    console.log('✅ Patient found:', patient.name || patient.preferredName || patient.email);
    console.log(`   - ID: ${patient._id}`);
    console.log(`   - Email: ${patient.email}`);
    console.log(`   - Phone: ${patient.phone || 'N/A'}`);
    
    // 2. Check caregivers
    console.log('\n2. Checking caregivers...');
    const caregivers = await emergencyProcessor.getPatientCaregivers(patientId);
    console.log(`   Found ${caregivers.length} caregiver(s) with phone numbers`);
    
    if (caregivers.length === 0) {
      console.log('❌ No caregivers with phone numbers found!');
      console.log('\n   Checking all assigned caregivers...');
      const allCaregivers = patient.caregivers || [];
      console.log(`   Total assigned caregivers: ${allCaregivers.length}`);
      
      for (const caregiver of allCaregivers) {
        const fullCaregiver = await Caregiver.findById(caregiver._id || caregiver);
        if (fullCaregiver) {
          console.log(`   - ${fullCaregiver.name || fullCaregiver.email}: phone=${fullCaregiver.phone || 'MISSING'}`);
        }
      }
      console.log('\n   ⚠️  SOLUTION: Ensure caregivers have phone numbers set');
      return;
    }
    
    caregivers.forEach((caregiver, index) => {
      console.log(`   ${index + 1}. ${caregiver.name || caregiver.email}`);
      console.log(`      - Phone: ${caregiver.phone || 'MISSING'}`);
      console.log(`      - Preferred Language: ${caregiver.preferredLanguage || 'en'}`);
    });
    
    // 3. Check emergency detection
    console.log('\n3. Testing emergency detection...');
    const testPhrase = "I'm having a heart attack";
    console.log(`   Testing phrase: "${testPhrase}"`);
    const detectionResult = await emergencyProcessor.processUtterance(patientId, testPhrase);
    console.log('   Detection result:', JSON.stringify(detectionResult, null, 2));
    
    if (!detectionResult.shouldAlert) {
      console.log('❌ Emergency was NOT detected or was filtered!');
      console.log(`   Reason: ${detectionResult.reason}`);
      console.log('\n   Possible reasons:');
      console.log('   - False positive filter blocked it');
      console.log('   - Deduplication blocked it (recent alert)');
      console.log('   - Emergency pattern not matched');
      return;
    }
    console.log('✅ Emergency detected successfully');
    
    // 4. Check configuration
    console.log('\n4. Checking configuration...');
    const emergencyConfig = require('../config/emergency.config').config;
    console.log(`   - enableSNSPushNotifications: ${emergencyConfig.enableSNSPushNotifications}`);
    console.log(`   - enableAlertsAPI: ${emergencyConfig.enableAlertsAPI}`);
    console.log(`   - enableFalsePositiveFilter: ${emergencyConfig.enableFalsePositiveFilter}`);
    
    if (!emergencyConfig.enableSNSPushNotifications) {
      console.log('❌ Emergency SMS notifications are DISABLED in config!');
      console.log('\n   ⚠️  SOLUTION: Set enableSNSPushNotifications: true in emergency.config.js');
      console.log('   Or set NODE_ENV=staging/production or AWS_REGION env var');
      return;
    }
    
    // 5. Check Twilio SMS service
    console.log('\n5. Checking Twilio SMS service...');
    console.log(`   - Twilio SMS initialized: ${twilioSmsService.isInitialized}`);
    console.log(`   - Twilio account SID configured: ${!!config.twilio?.accountSid}`);
    console.log(`   - Twilio auth token configured: ${!!config.twilio?.authToken}`);
    console.log(`   - Twilio phone number: ${config.twilio?.phone || 'NOT SET'}`);
    
    if (!twilioSmsService.isInitialized) {
      console.log('❌ Twilio SMS service not initialized!');
      console.log('\n   Attempting to reinitialize...');
      twilioSmsService.reinitialize();
      console.log(`   After reinit: ${twilioSmsService.isInitialized ? '✅ Initialized' : '❌ Still not initialized'}`);
      
      if (!twilioSmsService.isInitialized) {
        console.log('\n   ⚠️  SOLUTION: Check Twilio credentials in environment variables:');
        console.log('   - TWILIO_ACCOUNT_SID');
        console.log('   - TWILIO_AUTH_TOKEN');
        console.log('   - TWILIO_PHONE_NUMBER');
        return;
      }
    }
    
    // 6. Check SNS service
    console.log('\n6. Checking SNS service (Twilio SMS wrapper)...');
    const snsStatus = snsService.getStatus();
    console.log(`   - SNS service initialized: ${snsStatus.isInitialized}`);
    console.log(`   - SNS enabled: ${snsStatus.isEnabled}`);
    console.log(`   - SMS provider: ${snsStatus.smsProvider}`);
    
    if (!snsStatus.isInitialized) {
      console.log('❌ SNS service not initialized!');
      return;
    }
    
    // 7. Test phone number extraction
    console.log('\n7. Testing phone number extraction...');
    const phoneNumbers = twilioSmsService.extractPhoneNumbers(caregivers);
    console.log(`   Extracted ${phoneNumbers.length} valid phone number(s):`);
    phoneNumbers.forEach((phone, index) => {
      console.log(`   ${index + 1}. ${twilioSmsService.maskPhoneNumber(phone)}`);
    });
    
    if (phoneNumbers.length === 0) {
      console.log('❌ No valid phone numbers extracted!');
      console.log('\n   ⚠️  SOLUTION: Ensure caregiver phone numbers are in valid format');
      console.log('   Valid formats: +1234567890, 1234567890, (123) 456-7890');
      return;
    }
    
    // 8. Simulate alert creation (dry run)
    console.log('\n8. Simulating alert creation (DRY RUN - no SMS will be sent)...');
    if (detectionResult.shouldAlert && detectionResult.alertData) {
      console.log('   Alert data:', JSON.stringify(detectionResult.alertData, null, 2));
      console.log('   Would send to:', phoneNumbers.map(p => twilioSmsService.maskPhoneNumber(p)).join(', '));
      console.log('\n   ✅ All checks passed! Emergency SMS should work.');
      console.log('\n   To test actual SMS sending, you can:');
      console.log('   1. Check server logs when emergency is detected');
      console.log('   2. Look for "[Emergency Detection]" and "[Twilio SMS]" log entries');
      console.log('   3. Check Twilio dashboard for message delivery status');
    }
    
    // 9. Check recent alerts
    console.log('\n9. Checking recent alerts for this patient...');
    const { Alert } = require('../models');
    const recentAlerts = await Alert.find({
      relatedPatient: patientId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).sort({ createdAt: -1 }).limit(5);
    
    console.log(`   Found ${recentAlerts.length} alert(s) in last 24 hours:`);
    recentAlerts.forEach((alert, index) => {
      console.log(`   ${index + 1}. ${alert.message.substring(0, 60)}...`);
      console.log(`      - Created: ${alert.createdAt}`);
      console.log(`      - Importance: ${alert.importance}`);
    });
    
    console.log('\n=== Debug Complete ===\n');
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
    logger.error('Emergency SMS debug error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Main execution
const patientId = process.argv[2];

if (!patientId) {
  console.error('Usage: node src/scripts/debug-emergency-sms.js <patientId>');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    console.log('Connected to MongoDB');
    return debugEmergencySMS(patientId);
  })
  .catch((error) => {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  });

