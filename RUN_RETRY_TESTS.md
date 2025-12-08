# Running Retry Functionality Tests

## Backend Unit Tests

Run the following commands from the `bianca-app-backend` directory:

```bash
# 1. Test Org Model Retry Settings
yarn test tests/unit/models/org.retry.test.js

# 2. Test Conversation Model Retry Fields  
yarn test tests/unit/models/conversation.retry.test.js

# 3. Test Org Service Retry Settings
yarn test tests/unit/services/org.service.retry.test.js

# 4. Test Twilio Call Service Retry Functionality
yarn test tests/unit/services/twilioCall.service.retry.test.js

# 5. Test Agenda Retry Job
yarn test tests/unit/config/agenda.retry.test.js

# Or run all retry tests at once:
yarn test --testPathPattern="retry"
```

## Frontend Playwright Test

Run from the `bianca-app-frontend` directory:

```bash
# Set environment variable for shorter polling interval
PLAYWRIGHT_TEST=1 yarn test:e2e test/e2e/alert-polling.e2e.test.ts
```

## Test Endpoints Added

The following test endpoints were added to `/v1/test.route.js`:
- `POST /test/create-alert` - Creates alerts for testing
- `POST /test/get-caregiver-by-email` - Gets caregiver by email for testing

Make sure your backend is running in test/development mode for these endpoints to work.




