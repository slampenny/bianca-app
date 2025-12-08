# Billing System Documentation

> Automated billing system for healthcare communication platform

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Cost Calculation](#cost-calculation)
- [Daily Billing Process](#daily-billing-process)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Error Handling](#error-handling)
- [Alert System](#alert-system)
- [Testing](#testing)
- [Deployment](#deployment)

## 🎯 Overview

The billing system automatically calculates and charges for healthcare communication services based on call duration and usage. It processes daily billing cycles, creates invoices, and handles payment processing with comprehensive error handling and alerting.

### Key Features

- **Automated Cost Calculation**: Real-time cost calculation after each call
- **Daily Billing Cycles**: Automated daily processing via Agenda.js scheduler
- **Invoice Generation**: Automatic invoice creation with patient-based line items
- **Payment Processing**: Integration with payment methods and charging
- **Alert System**: Notifications for billing issues and payment failures
- **Double-Billing Prevention**: Race condition protection and transaction safety
- **Multi-Organization Support**: Organization-based billing and invoicing

## 🏗️ Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Call System   │───▶│  Cost Calculator │───▶│  Conversation   │
│  (TwilioCall)   │    │  (TwilioCall)    │    │    Model        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Daily Billing  │◀───│   Agenda.js     │───▶│   Alert System  │
│   Processor     │    │   Scheduler     │    │   (Alerts)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Invoice       │───▶│   Line Items    │───▶│  Payment        │
│   Creation      │    │   (Patient)     │    │  Processing     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Data Flow

1. **Call Completion** → Cost calculation and storage
2. **Daily Scheduler** → Processes unbilled conversations
3. **Invoice Generation** → Creates invoices with line items
4. **Payment Processing** → Charges payment methods
5. **Alert Creation** → Notifies of issues or failures

## 💰 Cost Calculation

### Formula

```javascript
cost = Math.max(duration, minimumBillableDuration) / 60 * ratePerMinute
```

### Parameters

- **`duration`**: Call duration in seconds
- **`minimumBillableDuration`**: Minimum billable duration (default: 30 seconds)
- **`ratePerMinute`**: Billing rate per minute (default: $0.10)

### Examples

| Call Duration | Billable Duration | Rate/Min | Total Cost |
|---------------|-------------------|----------|------------|
| 15 seconds    | 30 seconds        | $0.10    | $0.05      |
| 2 minutes     | 2 minutes         | $0.10    | $0.20      |
| 0 seconds     | 30 seconds        | $0.10    | $0.05      |
| 30 minutes    | 30 minutes        | $0.10    | $3.00      |

### Implementation

```javascript
// In TwilioCallService
calculateCallCost(duration) {
  const minimumBillableDuration = config.billing.minimumBillableDuration || 30;
  const billableDuration = Math.max(duration, minimumBillableDuration);
  const totalMinutes = billableDuration / 60;
  return totalMinutes * config.billing.ratePerMinute;
}
```

## ⏰ Daily Billing Process

### Scheduler Configuration

- **Frequency**: Daily at configurable time (default: 2:00 AM)
- **Scheduler**: Agenda.js with MongoDB job storage
- **Concurrency**: Single instance to prevent race conditions
- **Lock Lifetime**: 30 minutes for job execution

### Process Flow

1. **Organization Processing**
   - Find all organizations
   - Process each organization independently
   - Continue processing even if one organization fails

2. **Unbilled Conversation Detection**
   - Find conversations with `lineItemId: null`
   - Filter by date range (last 24 hours)
   - Exclude zero-cost conversations
   - Group by patient within organization

3. **Invoice Creation**
   - Generate unique invoice number (INV-XXXXXX)
   - Create invoice with organization details
   - Set issue date and due date (30 days)

4. **Line Item Generation**
   - Create one line item per patient
   - Include conversation count and total cost
   - Link conversations to line items

5. **Payment Processing**
   - Attempt to charge payment method
   - Handle payment failures gracefully
   - Create alerts for issues

### Race Condition Protection

```javascript
// Double-check conversations are still unbilled
const stillUnbilledConversations = await Conversation.find({
  _id: { $in: unbilledConversations.map(c => c._id) },
  lineItemId: null
});

if (stillUnbilledConversations.length !== unbilledConversations.length) {
  logger.warn('Some conversations were already billed, skipping');
  return;
}
```

## 🗄️ Database Schema

### Conversation Model

```javascript
{
  // ... existing fields
  cost: {
    type: Number,
    default: 0,
    min: [0, 'Cost cannot be negative']
  },
  lineItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LineItem',
    default: null
  }
}
```

### Invoice Model

```javascript
{
  org: { type: ObjectId, ref: 'Org', required: true },
  invoiceNumber: { type: String, required: true, unique: true },
  issueDate: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' },
  totalAmount: { type: Number, required: true },
  notes: String,
  lineItems: [{ type: ObjectId, ref: 'LineItem' }]
}
```

### LineItem Model

```javascript
{
  patientId: { type: ObjectId, ref: 'Patient', required: true },
  invoiceId: { type: ObjectId, ref: 'Invoice', required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true }
}
```

## 🔌 API Endpoints

### Unbilled Costs

```http
GET /v1/payments/orgs/:orgId/unbilled-costs
```

**Parameters:**
- `orgId` (path): Organization ID
- `days` (query): Number of days to look back (default: 7)

**Response:**
```json
{
  "orgId": "64f1a2b3c4d5e6f7g8h9i0j1",
  "orgName": "Healthcare Org",
  "totalUnbilledCost": 15.50,
  "patientCosts": [
    {
      "patientId": "64f1a2b3c4d5e6f7g8h9i0j2",
      "patientName": "John Doe",
      "conversationCount": 5,
      "totalCost": 8.25,
      "conversations": [...]
    }
  ],
  "period": {
    "days": 7,
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-01-08T00:00:00.000Z"
  }
}
```

### Manual Invoice Creation

```http
POST /v1/payments/patients/:patientId/invoices
```

**Response:**
```json
{
  "org": "64f1a2b3c4d5e6f7g8h9i0j1",
  "invoiceNumber": "INV-000001",
  "issueDate": "2024-01-08T00:00:00.000Z",
  "dueDate": "2024-02-07T00:00:00.000Z",
  "status": "pending",
  "totalAmount": 8.25,
  "notes": "Billing for 495 seconds",
  "lineItems": [...]
}
```

### Invoice Listing

```http
GET /v1/payments/orgs/:orgId/invoices
```

**Query Parameters:**
- `status`: Filter by invoice status
- `dueDate`: Filter by due date

### Patient Invoices

```http
GET /v1/payments/patients/:patientId/invoices
```

## ⚙️ Configuration

### Billing Configuration

```javascript
// config/config.js
billing: {
  ratePerMinute: 0.1,                    // $0.10 per minute
  minimumBillableDuration: 30,           // 30 seconds minimum
  enableDailyBilling: true,              // Enable automatic billing
  billingTime: '02:00',                  // 2:00 AM daily
  autoCharge: true,                      // Automatically charge payments
  gracePeriodDays: 30                    // 30 days payment grace period
}
```

### Environment Variables

```bash
# Billing Configuration
BILLING_RATE_PER_MINUTE=0.1
BILLING_MINIMUM_DURATION=30
BILLING_ENABLE_DAILY=true
BILLING_TIME=02:00
BILLING_AUTO_CHARGE=true
BILLING_GRACE_PERIOD=30
```

## 🚨 Error Handling

### Payment Processing Errors

1. **Payment Method Missing**
   - Creates medium-priority alert
   - Invoice created but not charged
   - Alert sent to organization admins

2. **Payment Processing Failure**
   - Creates high-priority alert
   - Invoice created but payment failed
   - Alert sent to organization admins

3. **Database Errors**
   - Logs error and continues processing
   - Skips failed organization
   - Processes remaining organizations

### Error Recovery

- **Retry Logic**: Failed payments can be retried manually
- **Grace Period**: 30-day grace period for payment issues
- **Alert Expiration**: Alerts expire after 7 days
- **Manual Processing**: Fallback to manual invoice creation

## 🔔 Alert System

### Alert Types

1. **Missing Payment Method**
   ```javascript
   {
     message: "No payment method configured for daily billing. Invoice INV-000001 created but not charged.",
     importance: 'medium',
     alertType: 'system',
     createdBy: org._id,
     createdModel: 'Org',
     visibility: 'orgAdmin',
     relevanceUntil: moment().add(7, 'days').toISOString()
   }
   ```

2. **Payment Processing Failure**
   ```javascript
   {
     message: "Failed to charge payment method for daily billing. Invoice INV-000001 created but not paid.",
     importance: 'high',
     alertType: 'system',
     createdBy: org._id,
     createdModel: 'Org',
     visibility: 'orgAdmin',
     relevanceUntil: moment().add(7, 'days').toISOString()
   }
   ```

### Alert Visibility

- **`orgAdmin`**: Only organization administrators
- **`allCaregivers`**: All caregivers in organization
- **`assignedCaregivers`**: Only assigned caregivers

## 🧪 Testing

### Test Coverage

- **89 tests** covering all billing functionality
- **Unit tests** for models, services, and controllers
- **Integration tests** for end-to-end workflows
- **Edge case testing** for error scenarios

### Test Categories

1. **Model Tests**: Cost validation, line item behavior
2. **Service Tests**: Cost calculation, payment processing
3. **Controller Tests**: API endpoints, authentication
4. **Integration Tests**: Complete billing workflows

### Running Tests

```bash
# All billing tests
yarn test tests/unit/models/conversation.model.test.js tests/unit/services/twilioCall.service.billing.test.js tests/unit/services/payment.service.billing.test.js tests/unit/services/agenda.billing.test.js tests/unit/controllers/payment.controller.billing.test.js tests/integration/billing.integration.test.js

# Individual test files
yarn test tests/unit/services/agenda.billing.test.js
yarn test tests/integration/billing.integration.test.js
```

## 🚀 Deployment

### Manual Billing Trigger

```bash
# Run daily billing manually
node src/scripts/runDailyBilling.js

# Via test endpoint
POST /v1/test/billing
{
  "orgId": "optional-org-id",
  "dryRun": false
}
```

### Monitoring

- **Logs**: Comprehensive logging for all billing operations
- **Alerts**: Automatic alert creation for issues
- **Metrics**: Invoice counts, payment success rates
- **Health Checks**: Billing system status monitoring

### Maintenance

- **Invoice Cleanup**: Archive old invoices
- **Alert Cleanup**: Remove expired alerts
- **Performance Monitoring**: Track billing process duration
- **Error Rate Monitoring**: Monitor payment failure rates

## 📊 Business Logic

### Billing Rules

1. **Minimum Billing**: All calls billed for minimum 30 seconds
2. **Failed Calls**: Failed calls still incur minimum billing
3. **Zero Duration**: Zero-duration calls billed for minimum
4. **Daily Processing**: Only processes conversations from last 24 hours
5. **Patient Grouping**: Costs grouped by patient in line items

### Invoice Rules

1. **Unique Numbers**: Sequential invoice numbering (INV-000001, etc.)
2. **Due Dates**: 30 days from issue date
3. **Status Tracking**: pending → paid → overdue
4. **Line Items**: One per patient with conversation details

### Payment Rules

1. **Automatic Charging**: Attempts to charge payment method
2. **Failure Handling**: Creates alerts for payment issues
3. **Grace Period**: 30 days before considering overdue
4. **Retry Logic**: Manual retry for failed payments

## 🔧 Troubleshooting

### Common Issues

1. **Billing Not Running**
   - Check Agenda.js scheduler status
   - Verify billing configuration
   - Check database connectivity

2. **Payment Failures**
   - Verify payment method validity
   - Check payment processor integration
   - Review alert notifications

3. **Double Billing**
   - Check race condition protection
   - Verify conversation lineItemId updates
   - Review transaction handling

### Debug Commands

```bash
# Check billing configuration
node -e "console.log(require('./src/config/config').billing)"

# Test cost calculation
node -e "const service = require('./src/services/twilioCall.service'); console.log(service.calculateCallCost(120))"

# Check unbilled conversations
node -e "const { Conversation } = require('./src/models'); Conversation.find({lineItemId: null}).then(console.log)"
```

## 📈 Performance Considerations

### Optimization

- **Batch Processing**: Process organizations in batches
- **Index Optimization**: Proper database indexes for queries
- **Memory Management**: Clean up large result sets
- **Connection Pooling**: Efficient database connections

### Scalability

- **Horizontal Scaling**: Multiple billing instances
- **Queue Processing**: Use job queues for large volumes
- **Database Sharding**: Partition by organization
- **Caching**: Cache frequently accessed data

---

**Last Updated**: January 2024  
**Version**: 1.0  
**Maintainer**: Development Team
