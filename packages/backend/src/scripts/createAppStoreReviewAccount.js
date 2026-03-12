// createAppStoreReviewAccount.js - Creates a dedicated account for App Store review
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/config');
const { Org, Caregiver, Client, Conversation, Message, Schedule } = require('../models');
const { insertCaregiversAndAddToOrg } = require('../../tests/fixtures/caregiver.fixture');
const { insertClientsAndAddToCaregiver } = require('../../tests/fixtures/client.fixture');

// App Store Review Account Credentials
// Note: Password should be stored in AWS Secrets Manager as APP_STORE_REVIEW_PASSWORD
// and will be loaded via config.loadSecrets() before this script runs

/**
 * Create sample conversations for a client
 */
async function createSampleConversations(client) {
  const conversations = [];
  
  // Create a few sample conversations
  const callId1 = new mongoose.Types.ObjectId();
  const conversation1 = await Conversation.create({
    client: client._id,
    clientId: client._id,
    callId: callId1,
    startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000), // 5 minutes later
    duration: 5 * 60, // 5 minutes in seconds
    status: 'completed',
    transcript: 'Hello, how are you feeling today? I\'m doing well, thank you for checking in.',
    summary: 'Routine wellness check - client is doing well',
    sentiment: 'positive',
    isActive: true,
  });
  
  const message1 = await Message.create({
    conversation: conversation1._id,
    client: client._id,
    content: 'Hello, how are you feeling today?',
    role: 'system',
    timestamp: conversation1.startTime,
  });
  
  const message2 = await Message.create({
    conversation: conversation1._id,
    client: client._id,
    content: 'I\'m doing well, thank you for checking in.',
    role: 'user',
    timestamp: new Date(conversation1.startTime.getTime() + 30 * 1000),
  });
  
  conversations.push(conversation1);
  
  // Create another conversation
  const callId2 = new mongoose.Types.ObjectId();
  const conversation2 = await Conversation.create({
    client: client._id,
    clientId: client._id,
    callId: callId2,
    startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 3 * 60 * 1000), // 3 minutes later
    duration: 3 * 60, // 3 minutes in seconds
    status: 'completed',
    transcript: 'Good morning! How did you sleep? I slept well, thank you.',
    summary: 'Morning check-in - client slept well',
    sentiment: 'positive',
    isActive: true,
  });
  
  conversations.push(conversation2);
  
  return conversations;
}

/**
 * Create sample schedules for a client
 */
async function createSampleSchedules(client, caregiver) {
  const schedules = [];
  
  // Create a daily schedule
  const schedule1 = await Schedule.create({
    client: client._id,
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
    client: client._id,
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
    
    // Get credentials from config (password should come from Secrets Manager in staging/production)
    const APP_STORE_REVIEW_EMAIL = config.appStoreReview.email;
    const APP_STORE_REVIEW_PASSWORD = config.appStoreReview.password;
    const APP_STORE_REVIEW_NAME = config.appStoreReview.name;
    const APP_STORE_REVIEW_PHONE = config.appStoreReview.phone;
    
    if (!APP_STORE_REVIEW_PASSWORD) {
      throw new Error('APP_STORE_REVIEW_PASSWORD is not set. Please ensure it is configured in AWS Secrets Manager or .env file.');
    }
    
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
      clients: [],
      isEmailVerified: true,
      isPhoneVerified: true, // Verified for easier testing
    });
    
    // Add caregiver to org
    org.caregivers.push(caregiver._id);
    await org.save();
    console.log('✅ Created caregiver account:', caregiver.email);

    // Create sample clients
    const client1 = await Client.create({
      name: 'Sample Client One',
      email: 'sample.client1@example.com',
      phone: '+16045624264',
      caregivers: [caregiver._id],
      org: org._id,
      schedules: [],
      isActive: true,
    });
    
    const client2 = await Client.create({
      name: 'Sample Client Two',
      email: 'sample.client2@example.com',
      phone: '+16045624265',
      caregivers: [caregiver._id],
      org: org._id,
      schedules: [],
      isActive: true,
    });
    
    // Add clients to caregiver
    caregiver.clients.push(client1._id, client2._id);
    await caregiver.save();
    console.log('✅ Created sample clients');

    // Create sample conversations
    const conversations1 = await createSampleConversations(client1);
    const conversations2 = await createSampleConversations(client2);
    console.log('✅ Created sample conversations');

    // Create sample schedules
    const schedules1 = await createSampleSchedules(client1, caregiver);
    const schedules2 = await createSampleSchedules(client2, caregiver);
    
    // Add schedules to clients
    client1.schedules.push(...schedules1.map(s => s._id));
    client2.schedules.push(...schedules2.map(s => s._id));
    await client1.save();
    await client2.save();
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
    console.log(`   • Clients: ${caregiver.clients.length} (with sample data)`);
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
