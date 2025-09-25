#!/usr/bin/env node

/**
 * Script to run all billing-related tests
 * Usage: node scripts/run-billing-tests.js [--watch] [--coverage]
 */

const { spawn } = require('child_process');
const path = require('path');

const testFiles = [
  'tests/unit/models/conversation.model.test.js',
  'tests/unit/services/twilioCall.service.billing.test.js',
  'tests/unit/services/payment.service.billing.test.js',
  'tests/unit/services/agenda.billing.test.js',
  'tests/unit/controllers/payment.controller.billing.test.js',
  'tests/integration/billing.integration.test.js'
];

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const coverage = args.includes('--coverage');

let jestArgs = ['--testPathPattern=' + testFiles.join('|')];

if (watch) {
  jestArgs.push('--watch');
}

if (coverage) {
  jestArgs.push('--coverage');
  jestArgs.push('--coverageDirectory=coverage/billing');
}

console.log('🧪 Running Billing System Tests...');
console.log('Test Files:');
testFiles.forEach(file => console.log(`  - ${file}`));
console.log('');

const jest = spawn('yarn', ['jest', ...jestArgs], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..')
});

jest.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ All billing tests passed!');
  } else {
    console.log('\n❌ Some billing tests failed.');
    process.exit(code);
  }
});

jest.on('error', (error) => {
  console.error('Error running tests:', error);
  process.exit(1);
});
