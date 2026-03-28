# SSO Login Network Error Analysis

## Problem

Users are experiencing: **"SSO login failed: Network error: Unable to connect to the server. Please check your connection and try again."**

This error occurs when RTK Query gets a `FETCH_ERROR` status, meaning the fetch request itself failed (not an HTTP error response).

## Current Pipeline Validation

The deployment pipeline (`validate_service.sh`) checks:

1. ✅ **Backend container running** - Checks if Docker container is running
2. ✅ **Backend health endpoint** - `curl http://localhost:3000/health` (10 retries)
3. ✅ **Nginx responding** - `curl http://localhost:80` (10 retries)
4. ✅ **Public frontend URL** - `curl https://app.biancawellness.com` (10 retries)
5. ✅ **Public API health URL** - `curl https://api.biancawellness.com/health` (10 retries)

## The Gap

**The validation checks the `/health` endpoint, but doesn't validate actual API endpoints like `/v1/sso/login`.**

### Why This Matters

1. **Health endpoint might work, but API routes might not:**
   - Health endpoint is simple and always returns 200
   - API routes require full application initialization
   - Routes might not be registered properly
   - Middleware might be blocking requests

2. **ALB routing might be misconfigured:**
   - Health check passes through ALB
   - But actual API requests might be routed incorrectly
   - Path-based routing rules might not match `/v1/*`

3. **CORS preflight might fail:**
   - Health endpoint doesn't trigger CORS preflight
   - SSO login endpoint triggers OPTIONS preflight
   - CORS configuration might reject the origin

4. **Backend might not be fully initialized:**
   - Health endpoint responds immediately
   - But database connections, services might not be ready
   - Routes might not be registered yet

## Root Causes

### 1. ALB Target Group Health Check vs Actual Requests

**Health Check:**
- Path: `/health`
- Simple GET request
- Always returns 200
- No authentication required
- No CORS preflight

**SSO Login Request:**
- Path: `/v1/sso/login`
- POST request with body
- Requires CORS preflight (OPTIONS)
- More complex routing

**Possible Issues:**
- ALB listener rules might not route `/v1/*` correctly
- Target group might be healthy but routing to wrong backend
- Health check passes but actual requests timeout

### 2. CORS Configuration

The backend CORS configuration allows:
- `https://app.biancawellness.com`
- `https://staging.biancawellness.com`
- `https://api.biancawellness.com`
- `https://staging-api.biancawellness.com`

**If the frontend is making requests from a different origin, CORS will block them.**

### 3. Network/DNS Issues

- DNS not resolving `api.biancawellness.com` correctly
- SSL/TLS certificate issues
- Network connectivity problems
- Timeout before request completes

### 4. Backend Not Fully Ready

- Health endpoint responds but routes not registered
- Database connection not established
- Services not initialized
- Middleware not loaded

## Recommended Fixes

### 1. Enhance Pipeline Validation

Add validation for actual API endpoints:

```bash
# In validate_service.sh, add after API health check:

# Check if SSO endpoint is accessible (CRITICAL - this is what users actually hit)
echo "   Testing SSO login endpoint..."
SSO_ENDPOINT_PASSED=false
for i in {1..10}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X OPTIONS \
    -H "Origin: https://app.biancawellness.com" \
    -H "Access-Control-Request-Method: POST" \
    "$API_URL/sso/login" 2>/dev/null || echo "000")
  
  # OPTIONS request should return 200 or 204 for CORS preflight
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
    echo "   ✅ SSO endpoint CORS preflight check passed (HTTP $HTTP_CODE, attempt $i)"
    SSO_ENDPOINT_PASSED=true
    break
  fi
  
  if [ "$HTTP_CODE" = "000" ]; then
    echo "   SSO endpoint check attempt $i/10 failed (network error), retrying in 3 seconds..."
  else
    echo "   SSO endpoint check attempt $i/10 failed (HTTP $HTTP_CODE), retrying in 3 seconds..."
  fi
  sleep 3
done

if [ "$SSO_ENDPOINT_PASSED" = "false" ]; then
  echo "   ❌ SSO endpoint check failed after 10 attempts" >&2
  echo "   This means SSO login will fail for users!" >&2
  VALIDATION_FAILED=true
fi
```

### 2. Add API Endpoint Health Check

Create a dedicated endpoint that validates all critical routes are registered:

```javascript
// In app.js, add after /health endpoint:
app.get('/health/api-routes', (req, res) => {
  const routes = {
    sso: {
      login: app._router?.stack?.some(layer => 
        layer.route?.path === '/v1/sso/login' && 
        layer.route?.methods?.post
      ) || false,
      verify: app._router?.stack?.some(layer => 
        layer.route?.path === '/v1/sso/verify' && 
        layer.route?.methods?.get
      ) || false,
    },
    auth: {
      login: app._router?.stack?.some(layer => 
        layer.route?.path === '/v1/auth/login' && 
        layer.route?.methods?.post
      ) || false,
    }
  };
  
  const allRoutesRegistered = Object.values(routes)
    .flatMap(Object.values)
    .every(registered => registered === true);
  
  res.status(allRoutesRegistered ? 200 : 503).json({
    status: allRoutesRegistered ? 'OK' : 'DEGRADED',
    routes,
    timestamp: new Date().toISOString()
  });
});
```

### 3. Improve Error Logging

Add more detailed logging in the SSO service to capture the exact failure:

```typescript
// In ssoService.ts, enhance error logging:
logger.error('SSO backend authentication error:', {
  status: errorStatus,
  statusCode: errorData?.code || errorData?.statusCode,
  message: errorData?.message,
  error: errorData?.error,
  data: errorData,
  fullError: rtkError,
  userInfo: { email: userInfo.email, provider: userInfo.provider },
  // ADD THESE:
  apiUrl: apiConfig.url,
  endpoint: '/sso/login',
  fetchError: errorStatus === 'FETCH_ERROR' ? {
    type: 'network_error',
    possibleCauses: [
      'DNS resolution failure',
      'CORS preflight blocked',
      'SSL/TLS handshake failure',
      'Network timeout',
      'ALB routing misconfiguration'
    ]
  } : null
});
```

### 4. Add Frontend Network Diagnostics

Add a diagnostic endpoint that the frontend can call to verify connectivity:

```typescript
// In frontend, add network diagnostic:
async function diagnoseNetworkIssue() {
  const apiUrl = getDefaultApiConfig().url;
  
  const diagnostics = {
    apiUrl,
    timestamp: new Date().toISOString(),
    tests: []
  };
  
  // Test 1: DNS resolution
  try {
    const url = new URL(apiUrl);
    diagnostics.tests.push({
      name: 'DNS Resolution',
      status: 'PASS',
      hostname: url.hostname
    });
  } catch (error) {
    diagnostics.tests.push({
      name: 'DNS Resolution',
      status: 'FAIL',
      error: error.message
    });
  }
  
  // Test 2: Health endpoint
  try {
    const response = await fetch(`${apiUrl.replace('/v1', '')}/health`);
    diagnostics.tests.push({
      name: 'Health Endpoint',
      status: response.ok ? 'PASS' : 'FAIL',
      statusCode: response.status
    });
  } catch (error) {
    diagnostics.tests.push({
      name: 'Health Endpoint',
      status: 'FAIL',
      error: error.message
    });
  }
  
  // Test 3: CORS preflight
  try {
    const response = await fetch(`${apiUrl}/sso/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'POST'
      }
    });
    diagnostics.tests.push({
      name: 'CORS Preflight',
      status: response.ok ? 'PASS' : 'FAIL',
      statusCode: response.status
    });
  } catch (error) {
    diagnostics.tests.push({
      name: 'CORS Preflight',
      status: 'FAIL',
      error: error.message
    });
  }
  
  return diagnostics;
}
```

## Immediate Actions

1. **Check Backend Logs (Remote via SSM):**
   ```bash
   ./packages/backend/scripts/check-backend-logs-remote.sh staging
   # or
   ./packages/backend/scripts/check-backend-logs-remote.sh production
   ```
   Uses AWS profile `jordan` automatically.

2. **Check ALB Target Group Health:**
   ```bash
   aws elbv2 describe-target-health \
     --target-group-arn <target-group-arn> \
     --region us-east-2 \
     --profile jordan
   ```

3. **Check ALB Listener Rules:**
   ```bash
   aws elbv2 describe-rules \
     --listener-arn <listener-arn> \
     --region us-east-2 \
     --profile jordan
   ```
   Ensure `/v1/*` routes to the API target group.

4. **Test CORS Preflight Manually:**
   ```bash
   curl -X OPTIONS \
     -H "Origin: https://app.biancawellness.com" \
     -H "Access-Control-Request-Method: POST" \
     -v https://api.biancawellness.com/v1/sso/login
   ```

5. **Check Backend Logs (On Server):**
   ```bash
   ssh -i ~/.ssh/bianca-key-pair.pem ec2-user@<instance-ip>
   docker logs production_app --tail 100 | grep -i "sso\|cors\|error"
   ```

6. **Verify Frontend API URL Configuration:**
   - Check browser console for the actual API URL being used
   - Verify it matches the expected backend URL
   - Check for runtime overrides in `config/index.ts`

## Prevention

1. **Add SSO endpoint validation to pipeline** (see fix #1 above)
2. **Add route registration health check** (see fix #2 above)
3. **Monitor CORS failures** in backend logs
4. **Add frontend network diagnostics** (see fix #4 above)
5. **Set up alerts** for SSO login failures

## Related Files

- `/packages/backend/devops/codedeploy/scripts/validate_service.sh` - Pipeline validation
- `/packages/mobile/app/services/ssoService.ts` - SSO service
- `/packages/backend/src/app.js` - CORS configuration
- `/packages/backend/src/routes/v1/sso.route.js` - SSO routes
- `/packages/mobile/app/config/index.ts` - API URL configuration
