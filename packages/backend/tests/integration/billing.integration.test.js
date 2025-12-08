// Import integration setup first to ensure proper mocking
require('../utils/integration-setup');

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../utils/integration-app');
const { Org, Patient, Conversation, Invoice, LineItem, Caregiver } = require('../../src/models');
const { tokenService } = require('../../src/services');

// Import the actual billing logic to test it
const { processDailyBilling } = require('../../src/config/agenda');
const paymentService = require('../../src/services/payment.service');

describe('Billing System Integration Tests', () => {
  let mongoServer;
  let caregiver;
  let org;
  let patient1;
  let patient2;
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
      phone: '+12345678901'
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

    // Create test patients
    patient1 = await Patient.create({
      name: 'Integration Patient 1',
      email: 'patient1@integration.com',
      phone: '+12345678901',
      org: org._id
    });

    patient2 = await Patient.create({
      name: 'Integration Patient 2',
      email: 'patient2@integration.com',
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
    await Conversation.deleteMany({});
    await Invoice.deleteMany({});
    await LineItem.deleteMany({});
  });

  describe('End-to-End Billing Flow', () => {
    it('should complete full billing cycle from conversation to invoice', async () => {
      // Step 1: Create conversations with costs
      const conversation1 = await Conversation.create({
        callSid: 'CA11111111111111111111111111111111',
        patientId: patient1._id,
        duration: 120, // 2 minutes
        cost: 0.20,
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        lineItemId: null // Unbilled
      });

      const conversation2 = await Conversation.create({
        callSid: 'CA22222222222222222222222222222222',
        patientId: patient1._id,
        duration: 180, // 3 minutes
        cost: 0.30,
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        lineItemId: null // Unbilled
      });

      const conversation3 = await Conversation.create({
        callSid: 'CA33333333333333333333333333333333',
        patientId: patient2._id,
        duration: 90, // 1.5 minutes
        cost: 0.15,
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        lineItemId: null // Unbilled
      });

      // Step 2: Check unbilled costs via API
      const unbilledRes = await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(unbilledRes.body.totalUnbilledCost).toBe(0.65);
      expect(unbilledRes.body.patientCosts).toHaveLength(2);

      // Step 3: Run daily billing process
      await processDailyBilling();

      // Step 4: Verify conversations are marked as billed
      const billedConversations = await Conversation.find({ lineItemId: { $ne: null } });
      expect(billedConversations).toHaveLength(3);

      // Step 5: Verify invoice was created
      const invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(1);

      const invoice = invoices[0];
      expect(invoice.totalAmount).toBe(0.65);
      expect(invoice.status).toBe('pending');

      // Step 6: Verify line items were created
      const lineItems = await LineItem.find({ invoiceId: invoice._id });
      expect(lineItems).toHaveLength(2); // One per patient

      // Step 7: Verify line items have correct amounts
      const patient1LineItem = lineItems.find(item => 
        item.patientId.toString() === patient1._id.toString()
      );
      expect(patient1LineItem.amount).toBe(0.50); // 0.20 + 0.30

      const patient2LineItem = lineItems.find(item => 
        item.patientId.toString() === patient2._id.toString()
      );
      expect(patient2LineItem.amount).toBe(0.15);

      // Step 8: Verify unbilled costs are now zero
      const finalUnbilledRes = await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(finalUnbilledRes.body.totalUnbilledCost).toBe(0);
      expect(finalUnbilledRes.body.patientCosts).toHaveLength(0);

      // Step 9: Verify invoice is accessible via API
      const invoiceRes = await request(app)
        .get(`/v1/payments/orgs/${org._id}/invoices`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(invoiceRes.body).toHaveLength(1);
      expect(invoiceRes.body[0].totalAmount).toBe(0.65);
    });

    it('should handle multiple billing cycles without double billing', async () => {
      // Create initial conversations
      await Conversation.create([
        {
          callSid: 'CA11111111111111111111111111111111',
          patientId: patient1._id,
          duration: 120,
          cost: 0.20,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          lineItemId: null
        },
        {
          callSid: 'CA22222222222222222222222222222222',
          patientId: patient2._id,
          duration: 90,
          cost: 0.15,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          lineItemId: null
        }
      ]);

      // First billing cycle
      await processDailyBilling();

      let invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(1);
      expect(invoices[0].totalAmount).toBe(0.35);

      // Create new conversations for second billing cycle
      await Conversation.create([
        {
          callSid: 'CA33333333333333333333333333333333',
          patientId: patient1._id,
          duration: 180,
          cost: 0.30,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          lineItemId: null
        }
      ]);

      // Second billing cycle
      await processDailyBilling();

      invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(2); // Should create new invoice, not modify existing

      const totalAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      expect(totalAmount).toBeCloseTo(0.65, 2); // 0.35 + 0.30

      // Verify no conversations are double-billed
      const billedConversations = await Conversation.find({ lineItemId: { $ne: null } });
      expect(billedConversations).toHaveLength(3); // All conversations billed exactly once
    });

    it('should handle mixed billed and unbilled conversations correctly', async () => {
      // Create some conversations
      const conv1 = await Conversation.create({
        callSid: 'CA11111111111111111111111111111111',
        patientId: patient1._id,
        duration: 120,
        cost: 0.20,
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        lineItemId: null
      });

      const conv2 = await Conversation.create({
        callSid: 'CA22222222222222222222222222222222',
        patientId: patient1._id,
        duration: 180,
        cost: 0.30,
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
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
        patientId: patient1._id,
        invoiceId: manualInvoice._id,
        amount: 0.20,
        description: 'Manual billing',
        quantity: 1
      });

      // Mark first conversation as billed
      await Conversation.updateOne(
        { _id: conv1._id },
        { lineItemId: manualLineItem._id }
      );

      // Run billing process
      await processDailyBilling();

      // Should only bill the remaining unbilled conversation
      const invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(2); // Manual + automatic

      const automaticInvoice = invoices.find(inv => inv.invoiceNumber !== 'INV-MANUAL-001');
      expect(automaticInvoice.totalAmount).toBe(0.30); // Only the unbilled conversation

      // Verify all conversations are billed
      const billedConversations = await Conversation.find({ lineItemId: { $ne: null } });
      expect(billedConversations).toHaveLength(2);
    });

    it('should handle zero-cost conversations correctly', async () => {
      // Create conversations with different costs
      await Conversation.create([
        {
          callSid: 'CA11111111111111111111111111111111',
          patientId: patient1._id,
          duration: 120,
          cost: 0.20,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          lineItemId: null
        },
        {
          callSid: 'CA22222222222222222222222222222222',
          patientId: patient1._id,
          duration: 0,
          cost: 0, // Zero cost conversation
          status: 'failed',
          startTime: new Date(),
          endTime: new Date(),
          lineItemId: null
        },
        {
          callSid: 'CA33333333333333333333333333333333',
          patientId: patient2._id,
          duration: 90,
          cost: 0.15,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          lineItemId: null
        }
      ]);

      // Run billing process
      await processDailyBilling();

      // Should only create invoice for non-zero cost conversations
      const invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(1);
      expect(invoices[0].totalAmount).toBe(0.35); // 0.20 + 0.15, excluding zero-cost

      // Verify zero-cost conversation remains unbilled
      const zeroCostConversation = await Conversation.findOne({ cost: 0 });
      expect(zeroCostConversation.lineItemId).toBeNull();
    });

    it('should handle API endpoints with proper authentication and authorization', async () => {
      // Create test conversations
      await Conversation.create({
        callSid: 'CA11111111111111111111111111111111',
        patientId: patient1._id,
        duration: 120,
        cost: 0.20,
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
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
      // Create conversations
      await Conversation.create([
        {
          callSid: 'CA11111111111111111111111111111111',
          patientId: patient1._id,
          duration: 120,
          cost: 0.20,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          lineItemId: null
        },
        {
          callSid: 'CA22222222222222222222222222222222',
          patientId: patient2._id,
          duration: 90,
          cost: 0.15,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
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

      // All conversations should be billed exactly once
      const billedConversations = await Conversation.find({ lineItemId: { $ne: null } });
      expect(billedConversations).toHaveLength(2);
    });

    it('should handle large numbers of conversations efficiently', async () => {
      // Create many conversations
      const conversations = [];
      for (let i = 0; i < 50; i++) {
        conversations.push({
          callSid: `CA${i.toString().padStart(30, '0')}`,
          patientId: i % 2 === 0 ? patient1._id : patient2._id,
          duration: 60 + (i * 2), // Varying durations
          cost: 0.10 + (i * 0.01), // Varying costs
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          lineItemId: null
        });
      }
      await Conversation.insertMany(conversations);

      const startTime = Date.now();
      await processDailyBilling();
      const endTime = Date.now();

      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds

      // Verify all conversations are billed
      const billedConversations = await Conversation.find({ lineItemId: { $ne: null } });
      expect(billedConversations).toHaveLength(50);

      // Verify invoice was created with correct total
      const invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(1);
      expect(invoices[0].totalAmount).toBeGreaterThan(0);
    });
  });
});
