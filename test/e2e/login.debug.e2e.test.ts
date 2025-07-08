import { test } from './helpers/testHelpers'
import { expect } from '@playwright/test'
import { logoutViaUI } from './helpers/testHelpers'
import { navigateToRegister } from './helpers/navigation'
import { 
  debugBreak, 
  debugScreenshot, 
  debugPageState, 
  debugElement, 
  debugFillForm, 
  debugClick,
  debugNavigation,
  createDebugTest 
} from './helpers/debugHelpers'

// Example 1: Using debug helpers in a regular test
test('user can fill login form and see error on failure - with debugging', async ({ page }) => {
  // Set up API call debugging
  page.on('request', request => {
    console.log(`🌐 API Request: ${request.method()} ${request.url()}`);
  });
  
  page.on('response', response => {
    console.log(`📡 API Response: ${response.status()} ${response.url()}`);
  });

  console.log('🚀 Starting login test with debugging');
  
  // Debug the initial page state
  await debugPageState(page, 'Initial login page state');
  
  // Debug filling the email field
  await debugElement(page, '[data-testid="email-input"]', 'Email input field');
  await page.getByTestId('email-input').fill('fake@example.org');
  console.log('✅ Filled email field');
  
  // Optional: pause to see the filled field
  await debugBreak('Email field filled - check the browser and press any key to continue');
  
  // Debug filling the password field
  await debugElement(page, '[data-testid="password-input"]', 'Password input field');
  await page.getByTestId('password-input').fill('wrongpassword');
  console.log('✅ Filled password field');
  
  // Take a screenshot before clicking login
  await debugScreenshot(page, 'before-login-click');
  
  // Debug clicking the login button
  await debugClick(page, '[data-testid="login-button"]', 'Login button');
  
  // Wait for the error message and debug it
  const errorText = page.getByText(/Failed to log in. Please check your email and password./i);
  await expect(errorText).toBeVisible();
  
  console.log('✅ Error message is visible');
  
  // Take a final screenshot
  await debugScreenshot(page, 'after-error-message');
  
  await debugPageState(page, 'Final state after login attempt');
});

// Example 2: Using the debug form helper
test('debug form filling with helper function', async ({ page }) => {
  console.log('🚀 Starting form debug test');
  
  const formData = {
    'email-input': 'test@example.org',
    'password-input': 'testpassword123'
  };
  
  // Use the debug form helper
  await debugFillForm(page, formData);
  
  // Pause to see the filled form
  await debugBreak('Form filled - check the browser and press any key to continue');
  
  // Click login and wait for result
  await debugClick(page, '[data-testid="login-button"]', 'Login button');
  
  // Wait for navigation or error
  await debugNavigation(page, 'After login attempt');
});

// Example 3: Debug register navigation
test('debug register navigation', async ({ page }) => {
  console.log('🚀 Starting register navigation debug test');
  
  // Navigate to register screen
  await debugNavigation(page, 'Navigating to register screen');
  await navigateToRegister(page);
  
  // Debug the register form
  await debugPageState(page, 'Register screen loaded');
  
  // Fill register form with debug helper
  const registerFormData = {
    'register-name': 'Debug User',
    'register-email': 'debug@example.org',
    'register-password': 'DebugPass123!',
    'register-confirm-password': 'DebugPass123!',
    'register-phone': '1234567890'
  };
  
  await debugFillForm(page, registerFormData);
  
  // Pause to see the filled form
  await debugBreak('Register form filled - check the browser and press any key to continue');
  
  // Submit the form
  await debugClick(page, '[data-testid="register-submit"]', 'Register submit button');
  
  // Wait for result
  await debugNavigation(page, 'After register submission');
});

// Example 3: Using the debug test wrapper
const debugLoginTest = createDebugTest(async (page) => {
  // This test will automatically have debugging capabilities
  await page.getByTestId('email-input').fill('debug@example.org');
  await page.getByTestId('password-input').fill('debugpassword123');
  
  // Add a breakpoint to see the form state
  await debugBreak('Form filled in debug test - press any key to continue');
  
  await page.getByTestId('login-button').click();
  
  const errorText = page.getByText(/Failed to log in. Please check your email and password./i);
  await expect(errorText).toBeVisible();
});

test('login test with debug wrapper', debugLoginTest);

test.afterEach(async ({ page }) => {
  await logoutViaUI(page);
}); 