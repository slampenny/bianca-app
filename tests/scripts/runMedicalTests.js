#!/usr/bin/env node

/**
 * Medical Test Suite Runner
 * 
 * This script runs the comprehensive medical analysis test suite,
 * including fixtures with sophisticated conversation scenarios that
 * simulate realistic patient-assistant interactions with progressive
 * degradation patterns over time.
 */

const { execSync } = require('child_process');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  // Unit tests
  unitTests: [
    'tests/unit/medicalCognitiveDecline.test.js',
    'tests/unit/medicalPsychiatricDecline.test.js',
    'tests/unit/medicalBaselineComparison.test.js',
    'tests/unit/medicalEdgeCases.test.js'
  ],
  
  // Integration tests
  integrationTests: [
    'tests/integration/medicalAnalysisPipeline.test.js'
  ],
  
  // Test options
  options: {
    verbose: true,
    timeout: 30000, // 30 seconds per test
    bail: false, // Continue running tests even if one fails
    recursive: false
  }
};

/**
 * Run a single test file
 */
function runTestFile(testFile) {
  console.log(`\n🧪 Running test: ${testFile}`);
  console.log('=' .repeat(60));
  
  try {
    const command = `npx jest ${testFile} --verbose --timeout=${TEST_CONFIG.options.timeout}`;
    execSync(command, { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log(`✅ ${testFile} - PASSED`);
    return true;
  } catch (error) {
    console.log(`❌ ${testFile} - FAILED`);
    console.error(`Error: ${error.message}`);
    return false;
  }
}

/**
 * Run all unit tests
 */
function runUnitTests() {
  console.log('\n📋 Running Medical Unit Tests');
  console.log('=' .repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  TEST_CONFIG.unitTests.forEach(testFile => {
    if (runTestFile(testFile)) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log(`\n📊 Unit Tests Summary: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Run all integration tests
 */
function runIntegrationTests() {
  console.log('\n🔗 Running Medical Integration Tests');
  console.log('=' .repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  TEST_CONFIG.integrationTests.forEach(testFile => {
    if (runTestFile(testFile)) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log(`\n📊 Integration Tests Summary: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

/**
 * Run all medical tests
 */
function runAllMedicalTests() {
  console.log('\n🏥 Medical Analysis Test Suite');
  console.log('=' .repeat(60));
  console.log('This test suite includes sophisticated fixtures with realistic');
  console.log('patient-assistant conversations that gradually degrade over time.');
  console.log('=' .repeat(60));
  
  const unitResults = runUnitTests();
  const integrationResults = runIntegrationTests();
  
  const totalPassed = unitResults.passed + integrationResults.passed;
  const totalFailed = unitResults.failed + integrationResults.failed;
  
  console.log('\n🎯 Final Test Results');
  console.log('=' .repeat(60));
  console.log(`Total Tests: ${totalPassed + totalFailed}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All medical tests passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some medical tests failed!');
    process.exit(1);
  }
}

/**
 * Run specific test category
 */
function runTestCategory(category) {
  switch (category) {
    case 'unit':
      runUnitTests();
      break;
    case 'integration':
      runIntegrationTests();
      break;
    case 'all':
    default:
      runAllMedicalTests();
      break;
  }
}

/**
 * Display help information
 */
function displayHelp() {
  console.log('\n🏥 Medical Test Suite Runner');
  console.log('=' .repeat(60));
  console.log('Usage: node runMedicalTests.js [category]');
  console.log('');
  console.log('Categories:');
  console.log('  unit        - Run unit tests only');
  console.log('  integration - Run integration tests only');
  console.log('  all         - Run all medical tests (default)');
  console.log('  help        - Display this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node runMedicalTests.js unit');
  console.log('  node runMedicalTests.js integration');
  console.log('  node runMedicalTests.js all');
  console.log('');
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const category = args[0] || 'all';
  
  if (category === 'help') {
    displayHelp();
    process.exit(0);
  }
  
  runTestCategory(category);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runAllMedicalTests,
  runUnitTests,
  runIntegrationTests,
  runTestFile,
  TEST_CONFIG
};

