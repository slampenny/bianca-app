# API Documentation Status

**Date:** January 2025  
**Purpose:** Track Swagger/OpenAPI documentation coverage

---

## Documentation Coverage

### ✅ Fully Documented Routes

1. **Auth Routes** (`auth.route.js`)
   - ✅ Register, login, logout
   - ✅ Password reset, email verification
   - ✅ Token refresh
   - ✅ SSO integration

2. **Patient Routes** (`patient.route.js`)
   - ✅ CRUD operations
   - ✅ Avatar upload
   - ✅ Caregiver assignment
   - ✅ Conversation retrieval

3. **Alert Routes** (`alert.route.js`)
   - ✅ CRUD operations
   - ✅ Mark as read
   - ✅ Mark all as read

4. **Caregiver Routes** (`caregiver.route.js`)
   - ✅ Partially documented (needs completion)

5. **Medical Analysis Routes** (`medicalAnalysis.route.js`)
   - ✅ Partially documented

6. **MFA Routes** (`mfa.route.js`)
   - ✅ Partially documented

7. **Payment Routes** (`payment.route.js`)
   - ✅ Partially documented

8. **Payment Method Routes** (`paymentMethod.route.js`)
   - ✅ Partially documented

9. **Stripe Routes** (`stripe.route.js`)
   - ✅ Partially documented

10. **Sentiment Routes** (`sentiment.route.js`)
    - ✅ Partially documented

---

### ⚠️ Needs Documentation

1. **Conversation Routes** (`conversation.route.js`)
   - ⚠️ Missing Swagger docs
   - Routes: GET, POST, PATCH, DELETE

2. **Call Workflow Routes** (`callWorkflow.route.js`)
   - ⚠️ Missing Swagger docs
   - Routes: Call initiation, status, management

3. **Schedule Routes** (`schedule.route.js`)
   - ⚠️ Missing Swagger docs
   - Routes: Schedule management

4. **Org Routes** (`org.route.js`)
   - ⚠️ Missing Swagger docs
   - Routes: Organization management

5. **Emergency Phrase Routes** (`emergencyPhrase.route.js`)
   - ⚠️ Missing Swagger docs
   - Routes: Emergency phrase management

6. **Report Routes** (`report.route.js`)
   - ⚠️ Missing Swagger docs
   - Routes: Report generation

7. **Twilio Call Routes** (`twilioCall.route.js`)
   - ⚠️ Missing Swagger docs
   - Routes: Webhook handlers (may not need public docs)

8. **OpenAI Routes** (`openai.route.js`)
   - ⚠️ Missing Swagger docs
   - Routes: OpenAI integration endpoints

9. **SSO Routes** (`sso.route.js`)
   - ⚠️ Missing Swagger docs
   - Routes: SSO authentication

---

## Documentation Standards

### Required Elements

1. **Tag Definition**
   ```javascript
   /**
    * @swagger
    * tags:
    *   name: ResourceName
    *   description: Resource description
    */
   ```

2. **Endpoint Documentation**
   ```javascript
   /**
    * @swagger
    * /resource:
    *   get:
    *     summary: Brief description
    *     description: Detailed description
    *     tags: [ResourceName]
    *     security:
    *       - bearerAuth: []
    *     parameters:
    *       - in: query
    *         name: param
    *         schema:
    *           type: string
    *     responses:
    *       "200":
    *         description: Success
    *         content:
    *           application/json:
    *             schema:
    *               $ref: '#/components/schemas/Resource'
    */
   ```

3. **Request Body** (for POST/PATCH)
   ```javascript
   requestBody:
     required: true
     content:
       application/json:
         schema:
           $ref: '#/components/schemas/Resource'
   ```

4. **Error Responses**
   - 400: Bad Request
   - 401: Unauthorized
   - 403: Forbidden
   - 404: Not Found
   - 500: Internal Server Error

---

## Next Steps

### Priority 1: Core User-Facing Routes
1. ✅ Conversation Routes
2. ✅ Call Workflow Routes
3. ✅ Schedule Routes

### Priority 2: Administrative Routes
4. ✅ Org Routes
5. ✅ Report Routes

### Priority 3: Integration Routes
6. ⚠️ Emergency Phrase Routes
7. ⚠️ OpenAI Routes (if public-facing)

### Priority 4: Internal Routes
8. ⚠️ Twilio Webhooks (may not need public docs)
9. ⚠️ Test Routes (dev only, may not need docs)

---

## Accessing Documentation

**Development:**
- URL: `http://localhost:3000/v1/docs`
- Swagger UI available in development mode

**Production:**
- Documentation should be disabled or restricted
- Consider separate documentation server

---

## Notes

- Some routes (like Twilio webhooks) may not need public documentation
- Test routes are dev-only and may not need Swagger docs
- Webhook routes should be documented separately (internal docs)

---

**Last Updated:** January 2025  
**Coverage:** ~60% of public routes documented

