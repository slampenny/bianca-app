# AWS SNS SMS Quota Increase Response

## Response to Case 176249050800698

**Company name:** Bianca Technologies

**Company URL:** https://biancatechnologies.com

**SMS Service use-case information:**

**SMS service or program name:** MyPhoneFriend Emergency Alerts

**Company relationship to the SMS service:** MyPhoneFriend is a HIPAA-compliant healthcare communication platform developed by Bianca Technologies. The SMS service sends emergency alerts to designated caregivers when patients using the MyPhoneFriend app express urgent medical needs or emergency situations during wellness check calls. The service enables rapid caregiver response to critical patient situations.

**SMS service or program website URL:** https://app.biancawellness.com

**Service opt-in location and process:** 
Caregivers opt-in to receive emergency SMS alerts through the MyPhoneFriend mobile application (iOS/Android) or web application. During patient setup, caregivers provide their phone numbers and explicitly consent to receive emergency notifications. Opt-in is managed through the app's caregiver management interface at https://app.biancawellness.com.

**SMS service or program desired launch date:** 
Currently in production. Service has been operational and we are requesting quota increase to support growing user base.

**Origination identity to be used:** 
Long Code (US phone number) via AWS SNS

**Is the identity currently registered or unregistered:** 
Currently registered and in use. We are using AWS SNS for SMS delivery and requesting a quota increase to support our growing user base.

**Specific destination country/countries:** 
United States (US)

**Message Type:** 
Transactional

**Message Templates to be sent:**

1. **CRITICAL Emergency Alert:**
   "🚨 CRITICAL EMERGENCY: {patientName} - {category}: {phrase}. Immediate attention required. Timestamp: {timestamp}"

2. **HIGH Priority Alert:**
   "⚠️ HIGH PRIORITY: {patientName} - {category}: {phrase}. Please respond promptly. Timestamp: {timestamp}"

3. **MEDIUM Priority Alert:**
   "📢 ALERT: {patientName} - {category}: {phrase}. Please review when available. Timestamp: {timestamp}"

**URL(s) that will be present in your messages:** 
https://app.biancawellness.com

**Domain relationship explanation:**
The AWS account is registered under Bianca Technologies (biancatechnologies.com). The service URL (app.biancawellness.com) is a subdomain used for the MyPhoneFriend application, which is a product/service offered by Bianca Technologies. Both domains are owned and operated by the same company.

---

## Additional Context

**Use Case Details:**
- Healthcare emergency notification system
- HIPAA-compliant patient care communication
- Real-time alerts triggered by AI-powered emergency detection during patient wellness calls
- Messages sent only to pre-authorized caregivers who have opted in
- Transactional messages only - no promotional content
- Messages include patient name, emergency category, detected phrase, and timestamp
- All messages are time-sensitive and critical for patient safety
- Currently using AWS SNS for SMS delivery

**Compliance:**
- HIPAA-compliant healthcare communication platform
- All caregivers must opt-in and provide consent
- Patient information is handled according to HIPAA regulations
- Messages are sent only for genuine emergency situations detected during patient interactions

**Current Implementation:**
- Using AWS SNS (Simple Notification Service) for SMS delivery
- Sending SMS directly to phone numbers via SNS Publish API
- IAM policies configured for ECS task role to publish SMS messages
- Region: us-east-2

