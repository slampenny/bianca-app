#!/usr/bin/env node

/**
 * AWS SNS SMS Setup Verification Script
 * 
 * This script verifies that your AWS account is properly configured
 * to send SMS messages to unverified phone numbers.
 * 
 * Usage: node scripts/verify-sms-setup.js [phone-number]
 */

const { SNSClient, PublishCommand, GetSMSAttributesCommand } = require('@aws-sdk/client-sns');

const region = process.env.AWS_REGION || 'us-east-2';
const testPhoneNumber = process.argv[2];

// Initialize AWS clients
const snsClient = new SNSClient({ region });

async function checkAccountInfo() {
  try {
    // Use AWS CLI to get account info if available, otherwise skip
    const { execSync } = require('child_process');
    try {
      const accountInfo = JSON.parse(execSync('aws sts get-caller-identity --output json', { encoding: 'utf-8' }));
      console.log('\n✅ AWS Account Information:');
      console.log(`   Account ID: ${accountInfo.Account}`);
      console.log(`   User/Role: ${accountInfo.Arn}`);
      console.log(`   Region: ${region}`);
      return accountInfo;
    } catch (error) {
      console.log('\n⚠️  Could not get account info (AWS CLI not configured or not available)');
      console.log(`   Region: ${region}`);
      return null;
    }
  } catch (error) {
    console.log('\n⚠️  Could not get account info');
    console.log(`   Region: ${region}`);
    return null;
  }
}

async function checkSMSSettings() {
  try {
    const command = new GetSMSAttributesCommand({});
    const response = await snsClient.send(command);
    const attributes = response.attributes || {};
    
    console.log('\n📱 SMS Account Settings:');
    console.log(`   Monthly Spend Limit: $${attributes.MonthlySpendLimit || 'Not set'}`);
    console.log(`   Default SMS Type: ${attributes.DefaultSMSType || 'NOT SET (REQUIRED!)'}`);
    console.log(`   Delivery Status Success Rate: ${attributes.DeliveryStatusSuccessRate || 'Not configured'}`);
    console.log(`   Delivery Status IAM Role: ${attributes.DeliveryStatusIAMRole || 'Not configured'}`);
    
    // Check for critical settings
    const issues = [];
    const warnings = [];
    
    if (!attributes.DefaultSMSType) {
      issues.push('DefaultSMSType is not set. This is REQUIRED for sending to unverified numbers.');
      issues.push('  Set it using: aws sns set-sms-attributes --attributes DefaultSMSType=Transactional --profile jordan');
    }
    
    if (!attributes.MonthlySpendLimit) {
      warnings.push('MonthlySpendLimit is not set. Consider setting a limit to prevent unexpected charges.');
    }
    
    if (parseFloat(attributes.MonthlySpendLimit || '0') < 1) {
      warnings.push('MonthlySpendLimit is very low. You may hit the limit quickly.');
    }
    
    return { attributes, issues, warnings };
  } catch (error) {
    console.error('❌ Failed to get SMS settings:', error.message);
    throw error;
  }
}

async function testSMSSend(phoneNumber) {
  if (!phoneNumber) {
    console.log('\n⚠️  No phone number provided for test. Skipping SMS send test.');
    console.log('   To test SMS sending, run: node scripts/verify-sms-setup.js +1234567890');
    return null;
  }
  
  // Format phone number
  let formattedPhone = phoneNumber.replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = `+1${formattedPhone}`;
  } else if (formattedPhone.length === 11 && formattedPhone.startsWith('1')) {
    formattedPhone = `+${formattedPhone}`;
  } else if (!phoneNumber.startsWith('+')) {
    formattedPhone = `+${formattedPhone}`;
  } else {
    formattedPhone = phoneNumber;
  }
  
  console.log(`\n📤 Testing SMS Send to: ${formattedPhone}`);
  
  try {
    const command = new PublishCommand({
      PhoneNumber: formattedPhone,
      Message: 'Test message from Bianca app SMS verification. If you receive this, your SMS setup is working correctly!'
    });
    
    const response = await snsClient.send(command);
    console.log('✅ SMS sent successfully!');
    console.log(`   Message ID: ${response.MessageId}`);
    return response;
  } catch (error) {
    console.error('❌ Failed to send SMS:', error.message);
    
    // Provide helpful error messages
    if (error.name === 'InvalidParameter') {
      console.error('   This usually means the phone number format is invalid.');
      console.error('   Phone numbers must be in E.164 format (e.g., +1234567890)');
    } else if (error.name === 'AuthorizationError') {
      console.error('   This usually means IAM permissions are missing.');
      console.error('   Check that your IAM role has sns:Publish permission.');
    } else if (error.message.includes('sandbox')) {
      console.error('   Your account may be in SMS sandbox mode.');
      console.error('   You need to request production access to send to unverified numbers.');
      console.error('   See: https://docs.aws.amazon.com/sns/latest/dg/sms-sandbox.html');
    } else if (error.message.includes('spending limit')) {
      console.error('   You may have hit your monthly spending limit.');
      console.error('   Check your SMS spending limit in AWS Console.');
    }
    
    throw error;
  }
}

async function checkIAMPermissions() {
  console.log('\n🔐 IAM Permissions Check:');
  console.log('   Note: This script cannot directly check IAM permissions.');
  console.log('   Verify that your IAM role has the following policy:');
  console.log('   {');
  console.log('     "Effect": "Allow",');
  console.log('     "Action": ["sns:Publish"],');
  console.log('     "Resource": "*"');
  console.log('   }');
  console.log('\n   Your Terraform configuration should include this in:');
  console.log('   - devops/terraform-new/main.tf (ecs_task_sns_sms_policy)');
  console.log('   - devops/terraform-new/staging.tf (staging_instance_policy)');
}

async function main() {
  console.log('🔍 AWS SNS SMS Setup Verification');
  console.log('==================================\n');
  
  try {
    // Check account info
    await checkAccountInfo();
    
    // Check SMS settings
    const { attributes, issues, warnings } = await checkSMSSettings();
    
    // Check IAM permissions (informational)
    await checkIAMPermissions();
    
    // Display issues
    if (issues.length > 0) {
      console.log('\n❌ CRITICAL ISSUES:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
    // Display warnings
    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.forEach(warning => console.log(`   - ${warning}`));
    }
    
    // Test SMS send if phone number provided
    if (testPhoneNumber) {
      await testSMSSend(testPhoneNumber);
    }
    
    // Summary
    console.log('\n📋 Summary:');
    if (issues.length === 0 && warnings.length === 0) {
      console.log('   ✅ Your SMS setup looks good!');
      if (!testPhoneNumber) {
        console.log('   💡 Tip: Test with a real phone number to verify end-to-end functionality.');
      }
    } else if (issues.length > 0) {
      console.log('   ⚠️  There are critical issues that need to be fixed.');
      console.log('   Please address the issues above before sending SMS to unverified numbers.');
    } else {
      console.log('   ⚠️  There are some warnings, but setup should work.');
    }
    
    console.log('\n📚 Additional Resources:');
    console.log('   - AWS SNS SMS Documentation: https://docs.aws.amazon.com/sns/latest/dg/sms_publish-to-phone.html');
    console.log('   - SMS Sandbox: https://docs.aws.amazon.com/sns/latest/dg/sms-sandbox.html');
    console.log('   - SMS Preferences: https://docs.aws.amazon.com/sns/latest/dg/sms_preferences.html');
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  }
}

// Run the verification
main();

