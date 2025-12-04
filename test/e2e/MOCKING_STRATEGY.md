# Mocking Strategy for E2E Tests

## Golden Rules

1. **Never mock services we own** - Use real backend with seeded database data
2. **Email uses Ethereal in tests** - Real backend sends emails via Ethereal (not mocked)
3. **Staging uses SES** - Real email service on staging (not mocked)
4. **External services can be mocked** - Stripe, OpenAI, Twilio, etc.

## Services We Own (Never Mock)

### Auth Service
- `/v1/auth/login` - Use real backend with seeded users
- `/v1/auth/logout` - Use real backend
- `/v1/auth/register` - Use real backend
- `/v1/auth/registerWithInvite` - Use real backend
- `/v1/auth/verify-email` - Use real backend
- `/v1/auth/resend-verification-email` - Use real backend

### Org Service
- `/v1/orgs/*/sendInvite` - Use real backend (sends via Ethereal in tests)
- `/v1/orgs/*/verify-invite/*` - Use real backend
- `/v1/orgs/verifyInvite*` - Use real backend

### Email Service
- Email sending should go through real backend
- In tests: Backend uses Ethereal mail
- On staging: Backend uses SES
- Never mock email sending endpoints

### Call Service
- `/v1/calls/initiate` - Use real backend
- `/v1/calls/*/status` - Use real backend

### Payment Service (Backend endpoints)
- `/v1/payment-methods/*` - Use real backend
- `/v1/payment-methods/*/set-default` - Use real backend
- `/v1/payment-methods/*/detach` - Use real backend

## External Services (OK to Mock)

### Stripe
- `/v1/stripe/publishable-key` - Can be mocked (external API)
- Stripe Elements interactions - Can be mocked

### Other External Services
- OpenAI API - Can be mocked
- Twilio API - Can be mocked
- AWS services - Can be mocked

## Files That Need Updates

### High Priority (Remove Mocks)
1. `invite-user-corrected.e2e.test.ts` - Mocks auth, email, org services
2. `helpers/emailTestHelpers.ts` - Mocks email sending (should use Ethereal)
3. `login-modal-error-display.e2e.test.ts` - Mocks auth (check if error scenarios are acceptable)
4. `conversation-message-ordering.e2e.test.ts` - Mocks call service

### Medium Priority
5. `workflow-logout.e2e.test.ts` - Mocks logout (check if error scenarios are acceptable)
6. `invite-user.e2e.test.ts` - Some error scenario mocks (review)

### Already Correct
- `invite-user.e2e.test.ts` - Uses real backend ✅
- `invite-caregiver-workflow.e2e.test.ts` - Uses real backend ✅
- `email-verification.e2e.test.ts` - Uses real backend ✅
- `payment-methods-interactions.e2e.test.ts` - Uses real backend ✅

## Error Scenario Testing

For testing error scenarios (401, 500, etc.), consider:
1. Using real backend with error endpoints (if available)
2. Configuring backend to return errors in test mode
3. Using test routes that simulate errors

Avoid mocking normal flows just to test error handling.


