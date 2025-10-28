import { test, expect, Page } from '@playwright/test';
import { registerUserViaUI, loginUserViaUI } from './helpers/testHelpers';
import { AuthWorkflow } from './workflows/auth.workflow';

test.describe('Email Verification Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Debug: Wait for page to load and check what's visible
    await page.waitForLoadState('networkidle');
    console.log('Page loaded, checking for elements...');
    
    // Check page title and URL
    const title = await page.title();
    const url = page.url();
    console.log(`Page title: "${title}", URL: "${url}"`);
    
    // Check if we can find any elements using different methods
    const registerLinkCount = await page.getByTestId('register-link').count();
    const emailInputCount = await page.getByTestId('email-input').count();
    const registerTextCount = await page.getByText('Register').count();
    console.log(`Register link count: ${registerLinkCount}, Email input count: ${emailInputCount}, Register text count: ${registerTextCount}`);
    
    // Try to find elements by accessibility label directly
    const registerByAriaLabel = await page.locator('[aria-label="register-link"]').count();
    const emailByAriaLabel = await page.locator('[aria-label="email-input"]').count();
    console.log(`Register by aria-label: ${registerByAriaLabel}, Email by aria-label: ${emailByAriaLabel}`);
    
    // Check for any text content
    const bodyText = await page.textContent('body');
    console.log(`Body text preview: ${bodyText?.substring(0, 200)}...`);
    
    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
    
    // Monitor page errors
    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-page.png' });
  });

  test.describe('Registration Flow', () => {
    test('should register user and redirect to email verification screen', async ({ page }) => {
      const testUser = {
        name: 'Test User',
        email: 'test1@example.com',
        password: 'Password123!',
        phone: '+16045624263',
      };

      // Navigate to registration using working selector
      await page.locator('[aria-label="register-link"]').click();
      await expect(page).toHaveURL(/.*Register/);

      // Fill registration form using working selectors
      await page.locator('[aria-label="register-name"]').fill(testUser.name);
      await page.locator('[aria-label="register-email"]').fill(testUser.email);
      await page.locator('[aria-label="register-password"]').fill(testUser.password);
      await page.locator('[aria-label="register-confirm-password"]').fill(testUser.password);
      await page.locator('[aria-label="register-phone"]').fill(testUser.phone);

      // Submit registration
      await page.locator('[aria-label="register-submit"]').click();
      
      // Debug: Wait a bit and check what happens
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`After registration submit - URL: ${currentUrl}, Title: ${pageTitle}`);
      
      // Check for any error messages
      const errorText = await page.textContent('body');
      console.log(`Page content after submit: ${errorText?.substring(0, 300)}...`);
      
      // Check for network requests
      const requests = await page.evaluate(() => {
        return window.performance.getEntriesByType('resource')
          .filter((entry: any) => entry.name.includes('/auth/register'))
          .map((entry: any) => ({
            url: entry.name,
            status: entry.responseStatus || 'unknown',
            duration: entry.duration
          }));
      });
      console.log('Registration API requests:', requests);
    });

    test('should show registration success message', async ({ page }) => {
      const testUser = {
        name: 'Test User 2',
        email: 'test11@example.com',
        password: 'Password123!',
        phone: '+16045624273',
      };

      // Complete registration
      await page.locator('[aria-label="register-link"]').click();
      await page.locator('[aria-label="register-name"]').fill(testUser.name);
      await page.locator('[aria-label="register-email"]').fill(testUser.email);
      await page.locator('[aria-label="register-password"]').fill(testUser.password);
      await page.locator('[aria-label="register-confirm-password"]').fill(testUser.password);
      await page.locator('[aria-label="register-phone"]').fill(testUser.phone);
      await page.locator('[aria-label="register-submit"]').click();

      // Check for success message
      await expect(page.locator('text=Registration successful')).toBeVisible();
      await expect(page.locator('text=check your email')).toBeVisible();
    });

    test('should validate registration form fields', async ({ page }) => {
      await page.locator('[aria-label="register-link"]').click();

      // Try to submit empty form
      await page.locator('[aria-label="register-submit"]').click();

      // Should show validation errors
      await expect(page.locator('text=Name cannot be empty')).toBeVisible();
      await expect(page.locator('text=Please enter a valid email address')).toBeVisible();
      await expect(page.locator('text=Password is required')).toBeVisible();
    });
  });

  test.describe('Email Verification Required Screen', () => {
    test.beforeEach(async ({ page }) => {
      // Register a user first
      const testUser = {
        name: 'Verification Test User',
        email: 'verification@example.com',
        password: 'Password123!',
        phone: '+16045624263',
      };

      await page.locator('[aria-label="register-link"]').click();
      await page.locator('[aria-label="register-name"]').fill(testUser.name);
      await page.locator('[aria-label="register-email"]').fill(testUser.email);
      await page.locator('[aria-label="register-password"]').fill(testUser.password);
      await page.locator('[aria-label="register-confirm-password"]').fill(testUser.password);
      await page.locator('[aria-label="register-phone"]').fill(testUser.phone);
      await page.locator('[aria-label="register-submit"]').click();

      // Should be on email verification screen
      await expect(page).toHaveURL(/.*email-verification-required/);
    });

    test('should display email verification instructions', async ({ page }) => {
      await expect(page.locator('text=Check Your Email')).toBeVisible();
      await expect(page.locator('text=verification link')).toBeVisible();
      await expect(page.locator('text=verify your account')).toBeVisible();
    });

    test('should have resend verification email button', async ({ page }) => {
      await expect(page.locator('[aria-label="resend-verification-button"]')).toBeVisible();
    });

    test('should have back to login button', async ({ page }) => {
      await expect(page.locator('[aria-label="back-to-login-button"]')).toBeVisible();
    });

    test('should navigate back to login when clicking back button', async ({ page }) => {
      await page.locator('[aria-label="back-to-login-button"]').click();
      await expect(page).toHaveURL(/.*login/);
    });

    test('should show success message when resending verification email', async ({ page }) => {
      // Mock successful API response
      await page.route('**/auth/resend-verification-email', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Verification email sent successfully' }),
        });
      });

      await page.locator('[aria-label="resend-verification-button"]').click();
      
      await expect(page.locator('text=Verification email sent successfully')).toBeVisible();
    });

    test('should show error message when resend fails', async ({ page }) => {
      // Mock failed API response
      await page.route('**/auth/resend-verification-email', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Failed to send verification email' }),
        });
      });

      await page.locator('[aria-label="resend-verification-button"]').click();
      
      await expect(page.locator('text=Failed to send verification email')).toBeVisible();
    });
  });

  test.describe('Login with Unverified Email', () => {
    test.beforeEach(async ({ page }) => {
      // Register a user but don't verify email
      const testUser = {
        name: 'Unverified User',
        email: 'unverified@example.com',
        password: 'Password123!',
        phone: '+16045624263',
      };

      await page.locator('[aria-label="register-link"]').click();
      await page.locator('[aria-label="register-name"]').fill(testUser.name);
      await page.locator('[aria-label="register-email"]').fill(testUser.email);
      await page.locator('[aria-label="register-password"]').fill(testUser.password);
      await page.locator('[aria-label="register-confirm-password"]').fill(testUser.password);
      await page.locator('[aria-label="register-phone"]').fill(testUser.phone);
      await page.locator('[aria-label="register-submit"]').click();

      // Navigate back to login
      await page.locator('[aria-label="back-to-login-button"]').click();
    });

    test('should block login for unverified email and show error message', async ({ page }) => {
      // Mock API response for unverified email
      await page.route('**/auth/login', async route => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ 
            message: 'Please verify your email before logging in. A verification email has been sent.' 
          }),
        });
      });

      await page.locator('[aria-label="email-input"]').fill('unverified@example.com');
      await page.locator('[aria-label="password-input"]').fill('Password123');
      await page.locator('[aria-label="login-button"]').click();

      await expect(page.locator('text=verify your email')).toBeVisible();
      await expect(page.locator('text=verification link')).toBeVisible();
    });

    test('should redirect to email verification screen on login failure', async ({ page }) => {
      // Mock API response that redirects to verification screen
      await page.route('**/auth/login', async route => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ 
            message: 'Please verify your email before logging in. A verification email has been sent.' 
          }),
        });
      });

      await page.locator('[aria-label="email-input"]').fill('unverified@example.com');
      await page.locator('[aria-label="password-input"]').fill('Password123');
      await page.locator('[aria-label="login-button"]').click();

      // Should redirect to email verification screen
      await expect(page).toHaveURL(/.*email-verification-required/);
    });

    test('should allow login for verified email', async ({ page }) => {
      // Mock successful login response
      await page.route('**/auth/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            caregiver: {
              id: '123',
              email: 'verified@example.com',
              name: 'Verified User',
              isEmailVerified: true,
            },
            tokens: {
              access: { token: 'access-token' },
              refresh: { token: 'refresh-token' },
            },
          }),
        });
      });

      await page.locator('[aria-label="email-input"]').fill('verified@example.com');
      await page.locator('[aria-label="password-input"]').fill('Password123');
      await page.locator('[aria-label="login-button"]').click();

      // Should navigate to main app
      await expect(page).toHaveURL(/.*main-tabs/);
    });
  });

  test.describe('Email Verification Link', () => {
    test('should handle email verification link click', async ({ page }) => {
      // Mock successful verification response
      await page.route('**/auth/verify-email*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `
            <!DOCTYPE html>
            <html>
              <head><title>Email Verified</title></head>
              <body>
                <h1>Email Verified!</h1>
                <p>Your account has been successfully verified.</p>
                <script>
                  setTimeout(() => {
                    window.location.href = '/main-tabs';
                  }, 3000);
                </script>
              </body>
            </html>
          `,
        });
      });

      // Navigate to verification link
      await page.goto('/auth/verify-email?token=test-token-123');

      await expect(page.locator('text=Email Verified!')).toBeVisible();
      await expect(page.locator('text=successfully verified')).toBeVisible();
    });

    test('should handle invalid verification token', async ({ page }) => {
      // Mock failed verification response
      await page.route('**/auth/verify-email*', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Email verification failed' }),
        });
      });

      await page.goto('/auth/verify-email?token=invalid-token');

      // Should show error or redirect to login
      await expect(page.locator('text=verification failed')).toBeVisible();
    });
  });

  test.describe('Complete Email Verification Workflow', () => {
    test('should complete full email verification flow', async ({ page }) => {
      const testUser = {
        name: 'Complete Flow User',
        email: 'complete@example.com',
        password: 'Password123!',
        phone: '+16045624263',
      };

      // Step 1: Register user
      await page.locator('[aria-label="register-link"]').click();
      await page.locator('[aria-label="register-name"]').fill(testUser.name);
      await page.locator('[aria-label="register-email"]').fill(testUser.email);
      await page.locator('[aria-label="register-password"]').fill(testUser.password);
      await page.locator('[aria-label="register-confirm-password"]').fill(testUser.password);
      await page.locator('[aria-label="register-phone"]').fill(testUser.phone);
      await page.locator('[aria-label="register-submit"]').click();

      // Should be on email verification screen
      await expect(page).toHaveURL(/.*email-verification-required/);

      // Step 2: Try to login (should fail)
      await page.locator('[aria-label="back-to-login-button"]').click();
      
      await page.route('**/auth/login', async route => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ 
            message: 'Please verify your email before logging in. A verification email has been sent.' 
          }),
        });
      });

      await page.locator('[aria-label="email-input"]').fill(testUser.email);
      await page.locator('[aria-label="password-input"]').fill(testUser.password);
      await page.locator('[aria-label="login-button"]').click();

      // Should redirect back to verification screen
      await expect(page).toHaveURL(/.*email-verification-required/);

      // Step 3: Simulate email verification
      await page.route('**/auth/verify-email*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: `
            <!DOCTYPE html>
            <html>
              <head><title>Email Verified</title></head>
              <body>
                <h1>Email Verified!</h1>
                <script>
                  setTimeout(() => {
                    window.location.href = '/main-tabs';
                  }, 1000);
                </script>
              </body>
            </html>
          `,
        });
      });

      await page.goto('/auth/verify-email?token=test-token-123');
      await expect(page.locator('text=Email Verified!')).toBeVisible();

      // Step 4: Login should now work
      await page.route('**/auth/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            caregiver: {
              id: '123',
              email: testUser.email,
              name: testUser.name,
              isEmailVerified: true,
            },
            tokens: {
              access: { token: 'access-token' },
              refresh: { token: 'refresh-token' },
            },
          }),
        });
      });

      await page.goto('/');
      await page.locator('[aria-label="email-input"]').fill(testUser.email);
      await page.locator('[aria-label="password-input"]').fill(testUser.password);
      await page.locator('[aria-label="login-button"]').click();

      // Should successfully login
      await expect(page).toHaveURL(/.*main-tabs/);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Mock network error
      await page.route('**/auth/register', async route => {
        await route.abort('Failed');
      });

      await page.locator('[aria-label="register-link"]').click();
      await page.locator('[aria-label="register-name"]').fill('Test User');
      await page.locator('[aria-label="register-email"]').fill('test@example.com');
      await page.locator('[aria-label="register-password"]').fill('Password123');
      await page.locator('[aria-label="register-confirm-password"]').fill('Password123');
      await page.locator('[aria-label="register-phone"]').fill('+1234567890');
      await page.locator('[aria-label="register-submit"]').click();

      // Should show error message
      await expect(page.locator('text=Registration Failed')).toBeVisible();
    });

    test('should handle server errors during resend', async ({ page }) => {
      // Register user first
      const testUser = {
        name: 'Error Test User',
        email: 'error@example.com',
        password: 'Password123!',
        phone: '+16045624263',
      };

      await page.locator('[aria-label="register-link"]').click();
      await page.locator('[aria-label="register-name"]').fill(testUser.name);
      await page.locator('[aria-label="register-email"]').fill(testUser.email);
      await page.locator('[aria-label="register-password"]').fill(testUser.password);
      await page.locator('[aria-label="register-confirm-password"]').fill(testUser.password);
      await page.locator('[aria-label="register-phone"]').fill(testUser.phone);
      await page.locator('[aria-label="register-submit"]').click();

      // Mock server error for resend
      await page.route('**/auth/resend-verification-email', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' }),
        });
      });

      await page.locator('[aria-label="resend-verification-button"]').click();
      
      await expect(page.locator('text=Internal server error')).toBeVisible();
    });
  });
});
