#!/usr/bin/env node

/**
 * Test SMS Sending Script
 * 
 * This script tests sending an SMS to verify your AWS SNS setup.
 * 
 * Usage: node scripts/test-sms-send.js <phone-number>
 * Example: node scripts/test-sms-send.js +1234567890
 */

const { SNSClient, PublishCommand, GetSMSAttributesCommand } = require('@aws-sdk/client-sns');

const region = process.env.AWS_REGION || 'us-east-2';
const phoneNumber = process.argv[2];

if (!phoneNumber) {
  console.error('❌ Error: Phone number required');
  console.log('\nUsage: node scripts/test-sms-send.js <phone-number>');
  console.log('Example: node scripts/test-sms-send.js +1234567890');
  process.exit(1);
}

const snsClient = new SNSClient({ region });

async function checkSMSAttributes() {
  try {
    const command = new GetSMSAttributesCommand({});
    const response = await snsClient.send(command);
    const attributes = response.attributes || {};
    
    console.log('\n📱 SMS Account Settings:');
    console.log(`   DefaultSMSType: ${attributes.DefaultSMSType || 'NOT SET'}`);
    console.log(`   MonthlySpendLimit: $${attributes.MonthlySpendLimit || 'Not set'}`);
    
    // Check for sandbox indicators
    // Note: AWS doesn't explicitly tell you if you're in sandbox mode
    // But if you get errors about unverified numbers, you're likely in sandbox
    console.log('\n⚠️  Note: If you get "InvalidParameter" errors about phone numbers,');
    console.log('   your account may be in SMS sandbox mode.');
    console.log('   Sandbox mode only allows sending to verified phone numbers.');
    console.log('   Request production access: https://console.aws.amazon.com/sns/v3/home#/sms/settings');
    
    return attributes;
  } catch (error) {
    console.error('❌ Failed to get SMS attributes:', error.message);
    return null;
  }
}

async function sendTestSMS(phone) {
  // Format phone number
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = `+1${formattedPhone}`;
  } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
    formattedPhone = `+${formattedPhone}`;
  } else if (!phone.startsWith('+')) {
    formattedPhone = `+${formattedPhone}`;
  } else {
    formattedPhone = phone;
  }
  
  console.log(`\n📤 Sending test SMS to: ${formattedPhone}`);
  
  try {
    const command = new PublishCommand({
      PhoneNumber: formattedPhone,
      Message: 'Test message from Bianca app SMS verification. If you receive this, your SMS setup is working!'
    });
    
    const response = await snsClient.send(command);
    console.log('✅ SMS sent successfully!');
    console.log(`   Message ID: ${response.MessageId}`);
    console.log('\n💡 If you don\'t receive the message within a few minutes:');
    console.log('   1. Check if your account is in SMS sandbox mode');
    console.log('   2. Verify the phone number is correct');
    console.log('   3. Check CloudWatch logs for delivery status');
    console.log('   4. Request production access if in sandbox: https://console.aws.amazon.com/sns/v3/home#/sms/settings');
    
    return response;
  } catch (error) {
    console.error('\n❌ Failed to send SMS:', error.message);
    console.error(`   Error Code: ${error.name}`);
    
    // Provide helpful error messages
    if (error.name === 'InvalidParameter' || error.message.includes('Invalid parameter')) {
      console.error('\n🔍 This error usually means:');
      console.error('   1. Phone number format is invalid (must be E.164: +1234567890)');
      console.error('   2. Your account is in SMS sandbox mode (can only send to verified numbers)');
      console.error('   3. The phone number has opted out of SMS');
      console.error('\n   To check sandbox status:');
      console.error('   - Go to: https://console.aws.amazon.com/sns/v3/home#/sms/settings');
      console.error('   - Look for "SMS sandbox" status');
      console.error('   - If in sandbox, request production access');
    } else if (error.name === 'AuthorizationError') {
      console.error('\n🔍 This error means IAM permissions are missing.');
      console.error('   Check that your IAM role has sns:Publish permission.');
    } else if (error.message.includes('spending limit')) {
      console.error('\n🔍 You may have hit your monthly spending limit.');
      console.error('   Check your SMS spending limit in AWS Console.');
    } else if (error.message.includes('sandbox')) {
      console.error('\n🔍 Your account is in SMS sandbox mode.');
      console.error('   Request production access: https://console.aws.amazon.com/sns/v3/home#/sms/settings');
    }
    
    throw error;
  }
}

async function main() {
  console.log('🧪 Testing AWS SNS SMS Configuration');
  console.log('====================================\n');
  
  try {
    // Check SMS attributes
    await checkSMSAttributes();
    
    // Send test SMS
    await sendTestSMS(phoneNumber);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();

