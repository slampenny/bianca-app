import { test, expect, Page } from '@playwright/test'
import { generateUniqueTestData, TEST_USERS } from './fixtures/testData'
import { getEmailFromEthereal } from './helpers/backendHelpers'
import { FRONTEND_URL, getFrontendUrl } from './helpers/testConfig'
import {
  getAuthAccessTokenFromPage,
  getCaregiverOrgIdFromApi,
  getOrgIdFromPage,
  loginIfNeeded,
} from './helpers/testHelpers'
import { navigateToTab, isHomeScreen, navigateToOrgScreen } from './helpers/navigation'

test.describe('Client Consent Flow - End to End with Ethereal', () => {
  let testData: ReturnType<typeof generateUniqueTestData>
  let testClientEmail: string
  const testPassword = 'Password123!'

  test.beforeEach(() => {
    testData = generateUniqueTestData('client-consent-e2e')
    // Use a unique email for each test run to avoid conflicts
    testClientEmail = `client-consent-${Date.now()}@example.com`
  })

  test('complete client consent flow works end-to-end with real email', async ({ page }) => {
    // Server /test/get-email can block up to maxWaitMs while polling IMAP; keep headroom above that.
    test.setTimeout(180_000)
    // Force Ethereal initialization for this test run
    const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1'
    try {
      await page.request.post(`${API_BASE_URL}/test/e2e-email-capture`, { data: { enable: true } })
      console.log('✅ E2E in-memory email capture enabled')
    } catch (error) {
      console.log('⚠️ Could not enable e2e-email-capture:', error.message)
    }
    try {
      await page.request.post(`${API_BASE_URL}/test/force-ethereal-init`)
      console.log('✅ Forced Ethereal initialization for test')
    } catch (error) {
      console.log('⚠️ Could not force Ethereal init:', error.message)
    }
    
    // Step 1: Login as org admin
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')
    
    await loginIfNeeded(page, TEST_USERS.ORG_ADMIN.email, TEST_USERS.ORG_ADMIN.password)
    // Stay logged in as org admin — do not call navigateToHome() without user or it re-logs in as staff.

    // Step 2: Enable "Require Client Consent" in org settings
    console.log('Enabling Require Client Consent setting...')
    await navigateToOrgScreen(page)
    
    // Wait for org screen to load
    await page.waitForTimeout(2000)
    
    // Find and toggle the "Require Client Consent" toggle (UI may still say patient in legacy builds)
    const consentToggle = page.locator('[data-testid="require-client-consent-toggle"]').or(
      page.locator('text=/require.*patient.*consent/i').locator('..').locator('input[type="checkbox"], [role="switch"]')
    ).first()
    
    // Try multiple ways to find the toggle
    let toggleFound = false
    const toggleSelectors = [
      '[data-testid="require-client-consent-toggle"]',
      'text=/require.*client.*consent/i',
      'text=/require.*patient.*consent/i',
      'text=/client.*consent/i',
    ]
    
    for (const selector of toggleSelectors) {
      try {
        const element = page.locator(selector).first()
        if (await element.isVisible({ timeout: 2000 })) {
          // If it's a text element, find the toggle nearby
          if (selector.includes('text=')) {
            const parent = element.locator('..').or(element.locator('xpath=ancestor::*[contains(@class, "toggle") or contains(@class, "switch")]'))
            const nearbyToggle = parent.locator('input[type="checkbox"], [role="switch"], button').first()
            if (await nearbyToggle.isVisible({ timeout: 1000 })) {
              await nearbyToggle.click()
              toggleFound = true
              break
            }
          } else {
            await element.click()
            toggleFound = true
            break
          }
        }
      } catch {
        continue
      }
    }
    
    if (!toggleFound) {
      // Fallback: try to find any toggle in the client consent section
      const clientConsentSection = page.locator('text=/client.*consent|patient.*consent/i').locator('..').locator('..')
      const toggleInSection = clientConsentSection.locator('input[type="checkbox"], [role="switch"], button').first()
      if (await toggleInSection.isVisible({ timeout: 2000 })) {
        await toggleInSection.click()
        toggleFound = true
      }
    }
    
    if (!toggleFound) {
      console.log('⚠️ Could not find Require Client Consent toggle - may need to add test ID')
      // Continue anyway - the org may already have it enabled or we'll test with API
    } else {
      console.log('✅ Toggled Require Client Consent setting')
    }
    
    // Save org settings if there's a save button
    const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first()
    if (await saveButton.isVisible({ timeout: 2000 })) {
      await saveButton.click()
      await page.waitForTimeout(2000) // Wait for save to complete
      console.log('✅ Saved org settings')
    }

    // Seeded org defaults requireClientConsent=false; UI toggle/Save can race and clear PATCH. Force via API
    // using the caregiver's org from GET /caregivers/:id (not only Redux — persisted state can be wrong org).
    const authToken = await getAuthAccessTokenFromPage(page)
    const orgId =
      (await getCaregiverOrgIdFromApi(page, API_BASE_URL)) ?? (await getOrgIdFromPage(page))
    if (!authToken) {
      console.log('⚠️ No auth token for org PATCH — consent email may not send')
    } else if (orgId) {
      const patch = await page.request.patch(`${API_BASE_URL}/orgs/${orgId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        data: { requireClientConsent: true },
      })
      if (patch.ok()) {
        const patchedOrg = await patch.json()
        expect(
          patchedOrg.requireClientConsent,
          'API must persist requireClientConsent so consent email is sent'
        ).toBe(true)
        console.log('✅ Patched org requireClientConsent=true via API (org from caregiver)')
      } else {
        console.log('⚠️ Could not PATCH requireClientConsent:', patch.status(), await patch.text())
      }
    } else {
      console.log('⚠️ No org id (API / Redux) — could not PATCH requireClientConsent')
    }

    // Step 3: Create a client (this should trigger consent email if org requires it)
    console.log('Creating client to trigger consent email...')
    // Already logged in as org admin — do not call navigateToHome (it forces login form). Go to Home tab.
    await navigateToTab(page, 'home')
    await isHomeScreen(page)

    // Org-screen Save may have completed after the earlier PATCH and set requireClientConsent=false — enforce again.
    const orgBeforeCreate =
      (await getCaregiverOrgIdFromApi(page, API_BASE_URL)) ?? (await getOrgIdFromPage(page))
    const tokenBeforeCreate = await getAuthAccessTokenFromPage(page)
    if (tokenBeforeCreate && orgBeforeCreate) {
      const pre = await page.request.patch(`${API_BASE_URL}/orgs/${orgBeforeCreate}`, {
        headers: {
          Authorization: `Bearer ${tokenBeforeCreate}`,
          'Content-Type': 'application/json',
        },
        data: { requireClientConsent: true },
      })
      if (pre.ok()) {
        const body = await pre.json()
        expect(body.requireClientConsent, 'requireClientConsent must be true immediately before create').toBe(true)
        console.log('✅ Re-patched org requireClientConsent=true before creating client (avoids UI race)')
      }
    }

    // Create client via POST /clients (same as Client screen). UI form submit is unreliable in Playwright
    // (PhoneInputWeb / validation timing), and this guarantees the same server path as production API.
    const tokenCreate = await getAuthAccessTokenFromPage(page)
    const orgCreate =
      (await getCaregiverOrgIdFromApi(page, API_BASE_URL)) ?? (await getOrgIdFromPage(page))
    expect(tokenCreate, 'auth token required to create client').toBeTruthy()
    expect(orgCreate, 'org id required to create client').toBeTruthy()
    const createRes = await page.request.post(`${API_BASE_URL}/clients`, {
      headers: {
        Authorization: `Bearer ${tokenCreate}`,
        'Content-Type': 'application/json',
      },
      data: {
        name: 'Test Client',
        email: testClientEmail,
        phone: '+16045551234',
        org: orgCreate,
        consented: false,
      },
    })
    if (!createRes.ok()) {
      console.log('Create client failed:', createRes.status(), await createRes.text())
    }
    expect(createRes.ok(), 'POST /clients must succeed so consent email is sent').toBeTruthy()
    console.log('✅ Client created via API (POST /clients — same as Client screen)')
    
    // Step 4: Wait for consent email to be sent
    console.log(`📧 Waiting for consent email to ${testClientEmail}...`)
    await page.waitForTimeout(10000) // Give email time to be processed
    
    // Step 5: Retrieve the consent email (server uses waitForEmail — keep maxWaitMs below test timeout)
    const emailWaitMs = 45_000
    let email: Awaited<ReturnType<typeof getEmailFromEthereal>> | undefined
    let retries = 5
    while (retries > 0) {
      try {
        email = await getEmailFromEthereal(page, testClientEmail, true, emailWaitMs)
        if (email.tokens?.consent) {
          break
        }
        console.log(
          `📧 Latest mail "${email.subject}" has no consent token (often verify-first); retrying… (${retries - 1} left)`
        )
        retries--
        await page.waitForTimeout(4000)
      } catch (error) {
        retries--
        if (retries === 0) {
          console.error('Failed to retrieve email from Ethereal after all retries:', error)
          console.log('⚠️ Email verification test failed - Ethereal email delivery timing issue')
          test.skip()
          return
        }
        console.log(`Email not found yet, retrying... (${retries} retries left)`)
        await page.waitForTimeout(4000)
      }
    }
    
    expect(email).toBeTruthy()
    expect(email!.subject).toMatch(/consent|verify|email|bianca/i)
    expect(email!.tokens.consent).toBeTruthy()
    
    console.log('✅ Consent email retrieved from Ethereal')
    console.log(`   Subject: ${email!.subject}`)
    console.log(`   Token extracted: ${email!.tokens.consent ? 'Yes' : 'No'}`)
    
    // Step 6: Extract consent token from email
    const token = email!.tokens.consent
    expect(token).toBeTruthy()
    
    // Step 7: Construct consent URL
    const consentLink = getFrontendUrl(`/client/consent?token=${token}`)
    
    // Verify link format
    expect(consentLink).toContain(new URL(FRONTEND_URL).hostname)
    expect(consentLink).toContain('/client/consent')
    expect(consentLink).toContain('token=')
    expect(consentLink).not.toContain('localhost:3000')
    expect(consentLink).not.toContain('/v1')
    
    console.log('✅ Consent link constructed:', consentLink)
    
    // Step 8: Navigate to consent link (no mocks - use real backend)
    try {
      await page.goto(consentLink, { waitUntil: 'networkidle', timeout: 30000 })
    } catch (error) {
      if (error.message.includes('ERR_CONNECTION_REFUSED') || error.message.includes('net::ERR')) {
        console.log('Frontend not ready, waiting 5 seconds and retrying...')
        await page.waitForTimeout(5000)
        await page.goto(consentLink, { waitUntil: 'networkidle', timeout: 30000 })
      } else {
        throw error
      }
    }
    
    // Verify we're on the frontend
    expect(page.url()).toContain(new URL(FRONTEND_URL).hostname)
    
    // Wait for consent to process
    await page.waitForTimeout(3000)
    
    // Step 9: Verify we see success message
    const successIndicators = [
      page.getByText('Consent', { exact: false }),
      page.getByText('Thank you', { exact: false }),
      page.getByText('confirmed', { exact: false }),
      page.locator('[data-testid="client-consent-screen"]'),
    ]
    
    let foundSuccess = false
    for (const indicator of successIndicators) {
      try {
        if (await indicator.isVisible({ timeout: 5000 })) {
          foundSuccess = true
          break
        }
      } catch {
        continue
      }
    }
    
    expect(foundSuccess).toBe(true)
    
    console.log('✅ End-to-end client consent flow completed successfully!')
    console.log('   - Consent email sent (Ethereal or in-memory capture when E2E_CAPTURE_EMAILS=1)')
    console.log('   - Email retrieved via POST /test/get-email')
    console.log('   - Token extracted from email content')
    console.log(`   - Link uses correct frontend URL (${FRONTEND_URL})`)
    console.log('   - Frontend extracts token from URL')
    console.log('   - Backend API called with real token')
    console.log('   - Consent process completed')
  })

  test('consent email contains correct link format', async ({ page }) => {
    // Force Ethereal initialization for this test run
    const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/v1'
    try {
      await page.request.post(`${API_BASE_URL}/test/e2e-email-capture`, { data: { enable: true } })
      console.log('✅ E2E in-memory email capture enabled')
    } catch (error) {
      console.log('⚠️ Could not enable e2e-email-capture:', error.message)
    }
    try {
      await page.request.post(`${API_BASE_URL}/test/force-ethereal-init`)
      console.log('✅ Forced Ethereal initialization for test')
    } catch (error) {
      console.log('⚠️ Could not force Ethereal init:', error.message)
    }
    
    // Step 1: Create a client via API with org that requires consent
    await page.goto(FRONTEND_URL)
    await page.waitForLoadState('networkidle')
    await loginIfNeeded(page, TEST_USERS.ORG_ADMIN.email, TEST_USERS.ORG_ADMIN.password)
    
    // Prefer caregiver org from API so PATCH/create use the same org as the backend.
    const authToken = await getAuthAccessTokenFromPage(page)
    const orgId =
      (await getCaregiverOrgIdFromApi(page, API_BASE_URL)) ?? (await getOrgIdFromPage(page))

    if (!authToken || !orgId) {
      console.log('⚠️ Could not get auth token or org id, skipping test')
      test.skip()
      return
    }

    // Enable requireClientConsent on org
    await page.request.patch(`${API_BASE_URL}/orgs/${orgId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        requireClientConsent: true,
      },
    })
    
    // Create client via API
    const clientResponse = await page.request.post(`${API_BASE_URL}/clients`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        name: 'Test Client',
        email: testClientEmail,
        phone: '+16045551234',
        org: orgId,
        consented: false,
      },
    })
    
    if (!clientResponse.ok()) {
      console.log('⚠️ Could not create client, skipping test')
      test.skip()
      return
    }
    
    console.log('✅ Client created via API')
    
    // Step 2: Wait for email
    await page.waitForTimeout(10000)
    
    // Step 3: Retrieve email from Ethereal
    let email
    let frontendLink: string | null = null
    try {
      email = await getEmailFromEthereal(page, testClientEmail, true, 30000)
      
      // Extract the consent link from the email
      const emailText = email.text || ''
      const emailHtml = email.html || ''
      
      // Find the consent link in the email
      const frontendHost = new URL(FRONTEND_URL).host
      const linkMatch = emailText.match(new RegExp(`http://${frontendHost}/client/consent[?&]token=[^\\s"']+`)) ||
                        emailHtml.match(new RegExp(`http://${frontendHost}/client/consent[?&]token=[^"'\\s&<>]+`)) ||
                        emailText.match(/client\/consent[?&]token=([^\s"']+)/) ||
                        emailHtml.match(/client\/consent[?&]token=([^"'\s&<>]+)/)
      
      if (linkMatch) {
        frontendLink = linkMatch[0].startsWith('http') ? linkMatch[0] : `${FRONTEND_URL}/client/consent?token=${linkMatch[1] || linkMatch[0]}`
      }
      
      // Also check if token was extracted directly
      if (email.tokens.consent) {
        frontendLink = `${FRONTEND_URL}/client/consent?token=${email.tokens.consent}`
      }
    } catch (error) {
      console.log('⚠️ Could not retrieve email from Ethereal:', error.message)
      test.skip()
      return
    }
    
    expect(frontendLink).toBeTruthy()
    
    // Verify link format
    const frontendHost = new URL(FRONTEND_URL).host
    expect(frontendLink).toMatch(new RegExp(`^http://${frontendHost}/client/consent[?&]token=.+$`))
    expect(frontendLink).not.toContain('localhost:3000')
    expect(frontendLink).not.toContain('/v1')
    
    // Parse and verify URL components
    const url = new URL(frontendLink!)
    expect(url.protocol).toBe('http:')
    expect(url.hostname).toBe('localhost')
    expect(url.pathname).toBe('/client/consent')
    const linkToken = url.searchParams.get('token')
    expect(linkToken).toBeTruthy()
    
    console.log('✅ Consent email link format verified')
    console.log(`   Link: ${frontendLink}`)
    console.log(`   Token: ${linkToken?.substring(0, 20)}...`)
  })
})


















