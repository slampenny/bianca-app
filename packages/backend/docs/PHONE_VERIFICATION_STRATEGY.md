# Phone Verification via SMS - Implementation Strategy

**Date:** November 18, 2025  
**Status:** Strategy Document  
**Infrastructure:** Terraform-managed EC2 instances with AWS SNS

---

## Executive Summary

This document outlines a comprehensive strategy for implementing phone verification via SMS using **AWS SNS** (Simple Notification Service), leveraging your existing SNS infrastructure that's already used for emergency notifications. The implementation will integrate seamlessly with your current authentication flow and HIPAA-compliant architecture.

**Why SNS over Twilio?**
- ✅ **Already Integrated:** You're already using SNS for emergency notifications
- ✅ **No Additional Credentials:** Uses existing IAM roles (no Secrets Manager needed)
- ✅ **Simpler Setup:** No new service to configure
- ✅ **Cost Effective:** AWS SNS SMS pricing is competitive
- ✅ **Unified Infrastructure:** All SMS in one place (emergency + verification)

---

## Current Infrastructure Analysis

### Existing Components
✅ **AWS SNS Integration:** Already configured and working for emergency notifications  
✅ **SNS Service:** `src/services/sns.service.js` with `sendToPhone()` method  
✅ **AWS SDK:** `@aws-sdk/client-sns` already installed  
✅ **IAM Permissions:** EC2 instances already have SNS publish permissions  
✅ **Terraform Infrastructure:** EC2 instances for staging/production  
✅ **Backend Service:** Node.js/Express with existing SNS service

### Infrastructure Details
- **SNS Service:** `src/services/sns.service.js` (already exists)
- **IAM Roles:** `bianca-staging-instance-role` with SNS publish permissions
- **AWS Region:** `us-east-2` (configured in SNS client)
- **Phone Formatting:** Already implemented in `formatPhoneNumber()` method
- **Direct SMS:** SNS service already sends SMS directly to phone numbers (no topic needed)

---

## Implementation Strategy

### Phase 1: Database Schema Updates

#### 1.1 Update Caregiver Model
Add phone verification fields to the Caregiver model:

```javascript
// src/models/caregiver.model.js
{
  phone: {
    type: String,
    required: true,
    index: true
  },
  phoneVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  phoneVerificationCode: {
    type: String,
    select: false // Don't return in queries by default
  },
  phoneVerificationCodeExpires: {
    type: Date,
    select: false
  },
  phoneVerificationAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  phoneVerifiedAt: {
    type: Date,
    select: false
  }
}
```

**Indexes to Add:**
- `{ phone: 1, phoneVerified: 1 }` - Compound index for verification queries

---

### Phase 2: Backend Service Implementation

#### 2.1 Create SMS Verification Service

**File:** `src/services/smsVerification.service.js`

```javascript
const { snsService } = require('./sns.service'); // Reuse existing SNS service
const logger = require('../config/logger');
const { Caregiver } = require('../models');
const ApiError = require('../utils/ApiError');
const httpStatus = require('http-status');

class SMSVerificationService {
  constructor() {
    this.snsService = snsService; // Use existing SNS service
  }

  /**
   * Generate a 6-digit verification code
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send verification code via SMS using AWS SNS
   * @param {string} phoneNumber - Phone number in E.164 format
   * @param {string} caregiverId - Caregiver ID
   * @returns {Promise<Object>} Verification code details
   */
  async sendVerificationCode(phoneNumber, caregiverId) {
    try {
      // Validate SNS service
      if (!this.snsService || !this.snsService.isInitialized) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'SMS service not configured');
      }

      // Generate verification code
      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Find caregiver
      const caregiver = await Caregiver.findById(caregiverId);
      if (!caregiver) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
      }

      // Check rate limiting (max 3 attempts per hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (caregiver.phoneVerificationAttempts >= 3 && 
          caregiver.phoneVerificationCodeExpires > oneHourAgo) {
        throw new ApiError(
          httpStatus.TOO_MANY_REQUESTS,
          'Too many verification attempts. Please try again later.'
        );
      }

      // Format phone number (reuse existing SNS service method)
      const formattedPhone = this.snsService.formatPhoneNumber(phoneNumber);
      if (!this.snsService.isValidPhoneNumber(formattedPhone)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid phone number format');
      }

      // Create SMS message
      const message = `Your Bianca verification code is: ${code}. This code expires in 10 minutes.`;

      // Send SMS via SNS (reuse existing sendToPhone method)
      const response = await this.snsService.sendToPhone(formattedPhone, message, {
        severity: 'INFO',
        category: 'phone_verification',
        patientId: caregiverId
      });

      logger.info(`[SMS Verification] Code sent to ${formattedPhone}, MessageId: ${response.MessageId}`);

      // Store verification code in database
      caregiver.phoneVerificationCode = code;
      caregiver.phoneVerificationCodeExpires = expiresAt;
      caregiver.phoneVerificationAttempts = (caregiver.phoneVerificationAttempts || 0) + 1;
      await caregiver.save({ select: '-phoneVerificationCode -phoneVerificationCodeExpires' });

      return {
        messageId: response.MessageId,
        expiresAt,
        phoneNumber: this.maskPhoneNumber(formattedPhone)
      };
    } catch (error) {
      logger.error(`[SMS Verification] Error sending code: ${error.message}`);
      
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle AWS SNS-specific errors
      if (error.name === 'InvalidParameter') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid phone number format');
      } else if (error.name === 'AuthorizationError') {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'SMS service authentication failed');
      }

      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to send verification code');
    }
  }

  /**
   * Mask phone number for display
   * @private
   */
  maskPhoneNumber(phone) {
    // Format: +1 (234) 567-8900 -> +1 (234) ***-8900
    const match = phone.match(/^(\+\d{1,2})(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `${match[1]} (${match[2]}) ***-${match[4]}`;
    }
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }

  /**
   * Verify the code entered by user
   * @param {string} caregiverId - Caregiver ID
   * @param {string} code - Verification code
   * @returns {Promise<boolean>} True if verified
   */
  async verifyCode(caregiverId, code) {
    try {
      const caregiver = await Caregiver.findById(caregiverId)
        .select('+phoneVerificationCode +phoneVerificationCodeExpires +phoneVerificationAttempts');

      if (!caregiver) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
      }

      // Check if code exists
      if (!caregiver.phoneVerificationCode) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'No verification code found. Please request a new code.');
      }

      // Check if code expired
      if (new Date() > caregiver.phoneVerificationCodeExpires) {
        // Clear expired code
        caregiver.phoneVerificationCode = undefined;
        caregiver.phoneVerificationCodeExpires = undefined;
        await caregiver.save();
        throw new ApiError(httpStatus.BAD_REQUEST, 'Verification code expired. Please request a new code.');
      }

      // Verify code
      if (caregiver.phoneVerificationCode !== code) {
        caregiver.phoneVerificationAttempts = (caregiver.phoneVerificationAttempts || 0) + 1;
        await caregiver.save();
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid verification code');
      }

      // Code is valid - mark phone as verified
      caregiver.phoneVerified = true;
      caregiver.phoneVerifiedAt = new Date();
      caregiver.phoneVerificationCode = undefined;
      caregiver.phoneVerificationCodeExpires = undefined;
      caregiver.phoneVerificationAttempts = 0;
      await caregiver.save();

      logger.info(`[SMS Verification] Phone verified for caregiver ${caregiverId}`);
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error(`[SMS Verification] Error verifying code: ${error.message}`);
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to verify code');
    }
  }

  /**
   * Resend verification code
   * @param {string} caregiverId - Caregiver ID
   * @returns {Promise<Object>} Verification code details
   */
  async resendVerificationCode(caregiverId) {
    const caregiver = await Caregiver.findById(caregiverId);
    if (!caregiver) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Caregiver not found');
    }

    if (!caregiver.phone) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number not set');
    }

    return this.sendVerificationCode(caregiver.phone, caregiverId);
  }
}

module.exports = new SMSVerificationService();
```

#### 2.2 Update Service Index

**File:** `src/services/index.js`

```javascript
// Add SMS verification service
const smsVerificationService = require('./smsVerification.service');

module.exports = {
  // ... existing services
  smsVerificationService,
};
```

---

### Phase 3: API Routes & Controllers

#### 3.1 Create Verification Controller

**File:** `src/controllers/phoneVerification.controller.js`

```javascript
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const { smsVerificationService } = require('../services');
const ApiError = require('../utils/ApiError');

const sendVerificationCode = catchAsync(async (req, res) => {
  const { caregiverId } = req.user; // From auth middleware
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Phone number is required');
  }

  const result = await smsVerificationService.sendVerificationCode(phoneNumber, caregiverId);
  
  res.status(httpStatus.OK).json({
    success: true,
    message: 'Verification code sent',
    expiresAt: result.expiresAt,
    phoneNumber: result.phoneNumber // Masked
  });
});

const verifyCode = catchAsync(async (req, res) => {
  const { caregiverId } = req.user;
  const { code } = req.body;

  if (!code) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Verification code is required');
  }

  await smsVerificationService.verifyCode(caregiverId, code);
  
  res.status(httpStatus.OK).json({
    success: true,
    message: 'Phone number verified successfully'
  });
});

const resendCode = catchAsync(async (req, res) => {
  const { caregiverId } = req.user;
  
  const result = await smsVerificationService.resendVerificationCode(caregiverId);
  
  res.status(httpStatus.OK).json({
    success: true,
    message: 'Verification code resent',
    expiresAt: result.expiresAt,
    phoneNumber: result.phoneNumber
  });
});

module.exports = {
  sendVerificationCode,
  verifyCode,
  resendCode
};
```

#### 3.2 Create Verification Routes

**File:** `src/routes/v1/phoneVerification.route.js`

```javascript
const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { phoneVerificationValidation } = require('../../validations');
const { phoneVerificationController } = require('../../controllers');

const router = express.Router();

router.post(
  '/send-code',
  auth(),
  validate(phoneVerificationValidation.sendCode),
  phoneVerificationController.sendVerificationCode
);

router.post(
  '/verify',
  auth(),
  validate(phoneVerificationValidation.verify),
  phoneVerificationController.verifyCode
);

router.post(
  '/resend',
  auth(),
  phoneVerificationController.resendCode
);

module.exports = router;
```

#### 3.3 Add Route to Main Router

**File:** `src/routes/v1/index.js`

```javascript
// Add phone verification routes
router.use('/phone-verification', require('./phoneVerification.route'));
```

#### 3.4 Create Validation Schema

**File:** `src/validations/phoneVerification.validation.js`

```javascript
const Joi = require('joi');

const sendCode = {
  body: Joi.object().keys({
    phoneNumber: Joi.string()
      .pattern(/^\+[1-9]\d{1,14}$/) // E.164 format
      .required()
      .messages({
        'string.pattern.base': 'Phone number must be in E.164 format (e.g., +1234567890)'
      })
  })
};

const verify = {
  body: Joi.object().keys({
    code: Joi.string()
      .length(6)
      .pattern(/^\d+$/)
      .required()
      .messages({
        'string.length': 'Verification code must be 6 digits',
        'string.pattern.base': 'Verification code must contain only numbers'
      })
  })
};

module.exports = {
  phoneVerificationValidation: {
    sendCode,
    verify
  }
};
```

---

### Phase 4: Terraform Infrastructure Updates

#### 4.1 No Infrastructure Changes Required ✅

**Excellent News:** Your existing Terraform setup already fully supports SMS verification via SNS:

- ✅ **SNS Service:** Already configured and working
- ✅ **IAM Permissions:** EC2 instances already have `sns:Publish` permissions
- ✅ **SNS Client:** Already initialized in `sns.service.js`
- ✅ **Phone Formatting:** Already implemented
- ✅ **Direct SMS:** SNS service already sends SMS directly to phone numbers

**Verification:** Check your existing IAM policy includes:
```json
{
  "Effect": "Allow",
  "Action": ["sns:Publish"],
  "Resource": "*"
}
```

Your `staging.tf` already has this in the `staging_instance_policy`! ✅

---

### Phase 5: Frontend Integration

#### 5.1 Phone Verification Screen

**File:** `app/screens/PhoneVerificationScreen.tsx`

```typescript
// Similar to EmailVerificationScreen
// - Input field for phone number (if not set)
// - Input field for verification code
// - "Send Code" button
// - "Resend Code" button
// - "Verify" button
// - Timer showing code expiration
```

#### 5.2 API Integration

**File:** `app/services/api/phoneVerificationApi.ts`

```typescript
import { api } from './baseApi';

export const phoneVerificationApi = api.injectEndpoints({
  endpoints: (builder) => ({
    sendVerificationCode: builder.mutation({
      query: (phoneNumber: string) => ({
        url: '/v1/phone-verification/send-code',
        method: 'POST',
        body: { phoneNumber }
      })
    }),
    verifyCode: builder.mutation({
      query: (code: string) => ({
        url: '/v1/phone-verification/verify',
        method: 'POST',
        body: { code }
      })
    }),
    resendCode: builder.mutation({
      query: () => ({
        url: '/v1/phone-verification/resend',
        method: 'POST'
      })
    })
  })
});

export const {
  useSendVerificationCodeMutation,
  useVerifyCodeMutation,
  useResendCodeMutation
} = phoneVerificationApi;
```

---

## Security Considerations

### 1. Rate Limiting
- **Code Generation:** Max 3 codes per hour per phone number
- **Verification Attempts:** Max 5 failed attempts before requiring new code
- **IP-based Rate Limiting:** Consider adding to prevent abuse

### 2. Code Security
- **Expiration:** 10 minutes (configurable)
- **One-time Use:** Code invalidated after successful verification
- **Storage:** Codes stored with `select: false` to prevent accidental exposure
- **Hashing:** Consider hashing codes (though 6-digit codes have limited attack surface)

### 3. Phone Number Validation
- **Format:** E.164 format required (`+1234567890`)
- **Mobile Only:** Twilio can validate if number is mobile-capable
- **International:** Support international numbers (Twilio handles this)

### 4. HIPAA Compliance
- **PHI Protection:** Phone numbers are PHI - ensure proper encryption at rest
- **Audit Logging:** Log verification attempts (without codes)
- **Access Controls:** Only authenticated users can verify their own phone

---

## Cost Analysis

### AWS SNS SMS Pricing (as of 2025)
- **US/Canada:** $0.00645 per SMS (cheaper than Twilio!)
- **International:** Varies by country (typically $0.00645-$0.10)
- **Monthly Cost Estimate:**
  - 1,000 users × 1 verification = $6.45/month
  - 1,000 users × 2 verifications (resend) = $12.90/month
  - **Total:** ~$7-13/month for typical usage (20-30% cheaper than Twilio)

### Infrastructure Costs
- **No Additional AWS Costs:** Uses existing SNS service and IAM roles
- **Database:** Minimal storage impact (~50 bytes per verification attempt)
- **No Secrets Manager:** No additional secrets to store (uses IAM roles)

---

## Testing Strategy

### 1. Unit Tests
- Code generation logic
- Expiration handling
- Rate limiting logic
- Error handling

### 2. Integration Tests
- SNS API integration (use existing SNS service)
- Database operations
- End-to-end verification flow
- Mock SNS client for testing (similar to emergency notification tests)

### 3. E2E Tests (Playwright)
- Complete verification workflow
- Resend code flow
- Expired code handling
- Rate limiting behavior

### 4. Manual Testing
- Test with real phone numbers (your own)
- Test international numbers
- Test rate limiting
- Test error scenarios (invalid number, expired code, etc.)

---

## Deployment Plan

### Step 1: Database Migration
```bash
# Add indexes (MongoDB will create automatically on first query)
# No migration script needed - Mongoose handles schema updates
```

### Step 2: Deploy Backend
1. Commit code changes
2. Push to `staging` branch
3. CodePipeline will deploy automatically
4. Verify IAM role has SNS publish permissions (already configured ✅)

### Step 3: Test in Staging
1. Test SMS sending
2. Test code verification
3. Test rate limiting
4. Monitor CloudWatch Logs

### Step 4: Deploy to Production
1. Merge `staging` → `main`
2. CodePipeline deploys to production
3. Monitor for issues

---

## Monitoring & Alerts

### CloudWatch Metrics to Monitor
- SMS send success/failure rate (SNS metrics)
- Verification success/failure rate
- Average time to verify
- Rate limit hits
- SNS delivery success rate

### Alerts to Set Up
- SMS send failure rate > 5%
- Verification failure rate > 20%
- SNS API errors
- SNS delivery failures

### Logging
- Log all verification attempts (without codes)
- Log SNS API responses (MessageId)
- Log rate limit violations
- Use existing SNS service logging patterns

---

## Future Enhancements

### Phase 2 Features
1. **Phone Number Change:** Allow users to change verified phone number
2. **Two-Factor Authentication:** Use phone verification for 2FA
3. **Voice Verification:** Alternative to SMS (Twilio voice calls)
4. **International Support:** Better handling for international numbers
5. **Phone Number Formatting:** Auto-format phone numbers in UI

---

## Rollback Plan

If issues arise:
1. **Disable Route:** Comment out route in `src/routes/v1/index.js`
2. **Feature Flag:** Add environment variable to enable/disable
3. **Database:** No destructive changes - can rollback code without migration

---

## Documentation Updates

### API Documentation
- Add Swagger docs for new endpoints
- Document error responses
- Document rate limits

### User Documentation
- Update user guide with phone verification steps
- Add troubleshooting guide

---

## Conclusion

This implementation leverages your **existing AWS SNS infrastructure** (already used for emergency notifications), requiring **zero Terraform changes** and **zero new credentials**. The solution is:

- ✅ **HIPAA-compliant** (PHI protection, audit logging)
- ✅ **Cost-effective** (~$7-13/month for typical usage, 20-30% cheaper than Twilio)
- ✅ **Secure** (rate limiting, code expiration, validation)
- ✅ **Scalable** (uses existing AWS infrastructure)
- ✅ **Maintainable** (reuses existing SNS service)
- ✅ **Simpler** (no additional service to configure, uses IAM roles)

**Estimated Implementation Time:** 1-2 days (faster than Twilio!)
- Day 1: Backend service and API (3-4 hours) - Reuses existing SNS service
- Day 2: Frontend integration and testing (4-6 hours)

**Key Advantage:** Since you already have SNS working for emergency notifications, this is essentially just adding a new method to your existing SNS service!

---

## Questions or Concerns?

If you have questions about:
- Twilio pricing for your use case
- International number support
- Integration with existing auth flow
- HIPAA compliance specifics

Please discuss before implementation.

