#!/usr/bin/env node
/**
 * Check migration status and verify critical migrations have run
 * 
 * Usage:
 *   node scripts/check-migration-status.js
 *   NODE_ENV=production MONGODB_URL=<url> node scripts/check-migration-status.js
 * 
 * This script:
 * 1. Lists all migration files in migrations/
 * 2. Checks which have run (from migrations collection)
 * 3. Highlights critical migrations (patient→client, etc.)
 * 4. Exits with code 1 if critical migrations are missing
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/bianca-app';
const MIGRATIONS_DIR = path.join(__dirname, '../migrations');
const MIGRATIONS_COLLECTION = 'migrations';

// Critical migrations that MUST have run for the app to work correctly
const CRITICAL_MIGRATIONS = [
  '20260310-copy-patients-to-clients.js', // Copies patients → clients (required for clientId references)
  '20260310-message-role-patient-to-client.js', // Updates message roles
  '20260310-patient-to-client-enums.js', // Updates enum fields
  '20260310-org-require-patient-consent-to-require-client-consent.js', // Renames org field
];

async function checkMigrationStatus() {
  let client;
  try {
    console.log('🔍 Checking migration status...\n');
    console.log(`MongoDB URL: ${MONGODB_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}\n`);

    // Connect to MongoDB
    client = new MongoClient(MONGODB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
    const db = client.db();

    // Get all migration files
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.js') && f !== 'README.md')
      .sort();

    console.log(`📁 Found ${migrationFiles.length} migration file(s) in migrations/\n`);

    // Get migration history from database
    let ranMigrations = [];
    try {
      const migrationsColl = db.collection(MIGRATIONS_COLLECTION);
      const docs = await migrationsColl.find({}).sort({ fileName: 1 }).toArray();
      ranMigrations = docs.map(d => d.fileName);
      console.log(`✅ Found ${ranMigrations.length} migration(s) in database (migrations collection)\n`);
    } catch (err) {
      if (err.codeName === 'NamespaceNotFound' || err.message?.includes('does not exist')) {
        console.log(`⚠️  migrations collection does not exist - no migrations have run yet\n`);
      } else {
        throw err;
      }
    }

    // Check each migration
    const status = {
      total: migrationFiles.length,
      ran: 0,
      pending: [],
      critical: {
        total: CRITICAL_MIGRATIONS.length,
        ran: 0,
        missing: [],
      },
    };

    console.log('Migration Status:');
    console.log('='.repeat(80));

    for (const file of migrationFiles) {
      const hasRun = ranMigrations.includes(file);
      const isCritical = CRITICAL_MIGRATIONS.includes(file);
      const statusIcon = hasRun ? '✅' : '⏳';
      const criticalMark = isCritical ? ' [CRITICAL]' : '';

      console.log(`${statusIcon} ${file}${criticalMark}`);

      if (hasRun) {
        status.ran++;
        if (isCritical) {
          status.critical.ran++;
        }
      } else {
        status.pending.push(file);
        if (isCritical) {
          status.critical.missing.push(file);
        }
      }
    }

    console.log('='.repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   Total migrations: ${status.total}`);
    console.log(`   ✅ Ran: ${status.ran}`);
    console.log(`   ⏳ Pending: ${status.pending.length}`);
    console.log(`\n🔴 Critical migrations:`);
    console.log(`   Total: ${status.critical.total}`);
    console.log(`   ✅ Ran: ${status.critical.ran}`);
    console.log(`   ⏳ Missing: ${status.critical.missing.length}`);

    if (status.critical.missing.length > 0) {
      console.log(`\n❌ CRITICAL: The following migrations MUST run before the app can work correctly:`);
      status.critical.missing.forEach(f => console.log(`   - ${f}`));
      console.log(`\n💡 Run migrations with: yarn migrate:up`);
      console.log(`   Or: NODE_ENV=production MONGODB_URL=<url> yarn migrate:up\n`);
      process.exit(1);
    } else if (status.pending.length > 0) {
      console.log(`\n⚠️  Warning: ${status.pending.length} non-critical migration(s) pending:`);
      status.pending.forEach(f => console.log(`   - ${f}`));
      console.log(`\n💡 Consider running: yarn migrate:up\n`);
      process.exit(0);
    } else {
      console.log(`\n✅ All migrations have run successfully!\n`);
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Error checking migration status:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

checkMigrationStatus();
