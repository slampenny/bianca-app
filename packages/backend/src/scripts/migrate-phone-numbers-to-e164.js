/**
 * Migration script to normalize all phone numbers in the database to E.164 format
 * 
 * This script:
 * 1. Finds all Caregivers, Patients, and Orgs with phone numbers
 * 2. Normalizes them to E.164 format (+1XXXXXXXXXX)
 * 3. Updates the database
 * 
 * Usage:
 *   node src/scripts/migrate-phone-numbers-to-e164.js
 * 
 * For staging/production:
 *   NODE_ENV=staging node src/scripts/migrate-phone-numbers-to-e164.js
 */

const mongoose = require('mongoose');
const { Caregiver, Patient, Org } = require('../models');
const config = require('../config/config');

/**
 * Normalize phone number to E.164 format (+1XXXXXXXXXX)
 * @param {string} phone - Phone number in any format
 * @returns {string|null} - Normalized phone number in E.164 format, or null if invalid
 */
const normalizePhoneToE164 = (phone) => {
  if (!phone) return null;
  
  // If already in E.164 format, return as-is
  if (phone.startsWith('+')) {
    const e164Regex = /^\+[1-9]\d{9,14}$/;
    if (e164Regex.test(phone)) {
      return phone;
    }
    // Invalid E.164 format - try to fix it
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    return null; // Can't fix
  }
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Convert 10-digit US number to E.164 format
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // Convert 11-digit number starting with 1 to E.164 format
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If longer, assume it's an international number and add +
  if (digits.length > 11) {
    return `+${digits}`;
  }
  
  // Invalid format
  return null;
};

/**
 * Migrate phone numbers for a specific model
 */
async function migrateModelPhoneNumbers(Model, modelName) {
  console.log(`\n📱 Migrating ${modelName} phone numbers...`);
  
  const documents = await Model.find({ phone: { $exists: true, $ne: null, $ne: '' } });
  console.log(`   Found ${documents.length} ${modelName} documents with phone numbers`);
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const doc of documents) {
    const originalPhone = doc.phone;
    const normalizedPhone = normalizePhoneToE164(originalPhone);
    
    if (!normalizedPhone) {
      console.log(`   ⚠️  Skipping ${modelName} ${doc._id}: Invalid phone format "${originalPhone}"`);
      skipped++;
      continue;
    }
    
    if (normalizedPhone === originalPhone) {
      // Already in correct format
      skipped++;
      continue;
    }
    
    try {
      doc.phone = normalizedPhone;
      await doc.save();
      console.log(`   ✅ Updated ${modelName} ${doc._id}: "${originalPhone}" → "${normalizedPhone}"`);
      updated++;
    } catch (error) {
      console.error(`   ❌ Error updating ${modelName} ${doc._id}:`, error.message);
      errors++;
    }
  }
  
  console.log(`   📊 ${modelName} Summary: ${updated} updated, ${skipped} skipped, ${errors} errors`);
  return { updated, skipped, errors };
}

/**
 * Main migration function
 */
async function migratePhoneNumbers() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(config.mongoose.url);
    console.log('✅ Connected to database');
    
    console.log('\n🚀 Starting phone number migration to E.164 format...\n');
    
    // Migrate each model
    const caregiverStats = await migrateModelPhoneNumbers(Caregiver, 'Caregiver');
    const patientStats = await migrateModelPhoneNumbers(Patient, 'Patient');
    const orgStats = await migrateModelPhoneNumbers(Org, 'Org');
    
    // Summary
    console.log('\n📊 Migration Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Caregivers: ${caregiverStats.updated} updated, ${caregiverStats.skipped} skipped, ${caregiverStats.errors} errors`);
    console.log(`Patients:   ${patientStats.updated} updated, ${patientStats.skipped} skipped, ${patientStats.errors} errors`);
    console.log(`Orgs:       ${orgStats.updated} updated, ${orgStats.skipped} skipped, ${orgStats.errors} errors`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const totalUpdated = caregiverStats.updated + patientStats.updated + orgStats.updated;
    const totalErrors = caregiverStats.errors + patientStats.errors + orgStats.errors;
    
    if (totalErrors > 0) {
      console.log(`\n⚠️  Migration completed with ${totalErrors} error(s). Please review the errors above.`);
      process.exit(1);
    } else if (totalUpdated > 0) {
      console.log(`\n✅ Migration completed successfully! ${totalUpdated} phone number(s) normalized to E.164 format.`);
    } else {
      console.log(`\n✅ Migration completed. All phone numbers are already in E.164 format.`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePhoneNumbers();
}

module.exports = { migratePhoneNumbers, normalizePhoneToE164 };

