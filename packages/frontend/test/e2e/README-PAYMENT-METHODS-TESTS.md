# Payment Methods Screen Tests

This directory contains comprehensive end-to-end tests for the Payment Methods screen functionality in the Bianca App.

## Test Files

### 1. `payment-methods.e2e.test.ts`
Main test suite covering:
- **Screen Navigation**: Accessing payment methods through Org tab
- **UI Elements**: Verifying all required UI components are present
- **Loading States**: Testing loading indicators and error states
- **Access Control**: Ensuring only authorized users can access payment methods
- **Stripe Integration**: Testing Stripe configuration loading and error handling

### 2. `payment-methods-interactions.e2e.test.ts`
Focused test suite for payment method interactions:
- **Payment Method Actions**: Setting default, removing payment methods
- **API Mocking**: Testing with various API responses and errors
- **Data Validation**: Verifying payment method display formats
- **Error Handling**: Testing graceful handling of API failures
- **Edge Cases**: Empty lists, slow responses, network errors

### 3. `helpers/paymentHelpers.ts`
Utility class providing:
- **Navigation Helpers**: Easy navigation to payment methods screen
- **Action Helpers**: Methods for interacting with payment methods
- **Mock Helpers**: Utilities for mocking API responses
- **Validation Helpers**: Methods for checking UI state and content

## Test Coverage

### ✅ **UI Components**
- Payment methods container and title
- Existing payment methods list
- Add payment method form
- Loading and error states
- Action buttons (Set Default, Remove)

### ✅ **User Interactions**
- Setting payment method as default
- Removing payment methods with confirmation
- Canceling payment method removal
- Form interactions (add new payment method)

### ✅ **API Integration**
- Payment methods fetching
- Stripe configuration loading
- Set default payment method API
- Remove payment method API
- Error handling for all API calls

### ✅ **Access Control**
- Admin users can access payment methods
- Non-admin users see access restricted message
- Proper error handling for unauthorized access

### ✅ **Error Scenarios**
- API errors (500, 400, network issues)
- Stripe configuration errors
- Slow API responses
- Empty payment methods list

## Running the Tests

### Prerequisites
1. Backend server running on `localhost:3000`
2. Frontend server running on `localhost:8082`
3. Database seeded with test data

### Run All Payment Methods Tests
```bash
# Run all payment methods tests
npx playwright test payment-methods

# Run with specific reporter
npx playwright test payment-methods --reporter=list

# Run with visual debugging
npx playwright test payment-methods --headed
```

### Run Specific Test Files
```bash
# Main payment methods tests
npx playwright test payment-methods.e2e.test.ts

# Interaction tests
npx playwright test payment-methods-interactions.e2e.test.ts

# Run specific test
npx playwright test --grep="should display payment methods screen"
```

### Run with Debug Mode
```bash
# Step through tests
npx playwright test payment-methods --debug

# Run single test with debug
npx playwright test --grep="should allow setting default payment method" --debug
```

## Test Data

### Mock Payment Methods
The tests use realistic mock data including:
- **Card Types**: Visa, Mastercard with proper formatting
- **Expiration Dates**: Various future dates
- **Billing Details**: Names, emails, addresses
- **Default Status**: Mix of default and non-default methods

### API Mocking
Tests mock various scenarios:
- **Success Responses**: Normal API responses with data
- **Error Responses**: 400, 500 errors with appropriate messages
- **Slow Responses**: Delayed responses to test loading states
- **Empty Responses**: Empty arrays for no payment methods

## Test Structure

### Basic Test Pattern
```typescript
test('Test description', async ({ page }) => {
  // 1. Setup: Login and navigate to payment methods
  await authWorkflow.givenIAmOnTheLoginScreen()
  // ... login steps
  
  // 2. Mock API responses (if needed)
  await paymentHelpers.mockPaymentMethodsResponse(mockData)
  
  // 3. Perform action
  await paymentHelpers.setPaymentMethodAsDefault('pm_1')
  
  // 4. Verify expected behavior
  await expect(page.getByTestId('payment-message')).toBeVisible()
})
```

### Using PaymentHelpers
```typescript
const paymentHelpers = new PaymentHelpers(page)

// Navigate to payment methods
await paymentHelpers.navigateToPaymentMethods()

// Wait for loading to complete
await paymentHelpers.waitForPaymentMethodsToLoad()

// Get payment method count
const count = await paymentHelpers.getPaymentMethodCount()

// Set payment method as default
await paymentHelpers.setPaymentMethodAsDefault('pm_1')

// Remove payment method
await paymentHelpers.removePaymentMethod('pm_1')
```

## Accessibility Labels Required

The tests rely on specific accessibility labels in the components (using `accessibilityLabel` for React Native Web):

### StripeWebPayment Component
- `stripe-web-payment-container`
- `payment-methods-title`
- `existing-payment-methods`
- `existing-methods-title`
- `payment-method-card-{id}`
- `payment-method-text-{id}`
- `payment-method-subtext-{id}`
- `default-badge-{id}`
- `set-default-button-{id}`
- `remove-button-{id}`
- `add-payment-form`
- `add-card-title`
- `card-element-container`
- `add-payment-method-button`
- `payment-message`
- `payment-methods-loading`
- `payment-methods-error`

### PaymentInfoScreen Component (uses testID for Ignite components)
- `payment-methods-container`
- `payment-methods-tab`
- `access-restricted-title`
- `access-restricted-message`

## Expected Results

### ✅ **Passing Tests Indicate**
- Payment methods screen loads correctly
- All UI elements are present and functional
- Payment method actions work as expected
- Error handling is robust
- Access control is properly implemented

### ❌ **Failing Tests Indicate**
- UI components missing or not rendering
- API integration issues
- Action buttons not working
- Error handling not working
- Access control bypassed

## Troubleshooting

### Common Issues
1. **Test Timeouts**: Increase timeout in test configuration
2. **Element Not Found**: Check test IDs are properly set
3. **API Mocking Issues**: Verify route patterns match actual API calls
4. **Login Failures**: Ensure test credentials are valid

### Debug Tips
1. Use `--headed` flag to see browser interactions
2. Use `--debug` flag to step through tests
3. Add `await page.pause()` to pause execution
4. Check browser console for errors
5. Verify API calls in Network tab

## Maintenance

### When to Update Tests
- New payment method features added
- UI changes that affect test IDs
- API changes that affect mocking
- New error scenarios to test

### Adding New Tests
1. Follow existing test patterns
2. Use PaymentHelpers for common operations
3. Mock APIs appropriately
4. Test both success and error scenarios
5. Update this README if needed
