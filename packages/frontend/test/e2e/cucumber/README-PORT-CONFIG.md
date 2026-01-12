# Port Configuration for Cucumber Tests

## Centralized Configuration

The frontend port is configured in **one place** to ensure all tests use the same port:

**File:** `test/e2e/cucumber/cucumber.config.js`

```javascript
worldParameters: {
  baseURL: process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:8084',
  apiURL: process.env.API_URL || 'http://localhost:3000',
}
```

## Default Port

**Default:** `http://localhost:8084`

This is the default port used when no environment variable is set. If your frontend is running on a different port (e.g., 8082), override it with an environment variable.

## Overriding the Port

You can override the port using environment variables:

```bash
# Option 1: Use FRONTEND_URL
FRONTEND_URL=http://localhost:8082 yarn test:cucumber

# Option 2: Use BASE_URL
BASE_URL=http://localhost:8082 yarn test:cucumber
```

## Feature Files

The port specified in feature files (e.g., `Given the frontend is running on "http://localhost:8082"`) is **ignored**. 

The step definition uses the centralized configuration instead, ensuring:
- All tests use the same port
- If the port is wrong, **ALL tests fail** (not just some)
- Easy to change port for all tests by updating one config file

## Why This Matters

Before centralization:
- Port was hardcoded in 15+ feature files
- Port was also in `cucumber.config.js` and `world.js`
- If port changed, you had to update many files
- Some tests might pass if they used a different config path

After centralization:
- Port configured in ONE place (`cucumber.config.js`)
- All tests use the same port
- If port is wrong, all tests fail consistently
- Easy to override with environment variable
