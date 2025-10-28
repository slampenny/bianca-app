import { test, expect, Page } from '@playwright/test';
import { registerUserViaUI, loginUserViaUI } from './helpers/testHelpers';

test.describe('Email Verification Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test.describe('Registration Flow', () => {
    test('should register user and redirect to email verification screen', async ({ page }) => {
      const testUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        phone: '+16045624263',
      };

      // Navigate to registration
      await page.click('[accessibilityLabel="register-button"]');
      await expect(page).toHaveURL(/.*register/);

      // Fill registration form
      await page.fill('[accessibilityLabel="register-name"]', testUser.name);
      await page.fill('[accessibilityLabel="register-email"]', testUser.email);
      await page.fill('[accessibilityLabel="register-password"]', testUser.password);
      await page.fill('[accessibilityLabel="register-confirm-password"]', testUser.password);
      await page.fill('[accessibilityLabel="register-phone"]', testUser.phone);

      // Submit registration
      await page.click('[accessibilityLabel="register-submit"]');

      // Should redirect to email verification screen
      await expect(page).toHaveURL(/.*email-verification-required/);
      await expect(page.locator('text=Check Your Email')).toBeVisible();
      await expect(page.locator('text=verification link')).toBeVisible();
    });

    test('should show registration success message', async ({ page }) => {
      const testUser = {
        name: 'Test User 2',
        email: 'test2@example.com',
        password: 'Password123',
        phone: '+16045624263',
      };

      // Complete registration
      await page.click('[data-testid="register-button"]');
      await page.fill('[data-testid="name-input"]', testUser.name);
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.fill('[data-testid="confirm-password-input"]', testUser.password);
      await page.fill('[data-testid="phone-input"]', testUser.phone);
      await page.click('[data-testid="register-submit-button"]');

      // Check for success message
      await expect(page.locator('text=Registration successful')).toBeVisible();
      await expect(page.locator('text=check your email')).toBeVisible();
    });

    test('should validate registration form fields', async ({ page }) => {
      await page.click('[data-testid="register-button"]');

      // Try to submit empty form
      await page.click('[data-testid="register-submit-button"]');

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
        password: 'Password123',
        phone: '+16045624263',
      };

      await page.click('[data-testid="register-button"]');
      await page.fill('[data-testid="name-input"]', testUser.name);
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.fill('[data-testid="confirm-password-input"]', testUser.password);
      await page.fill('[data-testid="phone-input"]', testUser.phone);
      await page.click('[data-testid="register-submit-button"]');

      // Should be on email verification screen
      await expect(page).toHaveURL(/.*email-verification-required/);
    });

    test('should display email verification instructions', async ({ page }) => {
      await expect(page.locator('text=Check Your Email')).toBeVisible();
      await expect(page.locator('text=verification link')).toBeVisible();
      await expect(page.locator('text=verify your account')).toBeVisible();
    });

    test('should have resend verification email button', async ({ page }) => {
      await expect(page.locator('[data-testid="resend-verification-button"]')).toBeVisible();
    });

    test('should have back to login button', async ({ page }) => {
      await expect(page.locator('[data-testid="back-to-login-button"]')).toBeVisible();
    });

    test('should navigate back to login when clicking back button', async ({ page }) => {
      await page.click('[data-testid="back-to-login-button"]');
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

      await page.click('[data-testid="resend-verification-button"]');
      
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

      await page.click('[data-testid="resend-verification-button"]');
      
      await expect(page.locator('text=Failed to send verification email')).toBeVisible();
    });
  });

  test.describe('Login with Unverified Email', () => {
    test.beforeEach(async ({ page }) => {
      // Register a user but don't verify email
      const testUser = {
        name: 'Unverified User',
        email: 'unverified@example.com',
        password: 'Password123',
        phone: '+16045624263',
      };

      await page.click('[data-testid="register-button"]');
      await page.fill('[data-testid="name-input"]', testUser.name);
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.fill('[data-testid="confirm-password-input"]', testUser.password);
      await page.fill('[data-testid="phone-input"]', testUser.phone);
      await page.click('[data-testid="register-submit-button"]');

      // Navigate back to login
      await page.click('[data-testid="back-to-login-button"]');
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

      await page.fill('[data-testid="email-input"]', 'unverified@example.com');
      await page.fill('[data-testid="password-input"]', 'Password123');
      await page.click('[data-testid="login-button"]');

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

      await page.fill('[data-testid="email-input"]', 'unverified@example.com');
      await page.fill('[data-testid="password-input"]', 'Password123');
      await page.click('[data-testid="login-button"]');

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

      await page.fill('[data-testid="email-input"]', 'verified@example.com');
      await page.fill('[data-testid="password-input"]', 'Password123');
      await page.click('[data-testid="login-button"]');

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
        password: 'Password123',
        phone: '+16045624263',
      };

      // Step 1: Register user
      await page.click('[data-testid="register-button"]');
      await page.fill('[data-testid="name-input"]', testUser.name);
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.fill('[data-testid="confirm-password-input"]', testUser.password);
      await page.fill('[data-testid="phone-input"]', testUser.phone);
      await page.click('[data-testid="register-submit-button"]');

      // Should be on email verification screen
      await expect(page).toHaveURL(/.*email-verification-required/);

      // Step 2: Try to login (should fail)
      await page.click('[data-testid="back-to-login-button"]');
      
      await page.route('**/auth/login', async route => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ 
            message: 'Please verify your email before logging in. A verification email has been sent.' 
          }),
        });
      });

      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.click('[data-testid="login-button"]');

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
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.click('[data-testid="login-button"]');

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

      await page.click('[data-testid="register-button"]');
      await page.fill('[data-testid="name-input"]', 'Test User');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'Password123');
      await page.fill('[data-testid="confirm-password-input"]', 'Password123');
      await page.fill('[data-testid="phone-input"]', '+1234567890');
      await page.click('[data-testid="register-submit-button"]');

      // Should show error message
      await expect(page.locator('text=Registration Failed')).toBeVisible();
    });

    test('should handle server errors during resend', async ({ page }) => {
      // Register user first
      const testUser = {
        name: 'Error Test User',
        email: 'error@example.com',
        password: 'Password123',
        phone: '+16045624263',
      };

      await page.click('[data-testid="register-button"]');
      await page.fill('[data-testid="name-input"]', testUser.name);
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.fill('[data-testid="confirm-password-input"]', testUser.password);
      await page.fill('[data-testid="phone-input"]', testUser.phone);
      await page.click('[data-testid="register-submit-button"]');

      // Mock server error for resend
      await page.route('**/auth/resend-verification-email', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal server error' }),
        });
      });

      await page.click('[data-testid="resend-verification-button"]');
      
      await expect(page.locator('text=Internal server error')).toBeVisible();
    });
  });
});
