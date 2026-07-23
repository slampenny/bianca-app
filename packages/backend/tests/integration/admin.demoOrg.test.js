require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const mongoose = require('mongoose');

const app = require('../utils/integration-app');
const {
  Caregiver,
  Token,
  AuditLog,
  Org,
  Client,
  Call,
  Conversation,
  Message,
  MedicalAnalysis,
  FraudAbuseAnalysis,
  Invoice,
  PaymentMethod,
  Alert,
  Schedule,
  CaregiverDailyDigest,
  FamilyWeeklyDigest,
} = require('../../src/models');
const { caregiverOne, admin, superAdmin, insertCaregivers } = require('../fixtures/caregiver.fixture');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { tokenService } = require('../../src/services');
const demoOrgService = require('../../src/services/demoOrg.service');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Admin demo org flag + refresh', () => {
  let superAdminId;
  let orgId;
  let accessToken;

  beforeEach(async () => {
    await clearDatabase();
    const [org] = await insertOrgs([{ ...orgOne, email: `demo-flag-${Date.now()}@example.org` }]);
    orgId = org.id || org._id;
    const caregivers = await insertCaregivers([
      { ...caregiverOne, org: orgId, email: `staff-${Date.now()}@example.org` },
      { ...admin, org: orgId, email: `admin-${Date.now()}@example.org` },
      { ...superAdmin, org: orgId, email: `super-${Date.now()}@example.org` },
    ]);
    superAdminId = caregivers[2].id;
    accessToken = tokenService.generateToken(superAdminId);
    await Org.findByIdAndUpdate(orgId, { $set: { caregivers: caregivers.map((c) => c._id) } });
  });

  afterEach(async () => {
    await AuditLog.deleteMany();
    await Token.deleteMany();
  });

  it('refuses isDemo=true when org has a Stripe subscription id', async () => {
    await Org.findByIdAndUpdate(orgId, { $set: { stripeSubscriptionId: 'sub_test_blocked' } });

    const res = await request(app)
      .post(`/v1/admin/orgs/${orgId}/demo-flag`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isDemo: true, confirm: 'SET_AS_DEMO_ORG' });

    expect(res.statusCode).toEqual(httpStatus.FORBIDDEN);
    expect(String(res.body.message || '')).toMatch(/billing history|stripeSubscriptionId/i);

    const reloaded = await Org.findById(orgId);
    expect(reloaded.isDemo).toBe(false);
  });

  it('refuses isDemo=true when org has payment method or invoice history', async () => {
    await PaymentMethod.create({
      org: orgId,
      type: 'card',
      brand: 'visa',
      last4: '4242',
      expMonth: 12,
      expYear: new Date().getFullYear() + 2,
      stripePaymentMethodId: `pm_${Date.now()}`,
    });

    const resPm = await request(app)
      .post(`/v1/admin/orgs/${orgId}/demo-flag`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isDemo: true, confirm: 'SET_AS_DEMO_ORG' });
    expect(resPm.statusCode).toEqual(httpStatus.FORBIDDEN);

    await PaymentMethod.deleteMany({ org: orgId });
    await Invoice.create({
      org: orgId,
      invoiceNumber: `INV-DEMO-${Date.now()}`,
      totalAmount: 10,
      currency: 'usd',
      status: 'pending',
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 86400000),
    });

    const resInv = await request(app)
      .post(`/v1/admin/orgs/${orgId}/demo-flag`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isDemo: true, confirm: 'SET_AS_DEMO_ORG' });
    expect(resInv.statusCode).toEqual(httpStatus.FORBIDDEN);
  });

  it('sets isDemo=true with typed confirm when org has no billing history and audits', async () => {
    const res = await request(app)
      .post(`/v1/admin/orgs/${orgId}/demo-flag`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isDemo: true, confirm: 'SET_AS_DEMO_ORG' });

    expect(res.statusCode).toEqual(httpStatus.OK);
    expect(res.body.isDemo).toBe(true);

    const audit = await AuditLog.findOne({ action: 'SET_ORG_IS_DEMO' });
    expect(audit).not.toBeNull();
    expect(String(audit.resourceId)).toEqual(String(orgId));
  });

  it('forbids refresh when org is not isDemo', async () => {
    const res = await request(app)
      .post(`/v1/admin/orgs/${orgId}/refresh-demo-data`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ confirm: 'REFRESH_DEMO_DATA', historyDays: 7 });

    expect(res.statusCode).toEqual(httpStatus.FORBIDDEN);
  });

  it('refreshes demo org and leaves zero orphans from prior client ids', async () => {
    await Org.findByIdAndUpdate(orgId, { $set: { isDemo: true } });

    // First seed
    const first = await demoOrgService.refreshDemoOrgData({
      orgId,
      confirm: 'REFRESH_DEMO_DATA',
      historyDays: 7,
      actorCaregiverId: superAdminId,
      now: new Date('2026-07-23T18:00:00.000Z'),
    });
    expect(first.clients.length).toBe(3);
    const priorClientIds = first.clients.map((c) => c.id);

    // Plant an orphan-prone extra call so wipe must clear it
    await Call.create({
      callSid: `orphan_${Date.now()}`,
      clientId: priorClientIds[0],
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
    });

    const second = await request(app)
      .post(`/v1/admin/orgs/${orgId}/refresh-demo-data`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ confirm: 'REFRESH_DEMO_DATA', historyDays: 7 });

    expect(second.statusCode).toEqual(httpStatus.OK);
    expect(second.body.success).toBe(true);
    expect(second.body.clients.length).toBe(3);

    // Prior generation must be fully gone across child collections
    const priorObjectIds = priorClientIds.map((id) => new mongoose.Types.ObjectId(id));
    const orphanCounts = await demoOrgService.countOrgChildDocuments(orgId, priorClientIds);
    // After refresh, org still has NEW clients — countOrgChildDocuments with prior ids
    // should show zero for client-scoped collections keyed by prior ids.
    const clientScoped = orphanCounts.filter((r) =>
      ['Call', 'Conversation', 'MedicalAnalysis', 'FraudAbuseAnalysis', 'Schedule', 'Alert', 'OnboardingResponse'].includes(
        r.collection
      )
    );
    for (const row of clientScoped) {
      expect(row.count).toBe(0);
    }

    expect(await Client.countDocuments({ _id: { $in: priorObjectIds } })).toBe(0);
    expect(await Call.countDocuments({ clientId: { $in: priorObjectIds } })).toBe(0);
    expect(await Conversation.countDocuments({ clientId: { $in: priorObjectIds } })).toBe(0);
    expect(await MedicalAnalysis.countDocuments({ clientId: { $in: priorObjectIds } })).toBe(0);
    expect(await Message.countDocuments({})).toBeGreaterThan(0); // new messages exist

    // Wipe-only orphan check: wipe again and assert zero remaining for THIS org across list
    const currentClients = await Client.find({ org: orgId }).select('_id').lean();
    const currentIds = currentClients.map((c) => String(c._id));
    await demoOrgService.wipeDemoOrgData(orgId);
    const afterWipe = await demoOrgService.countOrgChildDocuments(orgId, currentIds);
    for (const row of afterWipe) {
      expect(row.count).toBe(0);
    }
  });

  it('seeds multi-month MedicalAnalysis curves for dip-recover and decline', async () => {
    await Org.findByIdAndUpdate(orgId, { $set: { isDemo: true } });
    const now = new Date('2026-07-23T18:00:00.000Z');
    const result = await demoOrgService.refreshDemoOrgData({
      orgId,
      confirm: 'REFRESH_DEMO_DATA',
      historyDays: 90,
      actorCaregiverId: superAdminId,
      now,
    });

    const dip = result.clients.find((c) => c.trajectory === 'dipRecover');
    const decline = result.clients.find((c) => c.trajectory === 'decline');
    expect(dip).toBeTruthy();
    expect(decline).toBeTruthy();

    const dipSeries = await MedicalAnalysis.find({ clientId: dip.id }).sort({ analysisDate: 1 }).lean();
    const declineSeries = await MedicalAnalysis.find({ clientId: decline.id }).sort({ analysisDate: 1 }).lean();
    expect(dipSeries.length).toBeGreaterThanOrEqual(10);
    expect(declineSeries.length).toBeGreaterThanOrEqual(10);

    const dipDeps = dipSeries.map((r) => r.psychiatricMetrics?.depressionScore ?? 0);
    const mid = dipDeps[Math.floor(dipDeps.length * 0.6)];
    const last = dipDeps[dipDeps.length - 1];
    expect(mid).toBeGreaterThan(last); // mid-window peak then recover

    const declineCogs = declineSeries.map((r) => r.cognitiveMetrics?.riskScore ?? 0);
    expect(declineCogs[declineCogs.length - 1]).toBeGreaterThan(declineCogs[0]);

    expect(await CaregiverDailyDigest.countDocuments({ org: orgId, status: 'sent' })).toBeGreaterThan(0);
    expect(await FamilyWeeklyDigest.countDocuments({ org: orgId, status: 'sent' })).toBeGreaterThan(0);
    expect(await FraudAbuseAnalysis.countDocuments({ clientId: decline.id })).toBe(declineSeries.length);
  });

  it('forces primary caregiver digest gates Ready on every refresh', async () => {
    await Org.findByIdAndUpdate(orgId, { $set: { isDemo: true } });
    const first = await demoOrgService.refreshDemoOrgData({
      orgId,
      confirm: 'REFRESH_DEMO_DATA',
      historyDays: 7,
      actorCaregiverId: superAdminId,
      now: new Date('2026-07-23T18:00:00.000Z'),
    });
    const primaryId = first.staffCaregiverId;
    expect(primaryId).toBeTruthy();

    await Caregiver.findByIdAndUpdate(primaryId, {
      $set: {
        active: false,
        isEmailVerified: false,
        'notificationPreferences.dailyDigestEmail': false,
      },
    });
    await Org.findByIdAndUpdate(orgId, {
      $set: { 'dailyDigestSettings.enabled': false },
    });

    await demoOrgService.refreshDemoOrgData({
      orgId,
      confirm: 'REFRESH_DEMO_DATA',
      historyDays: 7,
      actorCaregiverId: superAdminId,
      now: new Date('2026-07-23T19:00:00.000Z'),
    });

    const primary = await Caregiver.findById(primaryId).lean();
    expect(primary).toBeTruthy();
    expect(primary.active).toBe(true);
    expect(primary.isEmailVerified).toBe(true);
    expect(primary.notificationPreferences?.dailyDigestEmail).toBe(true);

    const org = await Org.findById(orgId).lean();
    expect(org.dailyDigestSettings?.enabled).toBe(true);

    // Family caregivers must not be force-opted in by the primary-gate $set
    const family = await Caregiver.find({ org: orgId, role: 'family' }).lean();
    for (const f of family) {
      expect(f.notificationPreferences?.dailyDigestEmail).not.toBe(true);
    }
  });
});
