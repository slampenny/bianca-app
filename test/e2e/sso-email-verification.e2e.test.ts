import { test, expect, Page } from '@playwright/test';

test.describe('SSO Email Verification Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Google SSO Registration', () => {
    test('should create SSO user with pre-verified email', async ({ page }) => {
      // Mock Google SSO response
      await page.route('**/auth/sso/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            caregiver: {
              id: '123',
              email: 'google@example.com',
              name: 'Google User',
              isEmailVerified: true, // SSO users are pre-verified
              role: 'unverified', // But still need to complete profile
              ssoProvider: 'google',
            },
            tokens: {
              access: { token: 'access-token' },
              refresh: { token: 'refresh-token' },
            },
          }),
        });
      });

      // Click Google login button
      await page.click('[data-testid="google-login-button"]');

      // Should be able to login immediately (email is pre-verified)
      await expect(page).toHaveURL(/.*main-tabs/);
    });

    test('should redirect SSO user to profile completion', async ({ page }) => {
      // Mock Google SSO response for new user
      await page.route('**/auth/sso/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            caregiver: {
              id: '123',
              email: 'newsso@example.com',
              name: 'New SSO User',
              isEmailVerified: true,
              role: 'unverified', // Needs profile completion
              ssoProvider: 'google',
            },
            tokens: {
              access: { token: 'access-token' },
              refresh: { token: 'refresh-token' },
            },
          }),
        });
      });

      await page.click('[data-testid="google-login-button"]');

      // Should redirect to profile screen for completion
      await expect(page).toHaveURL(/.*profile/);
    });
  });

  test.describe('Microsoft SSO Registration', () => {
    test('should create Microsoft SSO user with pre-verified email', async ({ page }) => {
      // Mock Microsoft SSO response
      await page.route('**/auth/sso/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            caregiver: {
              id: '123',
              email: 'microsoft@example.com',
              name: 'Microsoft User',
              isEmailVerified: true,
              role: 'unverified',
              ssoProvider: 'microsoft',
            },
            tokens: {
              access: { token: 'access-token' },
              refresh: { token: 'refresh-token' },
            },
          }),
        });
      });

      await page.click('[data-testid="microsoft-login-button"]');

      // Should be able to login immediately
      await expect(page).toHaveURL(/.*main-tabs/);
    });
  });

  test.describe('SSO User Profile Completion', () => {
    test.beforeEach(async ({ page }) => {
      // Mock SSO login that creates unverified user
      await page.route('**/auth/sso/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            caregiver: {
              id: '123',
              email: 'sso-profile@example.com',
              name: 'SSO Profile User',
              isEmailVerified: true,
              role: 'unverified',
              ssoProvider: 'google',
            },
            tokens: {
              access: { token: 'access-token' },
              refresh: { token: 'refresh-token' },
            },
          }),
        });
      });

      await page.click('[data-testid="google-login-button"]');
    });

    test('should promote SSO user to orgAdmin after profile completion', async ({ page }) => {
      // Mock profile update response
      await page.route('**/caregivers/*', async route => {
        if (route.request().method() === 'PATCH') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: '123',
              email: 'sso-profile@example.com',
              name: 'SSO Profile User',
              phone: '+1234567890',
              isEmailVerified: true,
              role: 'orgAdmin', // Promoted to orgAdmin
              ssoProvider: 'google',
            }),
          });
        }
      });

      // Complete profile with phone number
      await page.fill('[data-testid="phone-input"]', '+1234567890');
      await page.click('[data-testid="save-profile-button"]');

      // Should be promoted to orgAdmin
      await expect(page.locator('text=Profile updated successfully')).toBeVisible();
    });
  });

  test.describe('Mixed Registration Types', () => {
    test('should handle user who registers with email then tries SSO', async ({ page }) => {
      const testUser = {
        name: 'Mixed User',
        email: 'mixed@example.com',
        password: 'Password123',
        phone: '+1234567890',
      };

      // First register with email
      await page.click('[data-testid="register-button"]');
      await page.fill('[data-testid="name-input"]', testUser.name);
      await page.fill('[data-testid="email-input"]', testUser.email);
      await page.fill('[data-testid="password-input"]', testUser.password);
      await page.fill('[data-testid="confirm-password-input"]', testUser.password);
      await page.fill('[data-testid="phone-input"]', testUser.phone);
      await page.click('[data-testid="register-submit-button"]');

      // Should be on email verification screen
      await expect(page).toHaveURL(/.*email-verification-required/);

      // Now try SSO with same email
      await page.route('**/auth/sso/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            caregiver: {
              id: '123',
              email: testUser.email,
              name: testUser.name,
              isEmailVerified: false, // Still unverified from email registration
              role: 'unverified',
              ssoProvider: 'google',
            },
            tokens: {
              access: { token: 'access-token' },
              refresh: { token: 'refresh-token' },
            },
          }),
        });
      });

      await page.click('[data-testid="back-to-login-button"]');
      await page.click('[data-testid="google-login-button"]');

      // Should still need email verification
      await expect(page).toHaveURL(/.*email-verification-required/);
    });

    test('should handle SSO user who then tries email registration', async ({ page }) => {
      // First login with SSO
      await page.route('**/auth/sso/login', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            caregiver: {
              id: '123',
              email: 'sso-first@example.com',
              name: 'SSO First User',
              isEmailVerified: true,
              role: 'orgAdmin',
              ssoProvider: 'google',
            },
            tokens: {
              access: { token: 'access-token' },
              refresh: { token: 'refresh-token' },
            },
          }),
        });
      });

      await page.click('[data-testid="google-login-button"]');
      await expect(page).toHaveURL(/.*main-tabs/);

      // Logout
      await page.click('[data-testid="logout-button"]');
      await expect(page).toHaveURL(/.*login/);

      // Try to register with same email
      await page.click('[data-testid="register-button"]');
      await page.fill('[data-testid="name-input"]', 'SSO First User');
      await page.fill('[data-testid="email-input"]', 'sso-first@example.com');
      await page.fill('[data-testid="password-input"]', 'Password123');
      await page.fill('[data-testid="confirm-password-input"]', 'Password123');
      await page.fill('[data-testid="phone-input"]', '+1234567890');
      await page.click('[data-testid="register-submit-button"]');

      // Should show error about email already taken
      await expect(page.locator('text=Email already taken')).toBeVisible();
    });
  });

  test.describe('SSO Error Handling', () => {
    test('should handle SSO authentication failure', async ({ page }) => {
      // Mock SSO failure
      await page.route('**/auth/sso/login', async route => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'SSO authentication failed' }),
        });
      });

      await page.click('[data-testid="google-login-button"]');

      // Should show error message
      await expect(page.locator('text=SSO login failed')).toBeVisible();
    });

    test('should handle SSO network errors', async ({ page }) => {
      // Mock network error
      await page.route('**/auth/sso/login', async route => {
        await route.abort('Failed');
      });

      await page.click('[data-testid="google-login-button"]');

      // Should show error message
      await expect(page.locator('text=SSO login failed')).toBeVisible();
    });

    test('should handle SSO user creation failure', async ({ page }) => {
      // Mock SSO response with server error
      await page.route('**/auth/sso/login', async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Failed to create user' }),
        });
      });

      await page.click('[data-testid="google-login-button"]');

      // Should show error message
      await expect(page.locator('text=SSO login failed')).toBeVisible();
    });
  });
});
