# Stripe Meters Implementation Guide

## Overview

This document describes the hybrid Stripe Meters implementation that combines Stripe's usage-based billing with local patient-level tracking.

## Architecture

### Components

1. **Stripe Meters Service** (`stripeMeter.service.js`)
   - Creates and manages Stripe meters
   - Handles meter configuration

2. **Stripe Subscriptions Service** (`stripeSubscription.service.js`)
   - Creates and manages Stripe subscriptions with metered pricing
   - Links subscriptions to organizations

3. **Stripe Usage Service** (`stripeUsage.service.js`)
   - Reports usage events to Stripe via meter events
   - Maintains usage summaries

4. **Stripe Sync Service** (`stripeSync.service.js`)
   - Syncs Stripe invoices to local Invoice/LineItem models
   - Maintains patient-level tracking

5. **Stripe Billing Service** (`stripeBilling.service.js`)
   - Hybrid billing logic that reports to Stripe while maintaining local tracking
   - Processes unbilled conversations

6. **Stripe Webhook Service** (`stripeWebhook.service.js`)
   - Handles Stripe webhook events
   - Syncs invoices when they're created/paid

## Data Flow

### Usage Reporting Flow

```
Conversation Completed
    ↓
Calculate Cost (local)
    ↓
Report Usage to Stripe (via meter events)
    ↓
Stripe Aggregates Usage
    ↓
Stripe Creates Invoice (on billing cycle)
    ↓
Webhook: invoice.created
    ↓
Sync to Local Invoice/LineItem Models
    ↓
Link Conversations to LineItems
```

### Billing Cycle

1. **Daily Processing** (via Agenda.js)
   - Finds unbilled conversations
   - Reports usage to Stripe via meter events
   - Maintains local tracking

2. **Stripe Billing Cycle** (monthly)
   - Stripe aggregates all usage events
   - Creates invoice automatically
   - Charges payment method

3. **Webhook Processing**
   - `invoice.created` → Sync to local Invoice
   - `invoice.paid` → Update status, link conversations
   - `invoice.payment_failed` → Create alerts

## Database Schema Updates

### Org Model
- `stripeSubscriptionId`: Stripe subscription ID
- `stripeSubscriptionItemId`: Stripe subscription item ID

### Invoice Model
- `stripeInvoiceId`: Stripe invoice ID
- `stripeSubscriptionId`: Stripe subscription ID
- `stripeSynced`: Sync status flag
- `stripeSyncedAt`: Last sync timestamp

### LineItem Model
- `stripeInvoiceItemId`: Stripe invoice line item ID
- `stripeSynced`: Sync status flag
- `stripeSyncedAt`: Last sync timestamp

## Configuration

### Environment Variables

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Stripe Dashboard Setup

1. **Create Webhook Endpoint**
   - URL: `https://your-domain.com/v1/stripe/webhook`
   - Events to listen for:
     - `invoice.created`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `invoice.finalized`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

2. **Meter Configuration**
   - Meter is created automatically on first use
   - Event name: `api_requests`
   - Aggregation: `sum`

## API Endpoints

### Existing Endpoints (Unchanged)
- `GET /v1/payments/orgs/:orgId/invoices` - List invoices (now includes Stripe invoices)
- `GET /v1/payments/patients/:patientId/invoices` - Patient invoices
- `GET /v1/payments/orgs/:orgId/unbilled-costs` - Unbilled costs (now includes Stripe usage)

### New Endpoints
- `POST /v1/stripe/webhook` - Stripe webhook handler

## Migration Strategy

### Phase 1: Setup (Current)
- ✅ Create Stripe services
- ✅ Update models
- ✅ Create webhook handlers
- ✅ Update billing logic

### Phase 2: Testing
- Test meter creation
- Test usage reporting
- Test invoice syncing
- Test webhook handling

### Phase 3: Gradual Rollout
- Enable for new organizations first
- Monitor sync accuracy
- Gradually migrate existing organizations

### Phase 4: Full Migration
- Migrate all organizations
- Deprecate old billing logic (optional)
- Monitor and optimize

## Benefits

1. **Reduced Code Complexity**
   - Stripe handles aggregation, billing cycles, invoicing
   - Less custom billing logic to maintain

2. **Better Reliability**
   - Stripe's infrastructure handles edge cases
   - Automatic retries and error handling

3. **Patient-Level Tracking Preserved**
   - Local Invoice/LineItem models maintain patient granularity
   - All existing queries continue to work

4. **Flexible Billing**
   - Easy to change billing cycles
   - Support for different pricing models
   - Better reporting in Stripe dashboard

## Limitations

1. **Dual System**
   - Must maintain sync between Stripe and local models
   - Webhook reliability is critical

2. **Metadata Dependency**
   - Patient-level tracking depends on metadata in meter events
   - Must ensure metadata is included in all usage reports

3. **Stripe API Limits**
   - Rate limits on API calls
   - Webhook delivery guarantees

## Troubleshooting

### Usage Not Appearing in Stripe
- Check meter event creation logs
- Verify subscription item ID is correct
- Check Stripe dashboard for meter events

### Invoices Not Syncing
- Check webhook endpoint is accessible
- Verify webhook secret is correct
- Check webhook event logs in Stripe dashboard

### Patient-Level Tracking Missing
- Ensure metadata includes patientId in usage reports
- Check sync service logs
- Verify line item creation in sync process

## Future Enhancements

1. **Multiple Meters**
   - Support different usage types (calls, messages, etc.)
   - Different pricing per meter

2. **Advanced Reporting**
   - Real-time usage dashboards
   - Cost forecasting
   - Patient-level analytics

3. **Billing Portal Integration**
   - Stripe Customer Portal for self-service
   - Invoice downloads
   - Payment method management

