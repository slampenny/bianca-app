// Import integration setup first to ensure proper mocking
require('../utils/integration-setup');

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../utils/integration-app');
const { Org, Client, Conversation, Invoice, LineItem, Caregiver, Call } = require('../../src/models');
const { tokenService } = require('../../src/services');

// Import the actual billing logic to test it
const { processDailyBilling } = require('../../src/config/agenda');
const paymentService = require('../../src/services/payment.service');

describe('Billing System Integration Tests', () => {
  let mongoServer;
  let caregiver;
  let org;
  let client1;
  let client2;
  let accessToken;

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    const mongoUri = await mongoServer.getUri();
    await mongoose.connect(mongoUri, {});
    // Create test organization
    org = await Org.create({
      name: 'Integration Test Healthcare Org',
      email: 'integration@healthcare.com',
      phone: '+12345678901',
      country: 'US',
      stripeSubscriptionId: 'sub_test123' // Add Stripe subscription for billing tests
    });

    // Create test caregiver
    caregiver = await Caregiver.create({
      email: 'test@healthcare.com',
      name: 'Test User',
      role: 'orgAdmin',
      org: org._id,
      isEmailVerified: true,
      password: 'testpassword123',
      phone: '+12345678901'
    });

    // Create access token
    const tokens = await tokenService.generateAuthTokens(caregiver);
    accessToken = tokens.access.token;

    // Create test clients
    client1 = await Client.create({
      name: 'Integration Client 1',
      email: 'client1@integration.com',
      phone: '+12345678901',
      org: org._id
    });

    client2 = await Client.create({
      name: 'Integration Client 2',
      email: 'client2@integration.com',
      phone: '+12345678902',
      org: org._id
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clean up before each test
    // Clear any stuck billing session IDs first (in case previous tests left them)
    await Call.updateMany({ billingSessionId: { $ne: null } }, { $unset: { billingSessionId: 1 } });
    await Call.deleteMany({});
    await Conversation.deleteMany({});
    await Invoice.deleteMany({});
    await LineItem.deleteMany({});
  });

  describe('End-to-End Billing Flow', () => {
    it('should complete full billing cycle from conversation to invoice', async () => {
      // Step 1: Create Call records first (required for conversations)
      // Set endTime to yesterday so they're eligible for billing (billing process looks for calls from last 24h)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const call1 = await Call.create({
        callSid: 'CA11111111111111111111111111111111',
        clientId: client1._id,
        duration: 120, // 2 minutes
        cost: 0.20,
        status: 'completed',
        startTime: yesterday,
        endTime: yesterday, // Set to yesterday for billing eligibility
        lineItemId: null // Unbilled
      });

      const call2 = await Call.create({
        callSid: 'CA22222222222222222222222222222222',
        clientId: client1._id,
        duration: 180, // 3 minutes
        cost: 0.30,
        status: 'completed',
        startTime: yesterday,
        endTime: yesterday, // Set to yesterday for billing eligibility
        lineItemId: null // Unbilled
      });

      const call3 = await Call.create({
        callSid: 'CA33333333333333333333333333333333',
        clientId: client2._id,
        duration: 90, // 1.5 minutes
        cost: 0.15,
        status: 'completed',
        startTime: yesterday,
        endTime: yesterday, // Set to yesterday for billing eligibility
        lineItemId: null // Unbilled
      });

      // Step 1b: Create conversations linked to calls
      const conversation1 = await Conversation.create({
        callId: call1._id,
        clientId: client1._id,
        messages: [],
      });

      const conversation2 = await Conversation.create({
        callId: call2._id,
        clientId: client1._id,
        messages: [],
      });

      const conversation3 = await Conversation.create({
        callId: call3._id,
        clientId: client2._id,
        messages: [],
      });

      // Step 2: Check unbilled costs via API
      const unbilledRes = await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(unbilledRes.body.totalUnbilledCost).toBe(0.65);
      expect(unbilledRes.body.clientCosts).toHaveLength(2);

      // Step 3: Run daily billing process
      await processDailyBilling();

      // Step 4: Verify calls are marked as billed (payment service uses Call records, not Conversation)
      const billedCalls = await Call.find({ lineItemId: { $ne: null } });
      expect(billedCalls).toHaveLength(3);

      // Step 5: Verify invoice was created
      const invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(1);

      const invoice = invoices[0];
      expect(invoice.totalAmount).toBe(0.65);
      expect(invoice.status).toBe('pending');

      // Step 6: Verify line items were created
      const lineItems = await LineItem.find({ invoiceId: invoice._id });
      expect(lineItems).toHaveLength(2); // One per client

      // Step 7: Verify line items have correct amounts
      const client1LineItem = lineItems.find(item => 
        item.clientId.toString() === client1._id.toString()
      );
      expect(client1LineItem.amount).toBe(0.50); // 0.20 + 0.30

      const client2LineItem = lineItems.find(item => 
        item.clientId.toString() === client2._id.toString()
      );
      expect(client2LineItem.amount).toBe(0.15);

      // Step 8: Verify unbilled costs are now zero
      const finalUnbilledRes = await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(finalUnbilledRes.body.totalUnbilledCost).toBe(0);
      expect(finalUnbilledRes.body.clientCosts).toHaveLength(0);

      // Step 9: Verify invoice is accessible via API
      const invoiceRes = await request(app)
        .get(`/v1/payments/orgs/${org._id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(invoiceRes.body).toHaveLength(1);
      expect(invoiceRes.body[0].totalAmount).toBe(0.65);
    });

    it('should handle multiple billing cycles without double billing', async () => {
      // Create initial Call records (payment service uses Call records for billing)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      await Call.create([
        {
          callSid: 'CA11111111111111111111111111111111',
          clientId: client1._id,
          duration: 120,
          cost: 0.20,
          status: 'completed',
          startTime: yesterday,
          endTime: yesterday, // Set to yesterday for billing eligibility
          lineItemId: null
        },
        {
          callSid: 'CA22222222222222222222222222222222',
          clientId: client2._id,
          duration: 90,
          cost: 0.15,
          status: 'completed',
          startTime: yesterday,
          endTime: yesterday, // Set to yesterday for billing eligibility
          lineItemId: null
        }
      ]);

      // First billing cycle
      await processDailyBilling();

      let invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(1);
      expect(invoices[0].totalAmount).toBe(0.35);

      // Create new Call records for second billing cycle
      // Reuse yesterday for this cycle
      await Call.create([
        {
          callSid: 'CA33333333333333333333333333333333',
          clientId: client1._id,
          duration: 180,
          cost: 0.30,
          status: 'completed',
          startTime: yesterday,
          endTime: yesterday, // Set to yesterday for billing eligibility
          lineItemId: null
        }
      ]);

      // Second billing cycle
      await processDailyBilling();

      invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(2); // Should create new invoice, not modify existing

      const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      expect(totalAmount).toBeCloseTo(0.65, 2); // 0.35 + 0.30

      // Verify no calls are double-billed (payment service uses Call records)
      const billedCalls = await Call.find({ lineItemId: { $ne: null } });
      expect(billedCalls).toHaveLength(3); // All calls billed exactly once
    });

    it('should handle mixed billed and unbilled conversations correctly', async () => {
      // Create Call records (payment service uses Call records for billing)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const call1 = await Call.create({
        callSid: 'CA11111111111111111111111111111111',
        clientId: client1._id,
        duration: 120,
        cost: 0.20,
        status: 'completed',
        startTime: yesterday,
        endTime: yesterday, // Set to yesterday for billing eligibility
        lineItemId: null
      });

      const call2 = await Call.create({
        callSid: 'CA22222222222222222222222222222222',
        clientId: client1._id,
        duration: 180,
        cost: 0.30,
        status: 'completed',
        startTime: yesterday,
        endTime: yesterday, // Set to yesterday for billing eligibility
        lineItemId: null
      });

      // Manually bill one conversation
      const manualInvoice = await Invoice.create({
        org: org._id,
        invoiceNumber: 'INV-MANUAL-001',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
        totalAmount: 0.20
      });

      const manualLineItem = await LineItem.create({
        clientId: client1._id,
        invoiceId: manualInvoice._id,
        amount: 0.20,
        description: 'Manual billing',
        quantity: 1
      });

      // Mark first call as billed
      await Call.updateOne(
        { _id: call1._id },
        { lineItemId: manualLineItem._id }
      );

      // Run billing process
      await processDailyBilling();

      // Should only bill the remaining unbilled conversation
      const invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(2); // Manual + automatic

      const automaticInvoice = invoices.find(inv => inv.invoiceNumber !== 'INV-MANUAL-001');
      expect(automaticInvoice.totalAmount).toBe(0.30); // Only the unbilled conversation

      // Verify all calls are billed (payment service uses Call records)
      const billedCalls = await Call.find({ lineItemId: { $ne: null } });
      expect(billedCalls).toHaveLength(2);
    });

    it('should handle zero-cost conversations correctly', async () => {
      // Create Call records with different costs (payment service uses Call records)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      await Call.create([
        {
          callSid: 'CA11111111111111111111111111111111',
          clientId: client1._id,
          duration: 120,
          cost: 0.20,
          status: 'completed',
          startTime: yesterday,
          endTime: yesterday, // Set to yesterday for billing eligibility
          lineItemId: null
        },
        {
          callSid: 'CA22222222222222222222222222222222',
          clientId: client1._id,
          duration: 0,
          cost: 0, // Zero cost conversation
          status: 'failed',
          startTime: yesterday,
          endTime: yesterday, // Set to yesterday (but won't be billed due to zero cost)
          lineItemId: null
        },
        {
          callSid: 'CA33333333333333333333333333333333',
          clientId: client2._id,
          duration: 90,
          cost: 0.15,
          status: 'completed',
          startTime: yesterday,
          endTime: yesterday, // Set to yesterday for billing eligibility
          lineItemId: null
        }
      ]);

      // Run billing process
      await processDailyBilling();

      // Should only create invoice for non-zero cost conversations
      const invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(1);
      expect(invoices[0].totalAmount).toBe(0.35); // 0.20 + 0.15, excluding zero-cost

      // Verify zero-cost call remains unbilled (payment service uses Call records)
      const zeroCostCall = await Call.findOne({ cost: 0 });
      expect(zeroCostCall.lineItemId).toBeNull();
    });

    it('should handle API endpoints with proper authentication and authorization', async () => {
      // Create test Call record (payment service uses Call records for billing)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      await Call.create({
        callSid: 'CA11111111111111111111111111111111',
        clientId: client1._id,
        duration: 120,
        cost: 0.20,
        status: 'completed',
        startTime: yesterday,
        endTime: yesterday, // Set to yesterday for billing eligibility
        lineItemId: null
      });

      // Test unauthorized access
      await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .expect(401);

      // Test with invalid token
      await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      // Test with insufficient permissions
      const limitedCaregiver = await Caregiver.create({
        email: 'limited@healthcare.com',
        name: 'Limited User',
        role: 'staff',
        org: org._id,
        isEmailVerified: true,
        password: 'testpassword123',
        phone: '+12345678902'
      });
      const limitedTokens = await tokenService.generateAuthTokens(limitedCaregiver);
      const limitedToken = limitedTokens.access.token;

      await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${limitedToken}`)
        .expect(403);

      // Test authorized access
      await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection issues gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test that the system handles missing data gracefully
      
      const nonExistentOrgId = new mongoose.Types.ObjectId();
      
      const res = await request(app)
        .get(`/v1/payments/orgs/${nonExistentOrgId}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(res.body.message).toContain('Organization not found');
    });

    it('should handle concurrent billing processes', async () => {
      // Create Call records (payment service uses Call records for billing)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      await Call.create([
        {
          callSid: 'CA11111111111111111111111111111111',
          clientId: client1._id,
          duration: 120,
          cost: 0.20,
          status: 'completed',
          startTime: yesterday,
          endTime: yesterday, // Set to yesterday for billing eligibility
          lineItemId: null
        },
        {
          callSid: 'CA22222222222222222222222222222222',
          clientId: client2._id,
          duration: 90,
          cost: 0.15,
          status: 'completed',
          startTime: yesterday,
          endTime: yesterday, // Set to yesterday for billing eligibility
          lineItemId: null
        }
      ]);

      // Run billing process concurrently
      const promise1 = processDailyBilling();
      const promise2 = processDailyBilling();

      await Promise.all([promise1, promise2]);

      // Should only create one invoice despite concurrent execution
      const invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(1);

      // All calls should be billed exactly once (payment service uses Call records)
      const billedCalls = await Call.find({ lineItemId: { $ne: null } });
      expect(billedCalls).toHaveLength(2);
    });

    it('should handle large numbers of conversations efficiently', async () => {
      // Create many Call records (payment service uses Call records for billing)
      // Use a timestamp from a few hours ago to ensure it's within the 24-hour window
      const callEndTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      
      const calls = [];
      for (let i = 0; i < 50; i++) {
        calls.push({
          callSid: `CA${i.toString().padStart(30, '0')}`,
          clientId: i % 2 === 0 ? client1._id : client2._id,
          duration: 60 + (i * 2), // Varying durations
          cost: 0.10 + (i * 0.01), // Varying costs
          status: 'completed',
          startTime: new Date(callEndTime.getTime() - 60000), // 1 minute before end
          endTime: callEndTime,
          lineItemId: null,
          billingSessionId: null // Explicitly set to null for billing query
        });
      }
      await Call.insertMany(calls);

      const startTime = Date.now();
      await processDailyBilling();
      const endTime = Date.now();

      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds

      // Verify all calls are billed (payment service uses Call records)
      const billedCalls = await Call.find({ lineItemId: { $ne: null } });
      expect(billedCalls).toHaveLength(50);

      // Verify invoice was created with correct total
      const invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(1);
      expect(invoices[0].totalAmount).toBeGreaterThan(0);
    });
  });
});
