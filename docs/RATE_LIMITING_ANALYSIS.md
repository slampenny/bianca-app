# Rate Limiting Analysis

**Date:** January 2025  
**Current Status:** Only `/v1/auth` endpoints are rate limited (production only)

---

## Current Rate Limiting

### Auth Endpoints (`/v1/auth`)
- **Limit:** 20 requests per 15 minutes
- **Scope:** Only failed requests (skipSuccessfulRequests: true)
- **Environment:** Production only
- **Window:** 15 minutes

**Protected Endpoints:**
- POST `/v1/auth/login`
- POST `/v1/auth/register`
- POST `/v1/auth/forgot-password`
- POST `/v1/auth/reset-password`
- POST `/v1/auth/refresh-tokens`
- POST `/v1/auth/logout`
- POST `/v1/auth/send-verification-email`
- POST `/v1/auth/verify-email`

---

## Endpoints That Should Be Rate Limited

### 🔴 High Priority (Security-Critical)

#### 1. **Password Reset & Email Verification**
- **Routes:** 
  - POST `/v1/auth/forgot-password` (already limited)
  - POST `/v1/auth/reset-password` (already limited)
  - POST `/v1/auth/send-verification-email` (already limited)
  - POST `/v1/auth/verify-email` (already limited)
- **Risk:** Email spam, account enumeration, DoS
- **Recommendation:** ✅ Already protected

#### 2. **MFA Endpoints**
- **Routes:**
  - POST `/v1/mfa/enable`
  - POST `/v1/mfa/verify`
  - POST `/v1/mfa/disable`
  - POST `/v1/mfa/regenerate-backup-codes`
- **Risk:** Brute force attacks, account takeover
- **Recommendation:** 
  - **Limit:** 5 requests per 15 minutes per IP
  - **Reason:** MFA is security-critical, should be very restrictive

#### 3. **SSO Endpoints**
- **Routes:**
  - POST `/v1/sso/login`
  - POST `/v1/sso/verify`
- **Risk:** Account enumeration, DoS
- **Recommendation:**
  - **Limit:** 10 requests per 15 minutes per IP
  - **Reason:** Similar to auth endpoints

---

### 🟡 Medium Priority (Resource-Intensive)

#### 4. **Medical Analysis Endpoints**
- **Routes:**
  - POST `/v1/medical-analysis/analyze`
  - POST `/v1/medical-analysis/batch-analyze`
  - GET `/v1/medical-analysis/{id}`
- **Risk:** Resource exhaustion, cost (OpenAI API calls)
- **Recommendation:**
  - **Limit:** 20 requests per hour per user (authenticated)
  - **Limit:** 5 requests per hour per IP (unauthenticated)
  - **Reason:** Expensive operations, prevent abuse

#### 5. **Sentiment Analysis Endpoints**
- **Routes:**
  - POST `/v1/sentiment/analyze`
  - POST `/v1/sentiment/batch-analyze`
- **Risk:** Resource exhaustion, cost (OpenAI API calls)
- **Recommendation:**
  - **Limit:** 30 requests per hour per user (authenticated)
  - **Limit:** 5 requests per hour per IP (unauthenticated)
  - **Reason:** Expensive operations, prevent abuse

#### 6. **Emergency Phrase Management**
- **Routes:**
  - POST `/v1/emergency-phrases` (create)
  - POST `/v1/emergency-phrases/bulk-import`
  - PUT `/v1/emergency-phrases/{id}`
  - DELETE `/v1/emergency-phrases/{id}`
- **Risk:** Resource exhaustion, data manipulation
- **Recommendation:**
  - **Limit:** 50 requests per hour per user
  - **Reason:** Administrative operations, prevent abuse

#### 7. **File Upload Endpoints**
- **Routes:**
  - POST `/v1/caregivers/{id}/avatar` (if exists)
  - POST `/v1/patients/{id}/avatar` (if exists)
  - POST `/v1/openai/upload-debug-audio`
- **Risk:** Storage abuse, DoS
- **Recommendation:**
  - **Limit:** 10 uploads per hour per user
  - **Reason:** Storage costs, prevent abuse

---

### 🟢 Low Priority (General Protection)

#### 8. **Patient Data Endpoints**
- **Routes:**
  - GET `/v1/patients` (list)
  - GET `/v1/patients/{id}`
  - POST `/v1/patients` (create)
  - PUT `/v1/patients/{id}`
  - DELETE `/v1/patients/{id}`
- **Risk:** Data scraping, enumeration
- **Recommendation:**
  - **Limit:** 100 requests per 15 minutes per user
  - **Reason:** Normal usage protection, prevent scraping

#### 9. **Conversation Endpoints**
- **Routes:**
  - GET `/v1/conversations` (list)
  - GET `/v1/conversations/{id}`
  - POST `/v1/conversations` (create)
  - POST `/v1/conversations/{id}` (add message)
- **Risk:** Data scraping, resource exhaustion
- **Recommendation:**
  - **Limit:** 200 requests per 15 minutes per user
  - **Reason:** Normal usage protection, prevent scraping

#### 10. **Alert Endpoints**
- **Routes:**
  - GET `/v1/alerts`
  - POST `/v1/alerts`
  - PUT `/v1/alerts/{id}`
  - DELETE `/v1/alerts/{id}`
- **Risk:** Resource exhaustion
- **Recommendation:**
  - **Limit:** 100 requests per 15 minutes per user
  - **Reason:** Normal usage protection

#### 11. **Payment Endpoints**
- **Routes:**
  - GET `/v1/payments/invoices`
  - POST `/v1/payments/invoices` (create)
  - POST `/v1/payments/charge`
- **Risk:** Financial abuse, cost
- **Recommendation:**
  - **Limit:** 20 requests per hour per user
  - **Reason:** Financial operations, prevent abuse

#### 12. **Payment Method Endpoints**
- **Routes:**
  - GET `/v1/payment-methods`
  - POST `/v1/payment-methods` (attach)
  - DELETE `/v1/payment-methods/{id}` (detach)
- **Risk:** Financial abuse
- **Recommendation:**
  - **Limit:** 10 requests per hour per user
  - **Reason:** Financial operations, prevent abuse

#### 13. **Organization Management**
- **Routes:**
  - GET `/v1/orgs`
  - POST `/v1/orgs` (create)
  - PUT `/v1/orgs/{id}`
  - PATCH `/v1/orgs/{id}/invite`
- **Risk:** Resource exhaustion, abuse
- **Recommendation:**
  - **Limit:** 50 requests per 15 minutes per user
  - **Reason:** Administrative operations

#### 14. **Schedule Endpoints**
- **Routes:**
  - GET `/v1/schedules`
  - POST `/v1/schedules`
  - PUT `/v1/schedules/{id}`
  - DELETE `/v1/schedules/{id}`
- **Risk:** Resource exhaustion
- **Recommendation:**
  - **Limit:** 100 requests per 15 minutes per user
  - **Reason:** Normal usage protection

---

### ⚪ No Rate Limiting Needed

#### 15. **Read-Only Endpoints (Low Risk)**
- GET `/v1/docs` (Swagger documentation)
- GET `/v1/test/service-status` (health check)
- GET `/v1/test/active-calls` (diagnostic)

#### 16. **Webhook Endpoints**
- POST `/v1/stripe/webhook` (Stripe webhooks)
- POST `/v1/twilio/call` (Twilio webhooks)
- **Reason:** These are called by external services, not users

---

## Recommended Implementation Strategy

### Phase 1: Security-Critical (High Priority)
1. **MFA Endpoints** - 5 requests per 15 minutes
2. **SSO Endpoints** - 10 requests per 15 minutes

### Phase 2: Resource-Intensive (Medium Priority)
3. **Medical Analysis** - 20 requests per hour (authenticated)
4. **Sentiment Analysis** - 30 requests per hour (authenticated)
5. **Emergency Phrases** - 50 requests per hour
6. **File Uploads** - 10 uploads per hour

### Phase 3: General Protection (Low Priority)
7. **Patient Endpoints** - 100 requests per 15 minutes
8. **Conversation Endpoints** - 200 requests per 15 minutes
9. **Alert Endpoints** - 100 requests per 15 minutes
10. **Payment Endpoints** - 20 requests per hour
11. **Payment Method Endpoints** - 10 requests per hour
12. **Organization Endpoints** - 50 requests per 15 minutes
13. **Schedule Endpoints** - 100 requests per 15 minutes

---

## Rate Limiter Configuration

### Recommended Rate Limiter Types

```javascript
// Strict (Security-Critical)
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Moderate (Resource-Intensive)
const moderateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Generous (General Protection)
const generousLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
```

### User-Based vs IP-Based Limiting

- **IP-Based:** For unauthenticated endpoints (auth, SSO, public endpoints)
- **User-Based:** For authenticated endpoints (use user ID from JWT token)
- **Hybrid:** Use IP for unauthenticated, user ID for authenticated

---

## Implementation Notes

1. **Environment:** Apply rate limiting in all environments (not just production)
2. **Error Messages:** Use generic messages to prevent information leakage
3. **Headers:** Include rate limit headers (`X-RateLimit-*`) for API clients
4. **Whitelist:** Consider whitelisting internal IPs or service accounts
5. **Monitoring:** Log rate limit violations for security monitoring
6. **Redis:** Consider using Redis for distributed rate limiting in production

---

## Summary

**Total Endpoints to Protect:** ~13 route groups  
**Priority Breakdown:**
- 🔴 High Priority: 2 groups (MFA, SSO)
- 🟡 Medium Priority: 4 groups (Medical, Sentiment, Emergency, Uploads)
- 🟢 Low Priority: 7 groups (Patient, Conversation, Alert, Payment, etc.)

**Estimated Effort:** 1 day  
**Risk:** Low (additive change, can be rolled back easily)

