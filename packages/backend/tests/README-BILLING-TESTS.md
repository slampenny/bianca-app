# Billing System Tests

This directory contains comprehensive unit and integration tests for the automated billing system. These tests ensure the billing system works correctly across all scenarios including cost calculation, invoice generation, payment processing, and error handling.

> **📚 For complete billing system documentation, see [BILLING_SYSTEM.md](../docs/BILLING_SYSTEM.md)**

## Test Structure

### Unit Tests

#### Models
- **`conversation.model.test.js`** - Tests for the `cost` and `lineItemId` fields in the Conversation model
  - Cost field validation (positive values, zero, negative rejection)
  - LineItemId field behavior (null default, ObjectId acceptance)
  - Billing-related queries (unbilled vs billed conversations)

#### Services
- **`twilioCall.service.billing.test.js`** - Tests for cost calculation in TwilioCallService
  - Normal duration cost calculation
  - Minimum billable duration handling
  - Edge cases (zero, negative, very large durations)
  - Configurable billing rates and minimums

- **`payment.service.billing.test.js`** - Tests for payment service billing functions
  - `getUnbilledCostsByOrg()` - Grouping conversations by patient
  - `createInvoiceFromConversations()` - Invoice creation and conversation marking
  - `listInvoicesByOrg()` - Invoice retrieval with filtering
  - `calculateAmount()` - Amount calculation from duration

- **`agenda.billing.test.js`** - Tests for daily billing agenda job
  - `processDailyBilling()` - End-to-end billing process
  - Organization processing and patient grouping
  - Database transaction handling
  - Double-billing prevention
  - Error handling and edge cases

#### Controllers
- **`payment.controller.billing.test.js`** - Tests for payment API endpoints
  - `GET /payments/orgs/:orgId/unbilled-costs` - Unbilled costs retrieval
  - `POST /payments/patients/:patientId/invoices` - Manual invoice creation
  - `GET /payments/orgs/:orgId/invoices` - Invoice listing
  - Authentication and authorization
  - Error handling

### Integration Tests

- **`billing.integration.test.js`** - End-to-end billing system tests
  - Complete billing cycle from conversation to invoice
  - Multiple billing cycles without double billing
  - Mixed billed/unbilled conversation handling
  - Zero-cost conversation handling
  - Concurrent billing process handling
  - Large-scale conversation processing
  - API endpoint integration

## Running Tests

### Run All Billing Tests
```bash
# Run all billing tests
node scripts/run-billing-tests.js

# Run with watch mode
node scripts/run-billing-tests.js --watch

# Run with coverage report
node scripts/run-billing-tests.js --coverage
```

### Run Individual Test Files
```bash
# Unit tests
npm test -- tests/unit/models/conversation.model.test.js
npm test -- tests/unit/services/twilioCall.service.billing.test.js
npm test -- tests/unit/services/payment.service.billing.test.js
npm test -- tests/unit/services/agenda.billing.test.js
npm test -- tests/unit/controllers/payment.controller.billing.test.js

# Integration tests
npm test -- tests/integration/billing.integration.test.js
```

### Run with Jest directly
```bash
# All billing tests
npx jest --testPathPattern="billing|conversation\.model\.test"

# Specific test file
npx jest tests/unit/models/conversation.model.test.js

# With coverage
npx jest --testPathPattern="billing" --coverage
```

## Test Coverage

The tests cover:

### ✅ Core Functionality
- [x] Cost calculation after each call
- [x] Daily billing process execution
- [x] Invoice creation with line items
- [x] Conversation marking as billed
- [x] Double-billing prevention
- [x] Patient-based cost grouping

### ✅ API Endpoints
- [x] Unbilled costs retrieval
- [x] Manual invoice creation
- [x] Invoice listing and filtering
- [x] Authentication and authorization
- [x] Error handling

### ✅ Edge Cases
- [x] Zero-cost conversations
- [x] Failed calls with minimum billing
- [x] Very large numbers of conversations
- [x] Concurrent billing processes
- [x] Mixed billed/unbilled states
- [x] Database transaction failures

### ✅ Data Validation
- [x] Cost field validation
- [x] LineItemId field behavior
- [x] Invoice number generation
- [x] Date handling
- [x] Amount calculations

## Test Data

Tests use realistic test data:
- **Organizations**: Healthcare organizations with proper contact info
- **Patients**: Multiple patients per organization
- **Conversations**: Various durations (15s to 30min), costs ($0.01 to $3.00)
- **Invoices**: Proper numbering (INV-000001, etc.)
- **Line Items**: Patient-grouped billing items

## Mocking

Tests use appropriate mocking:
- **Alert Service**: Uses real alert service (no external dependencies)
- **Database**: Uses MongoDB Memory Server with cleanup
- **Authentication**: Mocked tokens and user sessions
- **Time**: Uses real dates for realistic testing
- **Agenda.js**: Mocked to avoid scheduler initialization issues

## Performance Considerations

Tests include performance validation:
- Large-scale conversation processing (50+ conversations)
- Concurrent billing process handling
- Database transaction efficiency
- API response time validation

## Continuous Integration

These tests are designed to run in CI/CD pipelines:
- No external dependencies
- Proper cleanup and isolation
- Deterministic results
- Clear error reporting
- Coverage reporting

## Debugging Tests

To debug failing tests:

1. **Check test database**: Ensure MongoDB test instance is running
2. **Verify test data**: Check that test data is properly created/cleaned
3. **Review async operations**: Ensure proper await/async handling
4. **Check mocks**: Verify mocked services are properly configured
5. **Review transactions**: Ensure database transactions are properly handled

## Adding New Tests

When adding new billing functionality:

1. **Add unit tests** for new service methods
2. **Add controller tests** for new API endpoints
3. **Add integration tests** for end-to-end flows
4. **Update this README** with new test descriptions
5. **Ensure test coverage** remains high (>90%)

## Test Maintenance

Regular maintenance tasks:
- Update test data when models change
- Review and update mocks as needed
- Ensure tests reflect current business logic
- Monitor test performance and optimize as needed
- Keep test documentation up to date
