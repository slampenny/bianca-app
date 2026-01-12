// createAppStoreReviewAccount.js - Creates a dedicated account for App Store review
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/config');
const { Org, Caregiver, Patient, Conversation, Message, Schedule } = require('../models');
const { insertCaregiversAndAddToOrg } = require('../../tests/fixtures/caregiver.fixture');
const { insertPatientsAndAddToCaregiver } = require('../../tests/fixtures/patient.fixture');

// App Store Review Account Credentials
const APP_STORE_REVIEW_EMAIL = 'appreview@biancatechnologies.com';
const APP_STORE_REVIEW_PASSWORD = '[REDACTED - from Secrets Manager]'; // Strong, memorable password
const APP_STORE_REVIEW_NAME = 'App Review Tester';
const APP_STORE_REVIEW_PHONE = '+16045624263';

/**
 * Create sample conversations for a patient
 */
async function createSampleConversations(patient) {
  const conversations = [];
  
  // Create a few sample conversations
  const conversation1 = await Conversation.create({
    patient: patient._id,
    startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000), // 5 minutes later
    duration: 5 * 60, // 5 minutes in seconds
    status: 'completed',
    transcript: 'Hello, how are you feeling today? I\'m doing well, thank you for checking in.',
    summary: 'Routine wellness check - patient is doing well',
    sentiment: 'positive',
    isActive: true,
  });
  
  const message1 = await Message.create({
    conversation: conversation1._id,
    patient: patient._id,
    content: 'Hello, how are you feeling today?',
    role: 'system',
    timestamp: conversation1.startTime,
  });
  
  const message2 = await Message.create({
    conversation: conversation1._id,
    patient: patient._id,
    content: 'I\'m doing well, thank you for checking in.',
    role: 'user',
    timestamp: new Date(conversation1.startTime.getTime() + 30 * 1000),
  });
  
  conversations.push(conversation1);
  
  // Create another conversation
  const conversation2 = await Conversation.create({
    patient: patient._id,
    startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000), // 3 minutes later
    duration: 3 * 60, // 3 minutes in seconds
    status: 'completed',
    transcript: 'Good morning! How did you sleep? I slept well, thank you.',
    summary: 'Morning check-in - patient slept well',
    sentiment: 'positive',
    isActive: true,
  });
  
  conversations.push(conversation2);
  
  return conversations;
}

/**
 * Create sample schedules for a patient
 */
async function createSampleSchedules(patient, caregiver) {
  const schedules = [];
  
  // Create a daily schedule
  const schedule1 = await Schedule.create({
    patient: patient._id,
    caregiver: caregiver._id,
    type: 'daily',
    time: '09:00',
    timezone: 'America/Vancouver',
    isActive: true,
    enabled: true,
  });
  
  schedules.push(schedule1);
  
  // Create a weekly schedule
  const schedule2 = await Schedule.create({
    patient: patient._id,
    caregiver: caregiver._id,
    type: 'weekly',
    dayOfWeek: 1, // Monday
    time: '14:00',
    timezone: 'America/Vancouver',
    isActive: true,
    enabled: true,
  });
  
  schedules.push(schedule2);
  
  return schedules;
}

/**
 * Main function to create App Store review account
 */
async function createAppStoreReviewAccount() {
  try {
    // Load secrets from AWS Secrets Manager (required for OpenAI API key in production/staging)
    await config.loadSecrets();
    console.log('Secrets loaded from AWS Secrets Manager');
    
    // Connect to the database
    await mongoose.connect(config.mongoose.url);
    console.log('Connected to database');

    // Check if account already exists
    const existingCaregiver = await Caregiver.findOne({ email: APP_STORE_REVIEW_EMAIL });
    if (existingCaregiver) {
      console.log('⚠️  App Store review account already exists!');
      console.log(`   Email: ${APP_STORE_REVIEW_EMAIL}`);
      console.log(`   Password: ${APP_STORE_REVIEW_PASSWORD}`);
      console.log('\n   If you want to recreate it, delete the existing account first.');
      process.exit(0);
    }

    console.log('Creating App Store review account...');
    
    // Hash the password
    const salt = bcrypt.genSaltSync(8);
    const hashedPassword = bcrypt.hashSync(APP_STORE_REVIEW_PASSWORD, salt);

    // Create organization
    const org = await Org.create({
      name: 'App Review Test Organization',
      email: APP_STORE_REVIEW_EMAIL,
      country: 'CA', // Canada
    });
    console.log('✅ Created organization:', org.name);

    // Create caregiver account
    const caregiver = await Caregiver.create({
      name: APP_STORE_REVIEW_NAME,
      email: APP_STORE_REVIEW_EMAIL,
      phone: APP_STORE_REVIEW_PHONE,
      password: hashedPassword,
      role: 'orgAdmin', // Give admin role so they can see all features
      org: org._id,
      patients: [],
      isEmailVerified: true,
      isPhoneVerified: true, // Verified for easier testing
    });
    
    // Add caregiver to org
    org.caregivers.push(caregiver._id);
    await org.save();
    console.log('✅ Created caregiver account:', caregiver.email);

    // Create sample patients
    const patient1 = await Patient.create({
      name: 'Sample Patient One',
      email: 'sample.patient1@example.com',
      phone: '+16045624264',
      caregivers: [caregiver._id],
      org: org._id,
      schedules: [],
      isActive: true,
    });
    
    const patient2 = await Patient.create({
      name: 'Sample Patient Two',
      email: 'sample.patient2@example.com',
      phone: '+16045624265',
      caregivers: [caregiver._id],
      org: org._id,
      schedules: [],
      isActive: true,
    });
    
    // Add patients to caregiver
    caregiver.patients.push(patient1._id, patient2._id);
    await caregiver.save();
    console.log('✅ Created sample patients');

    // Create sample conversations
    const conversations1 = await createSampleConversations(patient1);
    const conversations2 = await createSampleConversations(patient2);
    console.log('✅ Created sample conversations');

    // Create sample schedules
    const schedules1 = await createSampleSchedules(patient1, caregiver);
    const schedules2 = await createSampleSchedules(patient2, caregiver);
    
    // Add schedules to patients
    patient1.schedules.push(...schedules1.map(s => s._id));
    patient2.schedules.push(...schedules2.map(s => s._id));
    await patient1.save();
    await patient2.save();
    console.log('✅ Created sample schedules');

    console.log('\n🎉 App Store review account created successfully!');
    console.log('\n📋 Account Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${APP_STORE_REVIEW_EMAIL}`);
    console.log(`Password: ${APP_STORE_REVIEW_PASSWORD}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📝 What was created:');
    console.log(`   • Organization: ${org.name}`);
    console.log(`   • Caregiver account: ${caregiver.name} (${caregiver.email})`);
    console.log(`   • Role: ${caregiver.role}`);
    console.log(`   • Patients: ${caregiver.patients.length} (with sample data)`);
    console.log(`   • Conversations: ${conversations1.length + conversations2.length} sample conversations`);
    console.log(`   • Schedules: ${schedules1.length + schedules2.length} sample schedules`);
    console.log('\n✅ Account is ready for App Store review!');
    console.log('\n💡 Next steps:');
    console.log('   1. Test login with these credentials');
    console.log('   2. Verify sample data is visible');
    console.log('   3. Add these credentials to App Store Connect → App Review Information');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating App Store review account:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  createAppStoreReviewAccount();
}

module.exports = createAppStoreReviewAccount;
