# Testing Strategy

## Overview

This document outlines our comprehensive testing strategy to prevent the "tests pass but production fails" problem we encountered.

## The Problem We Solved

**Issue**: Unit tests passed but production code failed because:
1. Mock was incomplete (missing `getListenerStatus` and `getFullStatus` functions)
2. Tests were testing the mock, not the real service
3. No validation that mock matches real service API

**Result**: False confidence from passing tests, runtime errors in production.

## Testing Pyramid

```
    /\
   /  \     E2E Tests (Few, Slow, Expensive)
  /____\    
 /      \   Integration Tests (Some, Medium Speed)
/________\  Unit Tests (Many, Fast, Cheap)
```

## Test Types

### 1. Unit Tests (`tests/unit/`)

**Purpose**: Test individual functions/methods in isolation
**Speed**: Fast (< 100ms per test)
**Scope**: Single function/class
**Mocks**: Heavy use of mocks

**When to Use**:
- Testing business logic
- Testing error handling
- Testing edge cases
- Fast feedback during development

**Example**:
```javascript
// Test the mock, but validate it matches real API
describe('API Contract Validation', () => {
  it('should ensure mock API matches real service API', () => {
    const realService = require('../../../src/services/rtp.listener.service');
    const mockedService = rtpListenerService;
    
    // Verify all expected functions exist in both
    expectedFunctions.forEach(funcName => {
      expect(typeof realService[funcName]).toBe('function');
      expect(typeof mockedService[funcName]).toBe('function');
    });
  });
});
```

### 2. Integration Tests (`tests/integration/`)

**Purpose**: Test how components work together
**Speed**: Medium (1-5 seconds per test)
**Scope**: Multiple services/components
**Mocks**: Minimal or no mocks

**When to Use**:
- Testing service interactions
- Testing database operations
- Testing network operations
- Catching real integration issues

**Example**:
```javascript
// Test the REAL service (no mocks)
describe('RTP Listener Service - Integration Tests', () => {
  it('should start and stop a real listener', async () => {
    const listener = await rtpListenerService.startRtpListenerForCall(
      testPort, testCallId, testAsteriskChannelId
    );
    
    expect(listener).toBeDefined();
    expect(listener.port).toBe(testPort);
    
    // Test real UDP operations
    const client = dgram.createSocket('udp4');
    // ... send real packets
  });
});
```

### 3. End-to-End Tests (`tests/e2e/`)

**Purpose**: Test complete user workflows
**Speed**: Slow (10-60 seconds per test)
**Scope**: Entire application
**Mocks**: No mocks, real external services

**When to Use**:
- Testing complete call flows
- Testing user journeys
- Validating production-like scenarios

## Best Practices

### 1. API Contract Validation

Always validate that mocks match the real service API:

```javascript
// In unit tests
describe('API Contract Validation', () => {
  it('should ensure mock matches real service', () => {
    const realService = require('../../../src/services/real.service');
    const mockedService = require('../../../src/services/real.service'); // mocked
    
    // Check function existence
    const expectedFunctions = ['func1', 'func2', 'func3'];
    expectedFunctions.forEach(func => {
      expect(typeof realService[func]).toBe('function');
      expect(typeof mockedService[func]).toBe('function');
    });
    
    // Check function signatures
    expect(mockedService.func1.length).toBe(realService.func1.length);
  });
});
```

### 2. Test Naming Convention

```
Unit Tests:     "should validate user input"
Integration:    "should save user to database"
E2E Tests:      "should complete user registration flow"
```

### 3. Test Organization

```
tests/
├── unit/                    # Fast, isolated tests
│   ├── services/
│   ├── controllers/
│   └── utils/
├── integration/             # Medium speed, real services
│   ├── services/
│   ├── database/
│   └── api/
└── e2e/                     # Slow, complete workflows
    ├── calls/
    ├── auth/
    └── workflows/
```

### 4. Mock Strategy

**Good Mocking**:
- Mock external dependencies (databases, APIs)
- Mock network operations
- Keep mocks simple and accurate

**Bad Mocking**:
- Mocking the service you're testing
- Complex mock logic that doesn't match real behavior
- Mocks that hide real issues

### 5. Test Data Management

```javascript
// Use factories for test data
const createTestUser = (overrides = {}) => ({
  name: 'Test User',
  email: 'test@example.com',
  ...overrides
});

// Clean up after tests
afterEach(async () => {
  await cleanupTestData();
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests (fast)
npm run test:unit

# Run only integration tests (medium)
npm run test:integration

# Run specific test file
npm test -- tests/unit/services/rtp.listener.service.test.js

# Run tests with coverage
npm run coverage
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Run Unit Tests
  run: npm run test:unit

- name: Run Integration Tests
  run: npm run test:integration
  env:
    NODE_ENV: test
    # Add test-specific environment variables
```

## Monitoring and Alerts

1. **Test Coverage**: Maintain >80% coverage
2. **Test Duration**: Unit tests < 30s, Integration < 5min
3. **Flaky Tests**: < 1% flaky test rate
4. **Failed Tests**: Zero tolerance for test failures

## Common Anti-Patterns

### ❌ Don't Do This

```javascript
// Testing the mock instead of the real service
jest.mock('../../../src/services/rtp.listener.service', () => ({
  getListenerStatus: jest.fn(() => ({ found: true })) // Mock returns success
}));

// Test passes but real service fails
it('should find listener', () => {
  const result = rtpListenerService.getListenerStatus(1234);
  expect(result.found).toBe(true); // Always passes!
});
```

### ✅ Do This Instead

```javascript
// Integration test with real service
it('should find listener', async () => {
  // Start real listener
  await rtpListenerService.startRtpListenerForCall(1234, 'test', 'test');
  
  // Test real function
  const result = rtpListenerService.getListenerStatus(1234);
  expect(result.found).toBe(true); // Tests real behavior
  
  // Cleanup
  rtpListenerService.stopRtpListenerForCall('test');
});
```

## Conclusion

The key insight is that **tests should catch real problems, not just validate mocks**. By combining:

1. **Unit tests** with API contract validation
2. **Integration tests** with real services
3. **E2E tests** for complete workflows

We ensure that:
- ✅ Fast feedback during development
- ✅ Real issues are caught before production
- ✅ Tests provide genuine confidence
- ✅ No false positives from incomplete mocks

This strategy prevents the "tests pass but production fails" problem we encountered. 