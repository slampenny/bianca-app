const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { Org, Client, Call, Invoice } = require('../../../src/models');

jest.mock('../../../src/services/stripeSubscription.service', () => ({
  getOrCreateSubscription: jest.fn().mockResolvedValue({
    items: { data: [{ id: 'si_test123' }] },
  }),
}));

jest.mock('../../../src/services/stripeUsage.service', () => ({
  reportConversationUsage: jest.fn().mockResolvedValue({ id: 'meter_event_test' }),
  getUsageSummary: jest.fn().mockResolvedValue({
    subscriptionId: 'sub_test123',
    totalUsage: 0,
    currentPeriodStart: Math.floor(Date.now() / 1000) - 86400,
    currentPeriodEnd: Math.floor(Date.now() / 1000) + 86400 * 29,
  }),
}));

jest.mock('../../../src/services/stripeSync.service', () => ({
  syncOrgInvoices: jest.fn().mockResolvedValue(undefined),
}));

const stripeSubscriptionService = require('../../../src/services/stripeSubscription.service');
const stripeUsageService = require('../../../src/services/stripeUsage.service');
const stripeSyncService = require('../../../src/services/stripeSync.service');
const stripeBillingService = require('../../../src/services/stripeBilling.service');

describe('Stripe Billing Service', () => {
  let mongoServer;
  let org;
  let client;

  beforeAll(async () => {
    mongoServer = new MongoMemoryServer();
    await mongoServer.start();
    await mongoose.connect(await mongoServer.getUri(), {});
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await Call.deleteMany({});
    await Client.deleteMany({});
    await Org.deleteMany({});
    await Invoice.deleteMany({});

    org = await Org.create({
      name: 'Healthcare Org',
      email: 'org@healthcare.com',
      phone: '+12345678901',
      country: 'US',
      stripeSubscriptionId: 'sub_test123',
      stripeSubscriptionItemId: 'si_test123',
    });

    client = await Client.create({
      name: 'John Doe',
      email: 'john@test.com',
      phone: '+12345678901',
      org: org._id,
    });
  });

  describe('processUsageReporting', () => {
    it('reports unreported call usage to Stripe without creating local invoices', async () => {
      await Call.create([
        {
          callSid: 'CA11111111111111111111111111111111',
          clientId: client._id,
          duration: 120,
          cost: 0.20,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          lineItemId: null,
        },
        {
          callSid: 'CA22222222222222222222222222222222',
          clientId: client._id,
          duration: 90,
          cost: 0.15,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          lineItemId: null,
        },
      ]);

      await stripeBillingService.processUsageReporting();

      expect(stripeSubscriptionService.getOrCreateSubscription).toHaveBeenCalledWith(org._id);
      expect(stripeUsageService.reportConversationUsage).toHaveBeenCalledTimes(2);
      expect(stripeSyncService.syncOrgInvoices).toHaveBeenCalledWith(org._id);

      const reportedCalls = await Call.find({ stripeUsageReportedAt: { $ne: null } });
      expect(reportedCalls).toHaveLength(2);
      reportedCalls.forEach((call) => {
        expect(call.lineItemId).toBeNull();
      });

      const invoices = await Invoice.find({ org: org._id });
      expect(invoices).toHaveLength(0);
    });

    it('skips calls already reported to Stripe', async () => {
      await Call.create({
        callSid: 'CA11111111111111111111111111111111',
        clientId: client._id,
        duration: 120,
        cost: 0.20,
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        lineItemId: null,
        stripeUsageReportedAt: new Date(),
      });

      await stripeBillingService.processUsageReporting();

      expect(stripeUsageService.reportConversationUsage).not.toHaveBeenCalled();
    });

    it('skips zero-cost calls', async () => {
      await Call.create({
        callSid: 'CA11111111111111111111111111111111',
        clientId: client._id,
        duration: 0,
        cost: 0,
        status: 'failed',
        startTime: new Date(),
        endTime: new Date(),
        lineItemId: null,
      });

      await stripeBillingService.processUsageReporting();

      expect(stripeUsageService.reportConversationUsage).not.toHaveBeenCalled();
    });

    it('continues reporting other calls when one report fails', async () => {
      await Call.create([
        {
          callSid: 'CA11111111111111111111111111111111',
          clientId: client._id,
          duration: 120,
          cost: 0.20,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          lineItemId: null,
        },
        {
          callSid: 'CA22222222222222222222222222222222',
          clientId: client._id,
          duration: 90,
          cost: 0.15,
          status: 'completed',
          startTime: new Date(),
          endTime: new Date(),
          lineItemId: null,
        },
      ]);

      stripeUsageService.reportConversationUsage
        .mockRejectedValueOnce(new Error('Stripe unavailable'))
        .mockResolvedValueOnce({ id: 'meter_event_test' });

      await stripeBillingService.processUsageReporting();

      expect(stripeUsageService.reportConversationUsage).toHaveBeenCalledTimes(2);

      const reportedCalls = await Call.find({ stripeUsageReportedAt: { $ne: null } });
      expect(reportedCalls).toHaveLength(1);
    });
  });
});
