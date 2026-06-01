require('../utils/integration-setup');

jest.mock('../../src/services/stripeSubscription.service', () => ({
  getOrCreateSubscription: jest.fn().mockResolvedValue({
    items: { data: [{ id: 'si_test123' }] },
  }),
}));

jest.mock('../../src/services/stripeUsage.service', () => ({
  reportConversationUsage: jest.fn().mockResolvedValue({ id: 'meter_event_test' }),
  getUsageSummary: jest.fn().mockResolvedValue({
    subscriptionId: 'sub_test123',
    subscriptionItemId: 'si_test123',
    currentPeriodStart: Math.floor(Date.now() / 1000) - 86400 * 7,
    currentPeriodEnd: Math.floor(Date.now() / 1000) + 86400 * 23,
    usageRecords: [],
    totalUsage: 0,
  }),
}));

jest.mock('../../src/services/stripeSync.service', () => ({
  syncOrgInvoices: jest.fn().mockResolvedValue(undefined),
}));

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../utils/integration-app');
const { Org, Client, Conversation, Invoice, LineItem, Caregiver, Call } = require('../../src/models');
const { tokenService } = require('../../src/services');
const { processUsageReporting } = require('../../src/config/agenda');
const stripeUsageService = require('../../src/services/stripeUsage.service');

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
    await mongoose.connect(await mongoServer.getUri(), {});

    org = await Org.create({
      name: 'Integration Test Healthcare Org',
      email: 'integration@healthcare.com',
      phone: '+12345678901',
      country: 'US',
      stripeSubscriptionId: 'sub_test123',
      stripeSubscriptionItemId: 'si_test123',
    });

    caregiver = await Caregiver.create({
      email: 'test@healthcare.com',
      name: 'Test User',
      role: 'orgAdmin',
      org: org._id,
      isEmailVerified: true,
      password: 'testpassword123',
      phone: '+12345678901',
    });

    const tokens = await tokenService.generateAuthTokens(caregiver);
    accessToken = tokens.access.token;

    client1 = await Client.create({
      name: 'Integration Client 1',
      email: 'client1@integration.com',
      phone: '+12345678901',
      org: org._id,
    });

    client2 = await Client.create({
      name: 'Integration Client 2',
      email: 'client2@integration.com',
      phone: '+12345678902',
      org: org._id,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await Call.deleteMany({});
    await Conversation.deleteMany({});
    await Invoice.deleteMany({});
    await LineItem.deleteMany({});
  });

  describe('Stripe usage reporting flow', () => {
    it('reports call usage to Stripe without creating local invoices', async () => {
      const callEndTime = new Date();

      await Call.create([
        {
          callSid: 'CA11111111111111111111111111111111',
          clientId: client1._id,
          duration: 120,
          cost: 0.20,
          status: 'completed',
          startTime: callEndTime,
          endTime: callEndTime,
          lineItemId: null,
        },
        {
          callSid: 'CA22222222222222222222222222222222',
          clientId: client1._id,
          duration: 180,
          cost: 0.30,
          status: 'completed',
          startTime: callEndTime,
          endTime: callEndTime,
          lineItemId: null,
        },
        {
          callSid: 'CA33333333333333333333333333333333',
          clientId: client2._id,
          duration: 90,
          cost: 0.15,
          status: 'completed',
          startTime: callEndTime,
          endTime: callEndTime,
          lineItemId: null,
        },
      ]);

      const unbilledRes = await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(unbilledRes.body.totalUnbilledCost).toBe(0.65);
      expect(unbilledRes.body.clientCosts).toHaveLength(2);

      await processUsageReporting();

      expect(stripeUsageService.reportConversationUsage).toHaveBeenCalledTimes(3);

      const reportedCalls = await Call.find({ stripeUsageReportedAt: { $ne: null } });
      expect(reportedCalls).toHaveLength(3);
      reportedCalls.forEach((call) => {
        expect(call.lineItemId).toBeNull();
      });

      const invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(0);

      const finalUnbilledRes = await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(finalUnbilledRes.body.totalUnbilledCost).toBe(0.65);
      expect(finalUnbilledRes.body.clientCosts).toHaveLength(2);
    });

    it('does not double-report calls on subsequent runs', async () => {
      const callEndTime = new Date();

      await Call.create({
        callSid: 'CA11111111111111111111111111111111',
        clientId: client1._id,
        duration: 120,
        cost: 0.20,
        status: 'completed',
        startTime: callEndTime,
        endTime: callEndTime,
        lineItemId: null,
      });

      await processUsageReporting();
      await processUsageReporting();

      expect(stripeUsageService.reportConversationUsage).toHaveBeenCalledTimes(1);
    });

    it('skips zero-cost calls', async () => {
      const callEndTime = new Date();

      await Call.create([
        {
          callSid: 'CA11111111111111111111111111111111',
          clientId: client1._id,
          duration: 120,
          cost: 0.20,
          status: 'completed',
          startTime: callEndTime,
          endTime: callEndTime,
          lineItemId: null,
        },
        {
          callSid: 'CA22222222222222222222222222222222',
          clientId: client1._id,
          duration: 0,
          cost: 0,
          status: 'failed',
          startTime: callEndTime,
          endTime: callEndTime,
          lineItemId: null,
        },
      ]);

      await processUsageReporting();

      expect(stripeUsageService.reportConversationUsage).toHaveBeenCalledTimes(1);

      const zeroCostCall = await Call.findOne({ cost: 0 });
      expect(zeroCostCall.stripeUsageReportedAt).toBeNull();
    });
  });

  describe('API authorization', () => {
    it('requires authentication and org admin access for unbilled costs', async () => {
      const callEndTime = new Date();

      await Call.create({
        callSid: 'CA11111111111111111111111111111111',
        clientId: client1._id,
        duration: 120,
        cost: 0.20,
        status: 'completed',
        startTime: callEndTime,
        endTime: callEndTime,
        lineItemId: null,
      });

      await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .expect(401);

      await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      const limitedCaregiver = await Caregiver.create({
        email: 'limited@healthcare.com',
        name: 'Limited User',
        role: 'staff',
        org: org._id,
        isEmailVerified: true,
        password: 'testpassword123',
        phone: '+12345678902',
      });
      const limitedTokens = await tokenService.generateAuthTokens(limitedCaregiver);

      await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${limitedTokens.access.token}`)
        .expect(403);

      await request(app)
        .get(`/v1/payments/orgs/${org._id}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('returns forbidden for non-existent org access checks', async () => {
      const nonExistentOrgId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/v1/payments/orgs/${nonExistentOrgId}/unbilled-costs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      expect(res.body.message).toContain('access');
    });
  });
});
