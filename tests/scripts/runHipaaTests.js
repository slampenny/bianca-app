#!/usr/bin/env node

/**
 * HIPAA Test Runner
 * 
 * Runs all Phase 2 HIPAA compliance tests
 * Usage: npm run test:hipaa
 */

const { execSync } = require('child_process');
const chalk = require('chalk');

console.log(chalk.blue.bold('\n🔐 Running HIPAA Compliance Tests (Phase 2)\n'));

const testFiles = [
  'tests/unit/services/mfa.service.test.js',
  'tests/unit/services/breachDetection.service.test.js',
  'tests/unit/middlewares/sessionTimeout.test.js',
  'tests/unit/middlewares/minimumNecessary.test.js',
  'tests/unit/models/breachLog.model.test.js',
  'tests/unit/models/caregiver.model.test.js',
  'tests/unit/controllers/mfa.controller.test.js'
];

console.log(chalk.cyan('Test Suites:'));
testFiles.forEach((file, index) => {
  console.log(chalk.gray(`  ${index + 1}. ${file.split('/').pop()}`));
});

console.log(chalk.cyan('\n📊 Running tests...\n'));

try {
  // Run all HIPAA tests
  const command = `jest ${testFiles.join(' ')} --verbose --colors`;
  
  execSync(command, {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      MFA_ENCRYPTION_KEY: 'test-encryption-key-for-mfa-testing-32-chars',
      NODE_NO_IOURING: '1'
    }
  });

  console.log(chalk.green.bold('\n✅ All HIPAA tests passed!\n'));
  console.log(chalk.cyan('Coverage report: ') + chalk.gray('./coverage/lcov-report/index.html\n'));
  
  process.exit(0);
} catch (error) {
  console.log(chalk.red.bold('\n❌ Some tests failed\n'));
  console.log(chalk.yellow('Review the errors above and fix any issues.\n'));
  
  process.exit(1);
}

