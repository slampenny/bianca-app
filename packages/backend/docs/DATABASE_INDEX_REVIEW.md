# Database Index Review & Recommendations

**Date:** January 2025  
**Purpose:** Optimize database queries with proper indexes

---

## Current Index Status

### ✅ Well-Indexed Models

**EmergencyPhrase:**
- `phrase` (single)
- `language` (single)
- `severity` (single)
- `category` (single)
- `isActive` (single)
- `{ language, isActive }` (compound)
- `{ severity, category, isActive }` (compound)
- `{ createdBy, language }` (compound)

**AuditLog:**
- `userId` (single)
- `timestamp` (single, TTL)
- `action` (single)
- `resource` (single)
- `resourceId` (single)
- `outcome` (single)
- `{ userId, timestamp }` (compound)
- `{ resource, resourceId, timestamp }` (compound)
- `{ action, outcome, timestamp }` (compound)
- `{ 'complianceFlags.requiresReview', timestamp }` (compound)

**MedicalAnalysis:**
- `patientId` (single)
- `analysisDate` (single)
- `{ patientId, analysisDate }` (compound)
- `{ patientId, timeRange, startDate }` (compound)
- `{ 'cognitiveMetrics.riskScore' }` (compound)
- `{ 'psychiatricMetrics.overallRiskScore' }` (compound)
- `{ 'psychiatricMetrics.crisisIndicators.hasCrisisIndicators' }` (compound)
- `confidence` (single)

**MedicalBaseline:**
- `patientId` (single)
- `{ patientId, status }` (compound)
- `{ patientId, type, lastUpdated }` (compound)
- `establishedDate` (single)

**BreachLog:**
- `detectedAt` (single)
- `status` (single)
- `severity` (single)
- `userId` (single)
- `{ status, severity }` (compound)
- `{ userId, detectedAt }` (compound)
- `{ requiresHHSNotification, hhsNotified }` (compound)

---

## ⚠️ Missing Indexes (Recommended)

### 1. Patient Model

**Current Indexes:**
- `email` (unique)

**Missing Indexes:**
```javascript
// Common queries: find by org, find by caregiver
patientSchema.index({ org: 1 });
patientSchema.index({ caregivers: 1 }); // Array index
patientSchema.index({ org: 1, createdAt: -1 }); // For org patient lists
patientSchema.index({ name: 1 }); // For name searches (if implemented)
```

**Query Patterns:**
- `Patient.find({ org: orgId })` - Used in payment service
- `Patient.find({ caregivers: caregiverId })` - Used in alert service
- `Patient.paginate({ org: orgId })` - Common pagination pattern

---

### 2. Conversation Model

**Current Indexes:**
- `callSid` (single)
- `conversationId` (in Message schema)

**Missing Indexes:**
```javascript
// Critical for billing and queries
conversationSchema.index({ patientId: 1 });
conversationSchema.index({ lineItemId: 1 }); // For billing queries
conversationSchema.index({ patientId: 1, lineItemId: 1 }); // Compound for uncharged queries
conversationSchema.index({ patientId: 1, startTime: -1 }); // For patient conversation history
conversationSchema.index({ status: 1, startTime: -1 }); // For status-based queries
conversationSchema.index({ org: 1, startTime: -1 }); // If org field exists
```

**Query Patterns:**
- `Conversation.find({ patientId, lineItemId: null })` - **CRITICAL** - Used in payment service
- `Conversation.paginate({ patientId })` - Used in conversation service
- `Conversation.findOne({ callSid })` - Already indexed ✅

---

### 3. Invoice Model

**Current Indexes:**
- `invoiceNumber` (unique)

**Missing Indexes:**
```javascript
invoiceSchema.index({ org: 1 });
invoiceSchema.index({ org: 1, createdAt: -1 }); // For org invoice lists
invoiceSchema.index({ status: 1, createdAt: -1 }); // For status filtering
```

**Query Patterns:**
- `Invoice.findOne({}, {}, { sort: { createdAt: -1 } })` - Used in payment service
- `Invoice.find({ org: orgId })` - Likely used in invoice listing

---

### 4. LineItem Model

**Missing Indexes:**
```javascript
lineItemSchema.index({ patientId: 1 });
lineItemSchema.index({ invoiceId: 1 });
lineItemSchema.index({ patientId: 1, invoiceId: 1 }); // Compound
```

**Query Patterns:**
- `Invoice.populate('lineItems')` - Uses invoiceId lookup

---

### 5. Caregiver Model

**Current Indexes:**
- `email` (unique)

**Missing Indexes:**
```javascript
caregiverSchema.index({ org: 1 });
caregiverSchema.index({ role: 1 }); // For role-based queries
caregiverSchema.index({ org: 1, role: 1 }); // Compound
caregiverSchema.index({ patients: 1 }); // Array index for patient lookups
```

**Query Patterns:**
- `Caregiver.find({ org: orgId })` - Common query
- `Caregiver.find({ patients: patientId })` - Used in alert service

---

### 6. PaymentMethod Model

**Current Indexes:**
- `stripePaymentMethodId` (unique)

**Missing Indexes:**
```javascript
paymentMethodSchema.index({ org: 1 });
paymentMethodSchema.index({ org: 1, isDefault: 1 }); // For default payment method lookup
paymentMethodSchema.index({ org: 1, isDefault: -1, createdAt: -1 }); // For sorted queries
```

**Query Patterns:**
- `PaymentMethod.find({ org: orgId }).sort({ isDefault: -1, createdAt: -1 })` - Used in payment method service
- `PaymentMethod.findOne({ org: orgId, isDefault: true })` - Used in payment method service

---

### 7. Alert Model

**Current Indexes:**
- `{ createdBy: 1, visibility: 1 }` (compound)

**Missing Indexes:**
```javascript
alertSchema.index({ createdBy: 1 });
alertSchema.index({ relevanceUntil: 1 }); // For relevance filtering
alertSchema.index({ createdBy: 1, relevanceUntil: 1 }); // Compound for alert queries
alertSchema.index({ readBy: 1 }); // For read status queries
alertSchema.index({ createdAt: -1 }); // For sorting
```

**Query Patterns:**
- `Alert.find({ createdBy: { $in: [...] }, relevanceUntil: { $gte: new Date() } })` - Complex query in alert service
- `Alert.find({ readBy: { $not: { $elemMatch: { $eq: caregiverId } } } })` - Read status filtering

---

### 8. Schedule Model

**Missing Indexes:**
```javascript
scheduleSchema.index({ patientId: 1 });
scheduleSchema.index({ caregiverId: 1 });
scheduleSchema.index({ patientId: 1, nextRun: 1 }); // For scheduled runs
scheduleSchema.index({ status: 1, nextRun: 1 }); // For active schedules
```

---

### 9. Call Model

**Missing Indexes:**
```javascript
callSchema.index({ patientId: 1 });
callSchema.index({ caregiverId: 1 });
callSchema.index({ status: 1, createdAt: -1 });
callSchema.index({ twilioCallSid: 1 }); // If exists
```

---

## Priority Recommendations

### 🔴 High Priority (Add Immediately)

1. **Conversation Model:**
   - `{ patientId: 1, lineItemId: 1 }` - **CRITICAL** for billing queries
   - `{ patientId: 1, startTime: -1 }` - For conversation history

2. **PaymentMethod Model:**
   - `{ org: 1, isDefault: 1 }` - For default payment method lookup

3. **Patient Model:**
   - `{ org: 1 }` - For org patient lists

### 🟡 Medium Priority (Add Soon)

4. **Invoice Model:**
   - `{ org: 1, createdAt: -1 }` - For invoice listing

5. **Alert Model:**
   - `{ createdBy: 1, relevanceUntil: 1 }` - For alert queries

6. **Caregiver Model:**
   - `{ org: 1 }` - For org caregiver lists

### 🟢 Low Priority (Nice to Have)

7. **Schedule Model:**
   - `{ patientId: 1, nextRun: 1 }` - For scheduled runs

8. **LineItem Model:**
   - `{ patientId: 1, invoiceId: 1 }` - For invoice line items

---

## Implementation Notes

### Index Creation

Indexes can be added to schemas without downtime:
```javascript
// Add to schema definition
conversationSchema.index({ patientId: 1, lineItemId: 1 });
conversationSchema.index({ patientId: 1, startTime: -1 });
```

### Background Index Creation

For existing collections, create indexes in the background:
```javascript
// In MongoDB shell or migration script
db.conversations.createIndex(
  { patientId: 1, lineItemId: 1 },
  { background: true }
);
```

### Monitoring

After adding indexes:
1. Monitor query performance (explain plans)
2. Check index usage (`db.collection.getIndexes()`)
3. Monitor index size (should be reasonable)

---

## Expected Performance Impact

- **Billing Queries:** 10-100x faster (currently scanning all conversations)
- **Patient Conversation History:** 5-50x faster
- **Alert Queries:** 2-10x faster
- **Payment Method Lookups:** 5-20x faster

---

**Status:** Ready for implementation  
**Next Steps:** Add high-priority indexes to models

