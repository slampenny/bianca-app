/**
 * End-to-end HTTP integration: family mobile portal (invite, per-resident links, digests, alerts).
 * Uses real services; external deps mocked via integration-setup only.
 */
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../utils/integration-app');
const {
  Org,
  Client,
  Caregiver,
  Call,
  Conversation,
  FamilyWeeklyDigest,
  FamilyResidentLink,
  Token,
} = require('../../src/models');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { clientOne, clientTwo, insertClientsWithOrg } = require('../fixtures/client.fixture');
const {
  insertCaregivertoOrgAndReturnTokenByRole,
  password,
} = require('../fixtures/caregiver.fixture');
const { alertOne, insertAlerts } = require('../fixtures/alert.fixture');
const emailService = require('../../src/services/email.service');
const { tokenTypes } = require('../../src/config/tokens');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

const WEEK_REF = '2026-03-25';

const DAUGHTER_EMAIL = 'daughter.family@example.org';
const SON_EMAIL = 'son.family@example.org';

const digestRecipientsBody = {
  familyDigestRecipients: [
    {
      name: 'Sarah Family',
      relationship: 'daughter',
      email: DAUGHTER_EMAIL,
      familyDigestEmail: { enabled: true },
    },
    {
      name: 'Mike Family',
      relationship: 'son',
      email: SON_EMAIL,
      familyDigestEmail: { enabled: true },
    },
  ],
};

function extractVerifyTokenFromEmail(captured) {
  const body = `${captured.text || ''}\n${captured.html || ''}`;
  const match = body.match(/family-digest-email\/verify\?token=([^&\s"'<>]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function extractInviteTokenFromEmail(captured) {
  const body = `${captured.text || ''}\n${captured.html || ''}`;
  const match = body.match(/[?&]token=([^&\s"'<>]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function verifyRecipientViaEmail(orgAdminToken, clientId, recipientId, email) {
  await request(app)
    .post(`/v1/clients/${clientId}/family-digest-email/verification`)
    .set('Authorization', `Bearer ${orgAdminToken}`)
    .send({ recipientId })
    .expect(httpStatus.OK);

  const captured = emailService.getLastCapturedEmail(email);
  expect(captured).toBeTruthy();
  const verifyToken = extractVerifyTokenFromEmail(captured);
  expect(verifyToken).toBeTruthy();

  await request(app)
    .get('/v1/clients/family-digest-email/verify')
    .query({ token: verifyToken })
    .set('Accept', 'application/json')
    .expect(httpStatus.OK);
}

async function enableFamilyPortal(orgId) {
  await Org.findByIdAndUpdate(orgId, {
    familyPortalSettings: { enabled: true, allowInviteAfterDigestVerify: true },
  });
}

async function seedResidentWithRecipients(orgAdminToken, clientSeed, orgId) {
  const [client] = await insertClientsWithOrg(
    [{ ...clientSeed, consented: true }],
    orgId
  );
  const patchRes = await request(app)
    .patch(`/v1/clients/${client.id}`)
    .set('Authorization', `Bearer ${orgAdminToken}`)
    .send(digestRecipientsBody)
    .expect(httpStatus.OK);
  return { client, recipients: patchRes.body.familyDigestRecipients };
}

async function inviteRecipient(orgAdminToken, clientId, recipientId) {
  return request(app)
    .post(`/v1/clients/${clientId}/family-portal/invite`)
    .set('Authorization', `Bearer ${orgAdminToken}`)
    .send({ recipientId })
    .expect(httpStatus.OK);
}

async function registerFamilyAccount(email, name) {
  const caregiver = await Caregiver.findOne({ email: email.toLowerCase() });
  expect(caregiver).toBeTruthy();
  const tokenDoc = await Token.findOne({ caregiver: caregiver._id, type: tokenTypes.INVITE });
  expect(tokenDoc?.token).toBeTruthy();

  const res = await request(app)
    .post('/v1/auth/registerWithInvite')
    .send({
      token: tokenDoc.token,
      email,
      password,
      name,
      phone: '+16045624263',
    })
    .expect(httpStatus.CREATED);

  return res.body;
}

async function loginCaregiver(email) {
  const res = await request(app)
    .post('/v1/auth/login')
    .send({ email, password })
    .expect(httpStatus.OK);
  return res.body;
}

async function seedCall(clientId) {
  const weekStart = new Date('2026-03-23T07:00:00.000Z');
  const call = await Call.create({
    callSid: `CA${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    clientId,
    status: 'completed',
    callOutcome: 'answered',
    duration: 180,
    startTime: new Date(weekStart.getTime() + 86400000),
  });
  await Conversation.create({
    callId: call._id,
    clientId,
    summary: 'Wellness check-in completed.',
    history: 'Wellness check-in completed.',
  });
  return call;
}

async function createAndSendDigest(orgAdminToken, clientId) {
  await seedCall(clientId);
  const createRes = await request(app)
    .post('/v1/family-weekly-digests')
    .set('Authorization', `Bearer ${orgAdminToken}`)
    .send({ clientId, weekStart: WEEK_REF })
    .expect(httpStatus.CREATED);

  const digestId = createRes.body.digest.id;
  await request(app)
    .post(`/v1/family-weekly-digests/${digestId}/send`)
    .set('Authorization', `Bearer ${orgAdminToken}`)
    .expect(httpStatus.OK);

  return digestId;
}

async function seedScheduleForClient(orgAdminToken, clientId) {
  const res = await request(app)
    .post(`/v1/schedules/clients/${clientId}`)
    .set('Authorization', `Bearer ${orgAdminToken}`)
    .send({
      frequency: 'weekly',
      intervals: [{ day: 3, weeks: 1 }],
      time: '14:30',
    })
    .expect(httpStatus.CREATED);
  return res.body.id;
}

async function setupActiveFamilyUser() {
  const [org] = await insertOrgs([orgOne]);
  await enableFamilyPortal(org._id);
  const { accessToken: orgAdminToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
  const { client, recipients } = await seedResidentWithRecipients(orgAdminToken, clientOne, org._id);
  const daughterId = recipients.find((r) => r.email === DAUGHTER_EMAIL).id;
  await verifyRecipientViaEmail(orgAdminToken, client.id, daughterId, DAUGHTER_EMAIL);
  await inviteRecipient(orgAdminToken, client.id, daughterId);
  await registerFamilyAccount(DAUGHTER_EMAIL, 'Sarah Family');
  const { tokens } = await loginCaregiver(DAUGHTER_EMAIL);
  return { org, orgAdminToken, client, daughterId, familyToken: tokens.access.token };
}

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Family mobile portal (HTTP E2E)', () => {
  beforeEach(async () => {
    await clearDatabase();
    emailService.clearCapturedEmails();
  });

  describe('Portal settings and invite gates', () => {
    test('orgAdmin cannot invite when family portal is disabled', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const { client, recipients } = await seedResidentWithRecipients(accessToken, clientOne, org._id);
      const daughterId = recipients.find((r) => r.email === DAUGHTER_EMAIL).id;
      await verifyRecipientViaEmail(accessToken, client.id, daughterId, DAUGHTER_EMAIL);

      const res = await request(app)
        .post(`/v1/clients/${client.id}/family-portal/invite`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ recipientId: daughterId })
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body.message).toMatch(/not enabled/i);
    });

    test('orgAdmin cannot invite unverified digest recipient', async () => {
      const [org] = await insertOrgs([orgOne]);
      await enableFamilyPortal(org._id);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const { client, recipients } = await seedResidentWithRecipients(accessToken, clientOne, org._id);
      const daughterId = recipients.find((r) => r.email === DAUGHTER_EMAIL).id;

      const res = await request(app)
        .post(`/v1/clients/${client.id}/family-portal/invite`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ recipientId: daughterId })
        .expect(httpStatus.BAD_REQUEST);

      expect(res.body.message).toMatch(/verified/i);
    });

    test('staff cannot invite family portal users', async () => {
      const [org] = await insertOrgs([orgOne]);
      await enableFamilyPortal(org._id);
      const { accessToken: orgAdminToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const { accessToken: staffToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'staff');
      const { client, recipients } = await seedResidentWithRecipients(orgAdminToken, clientOne, org._id);
      const daughterId = recipients.find((r) => r.email === DAUGHTER_EMAIL).id;
      await verifyRecipientViaEmail(orgAdminToken, client.id, daughterId, DAUGHTER_EMAIL);

      await request(app)
        .post(`/v1/clients/${client.id}/family-portal/invite`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ recipientId: daughterId })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('Invite, register, and session shape', () => {
    test('verified recipient invite sends email; registerWithInvite yields family role and orgFamily session', async () => {
      const [org] = await insertOrgs([orgOne]);
      await enableFamilyPortal(org._id);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const { client, recipients } = await seedResidentWithRecipients(accessToken, clientOne, org._id);
      const daughterId = recipients.find((r) => r.email === DAUGHTER_EMAIL).id;
      await verifyRecipientViaEmail(accessToken, client.id, daughterId, DAUGHTER_EMAIL);

      emailService.clearCapturedEmails();
      await inviteRecipient(accessToken, client.id, daughterId);
      const captured = emailService.getLastCapturedEmail(DAUGHTER_EMAIL);
      expect(captured).toBeTruthy();
      const config = require('../../src/config/config');
      const mobileBase = (config.mobileAppUrl || '').replace(/\/$/, '');
      expect(captured.html).toContain(mobileBase);
      expect(captured.html).toContain('family=1');
      expect(captured.html).toContain('play.google.com');
      expect(extractInviteTokenFromEmail(captured)).toBeTruthy();

      const registerBody = await registerFamilyAccount(DAUGHTER_EMAIL, 'Sarah Family');
      expect(registerBody.caregiver.role).toBe('family');
      expect(registerBody.caregiver.accountMode).toBe('orgFamily');
      expect(registerBody.caregiver.linkedResidents).toHaveLength(1);
      expect(registerBody.caregiver.linkedResidents[0].clientId).toBe(client.id);

      const loginBody = await loginCaregiver(DAUGHTER_EMAIL);
      expect(loginBody.caregiver.role).toBe('family');
      expect(loginBody.caregiver.accountMode).toBe('orgFamily');
      expect(loginBody.alerts).toEqual([]);
      expect(loginBody.clients).toHaveLength(1);
      expect(loginBody.clients[0].id).toBe(client.id);
    });

    test('GET /auth/invite-info returns inviteType family for family portal invites', async () => {
      const [org] = await insertOrgs([orgOne]);
      await enableFamilyPortal(org._id);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const { client, recipients } = await seedResidentWithRecipients(accessToken, clientOne, org._id);
      const daughterId = recipients.find((r) => r.email === DAUGHTER_EMAIL).id;
      await verifyRecipientViaEmail(accessToken, client.id, daughterId, DAUGHTER_EMAIL);

      emailService.clearCapturedEmails();
      await inviteRecipient(accessToken, client.id, daughterId);
      const captured = emailService.getLastCapturedEmail(DAUGHTER_EMAIL);
      const inviteToken = extractInviteTokenFromEmail(captured);
      expect(inviteToken).toBeTruthy();

      const infoRes = await request(app)
        .get('/v1/auth/invite-info')
        .query({ token: inviteToken })
        .expect(httpStatus.OK);

      expect(infoRes.body.inviteType).toBe('family');
      expect(infoRes.body.email).toBe(DAUGHTER_EMAIL);
    });

    test('GET family-portal status reflects invited then active states', async () => {
      const [org] = await insertOrgs([orgOne]);
      await enableFamilyPortal(org._id);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const { client, recipients } = await seedResidentWithRecipients(accessToken, clientOne, org._id);
      const daughterId = recipients.find((r) => r.email === DAUGHTER_EMAIL).id;
      await verifyRecipientViaEmail(accessToken, client.id, daughterId, DAUGHTER_EMAIL);

      const beforeInvite = await request(app)
        .get(`/v1/clients/${client.id}/family-portal`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(beforeInvite.body.enabled).toBe(true);
      const rowBefore = beforeInvite.body.recipients.find((r) => r.recipientId === daughterId);
      expect(rowBefore.portalStatus).toBe('not_invited');

      emailService.clearCapturedEmails();
      await inviteRecipient(accessToken, client.id, daughterId);

      const afterInvite = await request(app)
        .get(`/v1/clients/${client.id}/family-portal`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);
      expect(afterInvite.body.recipients.find((r) => r.recipientId === daughterId).portalStatus).toBe('invited');

      await registerFamilyAccount(DAUGHTER_EMAIL, 'Sarah Family');

      const afterRegister = await request(app)
        .get(`/v1/clients/${client.id}/family-portal`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);
      expect(afterRegister.body.recipients.find((r) => r.recipientId === daughterId).portalStatus).toBe('active');
    });
  });

  describe('Per-resident linking', () => {
    test('daughter sees one resident; son sees two when linked to both', async () => {
      const [org] = await insertOrgs([orgOne]);
      await enableFamilyPortal(org._id);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');

      const residentA = await seedResidentWithRecipients(
        accessToken,
        { ...clientOne, email: 'resident-a@example.org', phone: '+16045624280' },
        org._id
      );
      const residentB = await seedResidentWithRecipients(
        accessToken,
        { ...clientTwo, email: 'resident-b@example.org', phone: '+16045624281' },
        org._id
      );

      const daughterAId = residentA.recipients.find((r) => r.email === DAUGHTER_EMAIL).id;
      const sonAId = residentA.recipients.find((r) => r.email === SON_EMAIL).id;
      const sonBId = residentB.recipients.find((r) => r.email === SON_EMAIL).id;

      await verifyRecipientViaEmail(accessToken, residentA.client.id, daughterAId, DAUGHTER_EMAIL);
      await verifyRecipientViaEmail(accessToken, residentA.client.id, sonAId, SON_EMAIL);
      await verifyRecipientViaEmail(accessToken, residentB.client.id, sonBId, SON_EMAIL);

      emailService.clearCapturedEmails();
      await inviteRecipient(accessToken, residentA.client.id, daughterAId);
      await registerFamilyAccount(DAUGHTER_EMAIL, 'Sarah Family');

      emailService.clearCapturedEmails();
      await inviteRecipient(accessToken, residentA.client.id, sonAId);
      await registerFamilyAccount(SON_EMAIL, 'Mike Family');
      await inviteRecipient(accessToken, residentB.client.id, sonBId);

      const daughterLogin = await loginCaregiver(DAUGHTER_EMAIL);
      expect(daughterLogin.clients).toHaveLength(1);
      expect(daughterLogin.clients[0].id).toBe(residentA.client.id);
      expect(daughterLogin.caregiver.linkedResidents).toHaveLength(1);

      const sonLogin = await loginCaregiver(SON_EMAIL);
      expect(sonLogin.clients).toHaveLength(2);
      const sonClientIds = sonLogin.clients.map((c) => c.id).sort();
      expect(sonClientIds).toEqual([residentA.client.id, residentB.client.id].sort());
      expect(sonLogin.caregiver.linkedResidents).toHaveLength(2);

      const daughterToken = daughterLogin.tokens.access.token;
      const listRes = await request(app)
        .get('/v1/clients')
        .set('Authorization', `Bearer ${daughterToken}`)
        .expect(httpStatus.OK);
      expect(listRes.body.results).toHaveLength(1);

      const sonToken = sonLogin.tokens.access.token;
      const sonListRes = await request(app)
        .get('/v1/clients')
        .set('Authorization', `Bearer ${sonToken}`)
        .expect(httpStatus.OK);
      expect(sonListRes.body.results).toHaveLength(2);

      await request(app)
        .get(`/v1/clients/${residentB.client.id}`)
        .set('Authorization', `Bearer ${daughterToken}`)
        .expect(httpStatus.FORBIDDEN);

      await seedCall(residentA.client.id);
      const convLinked = await request(app)
        .get(`/v1/clients/${residentA.client.id}/conversations`)
        .set('Authorization', `Bearer ${daughterToken}`)
        .expect(httpStatus.OK);
      expect(convLinked.body.results.length).toBeGreaterThanOrEqual(1);

      await request(app)
        .get(`/v1/clients/${residentB.client.id}/conversations`)
        .set('Authorization', `Bearer ${daughterToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('Family weekly digests and alerts', () => {
    test('family user reads sent digests only; cannot preview or create', async () => {
      const [org] = await insertOrgs([orgOne]);
      await enableFamilyPortal(org._id);
      const { accessToken: orgAdminToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const { client, recipients } = await seedResidentWithRecipients(orgAdminToken, clientOne, org._id);
      const daughterId = recipients.find((r) => r.email === DAUGHTER_EMAIL).id;
      await verifyRecipientViaEmail(orgAdminToken, client.id, daughterId, DAUGHTER_EMAIL);

      emailService.clearCapturedEmails();
      await inviteRecipient(orgAdminToken, client.id, daughterId);
      await registerFamilyAccount(DAUGHTER_EMAIL, 'Sarah Family');
      const { tokens } = await loginCaregiver(DAUGHTER_EMAIL);
      const familyToken = tokens.access.token;

      const digestId = await createAndSendDigest(orgAdminToken, client.id);

      await request(app)
        .post('/v1/family-weekly-digests/preview')
        .set('Authorization', `Bearer ${familyToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.FORBIDDEN);

      await request(app)
        .post('/v1/family-weekly-digests')
        .set('Authorization', `Bearer ${familyToken}`)
        .send({ clientId: client.id, weekStart: '2026-04-01' })
        .expect(httpStatus.FORBIDDEN);

      const listRes = await request(app)
        .get('/v1/family-weekly-digests')
        .query({ clientId: client.id, limit: 10, page: 1 })
        .set('Authorization', `Bearer ${familyToken}`)
        .expect(httpStatus.OK);

      expect(listRes.body.results).toHaveLength(1);
      expect(listRes.body.results[0].status).toBe('sent');
      expect(listRes.body.results[0].id).toBe(digestId);

      await request(app)
        .get(`/v1/family-weekly-digests/${digestId}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .expect(httpStatus.OK);

      await seedCall(client.id);
      const draftCreate = await request(app)
        .post('/v1/family-weekly-digests')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: client.id, weekStart: '2026-04-01' })
        .expect(httpStatus.CREATED);
      const draftId = draftCreate.body.digest.id;

      await request(app)
        .get(`/v1/family-weekly-digests/${draftId}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .expect(httpStatus.FORBIDDEN);

      const relistRes = await request(app)
        .get('/v1/family-weekly-digests')
        .query({ clientId: client.id, limit: 10, page: 1 })
        .set('Authorization', `Bearer ${familyToken}`)
        .expect(httpStatus.OK);
      expect(relistRes.body.results).toHaveLength(1);
      expect(relistRes.body.results[0].id).toBe(digestId);
    });

    test('family GET /alerts returns empty array even when org has alerts', async () => {
      const [org] = await insertOrgs([orgOne]);
      await enableFamilyPortal(org._id);
      const { accessToken: orgAdminToken, caregiver: orgAdmin } =
        await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const { client, recipients } = await seedResidentWithRecipients(orgAdminToken, clientOne, org._id);
      const daughterId = recipients.find((r) => r.email === DAUGHTER_EMAIL).id;
      await verifyRecipientViaEmail(orgAdminToken, client.id, daughterId, DAUGHTER_EMAIL);

      await insertAlerts(orgAdmin, 'Caregiver', [alertOne]);

      emailService.clearCapturedEmails();
      await inviteRecipient(orgAdminToken, client.id, daughterId);
      await registerFamilyAccount(DAUGHTER_EMAIL, 'Sarah Family');
      const { tokens } = await loginCaregiver(DAUGHTER_EMAIL);

      const orgAlerts = await request(app)
        .get('/v1/alerts')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .expect(httpStatus.OK);
      expect(orgAlerts.body.length).toBeGreaterThan(0);

      const familyAlerts = await request(app)
        .get('/v1/alerts')
        .set('Authorization', `Bearer ${tokens.access.token}`)
        .expect(httpStatus.OK);
      expect(familyAlerts.body).toEqual([]);
    });
  });

  describe('Revoke access', () => {
    test('revoke removes family link and blocks client access', async () => {
      const [org] = await insertOrgs([orgOne]);
      await enableFamilyPortal(org._id);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const { client, recipients } = await seedResidentWithRecipients(accessToken, clientOne, org._id);
      const daughterId = recipients.find((r) => r.email === DAUGHTER_EMAIL).id;
      await verifyRecipientViaEmail(accessToken, client.id, daughterId, DAUGHTER_EMAIL);

      emailService.clearCapturedEmails();
      await inviteRecipient(accessToken, client.id, daughterId);
      await registerFamilyAccount(DAUGHTER_EMAIL, 'Sarah Family');
      const { tokens } = await loginCaregiver(DAUGHTER_EMAIL);

      await request(app)
        .post(`/v1/clients/${client.id}/family-portal/revoke`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ recipientId: daughterId })
        .expect(httpStatus.OK);

      const activeLinks = await FamilyResidentLink.find({
        client: client.id,
        recipientId: daughterId,
        revokedAt: null,
      });
      expect(activeLinks).toHaveLength(0);

      const statusRes = await request(app)
        .get(`/v1/clients/${client.id}/family-portal`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);
      expect(statusRes.body.recipients.find((r) => r.recipientId === daughterId).portalStatus).toBe('not_invited');

      await request(app)
        .get(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${tokens.access.token}`)
        .expect(httpStatus.FORBIDDEN);

      const listRes = await request(app)
        .get('/v1/clients')
        .set('Authorization', `Bearer ${tokens.access.token}`)
        .expect(httpStatus.OK);
      expect(listRes.body.results).toHaveLength(0);
    });
  });

  describe('Schedule write protection', () => {
    test('family role cannot create or patch schedules for linked resident', async () => {
      const { orgAdminToken, client, familyToken } = await setupActiveFamilyUser();
      const scheduleId = await seedScheduleForClient(orgAdminToken, client.id);

      await request(app)
        .post(`/v1/schedules/clients/${client.id}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .send({
          frequency: 'daily',
          intervals: [{ day: 1, weeks: 1 }],
          time: '09:00',
        })
        .expect(httpStatus.FORBIDDEN);

      await request(app)
        .patch(`/v1/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .send({ frequency: 'daily', intervals: [{ day: 2, weeks: 1 }] })
        .expect(httpStatus.FORBIDDEN);

      await request(app)
        .delete(`/v1/schedules/${scheduleId}`)
        .set('Authorization', `Bearer ${familyToken}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('Emergency SMS recipient policy', () => {
    test('family caregiver on client roster is excluded from SMS recipients', async () => {
      const { client } = await setupActiveFamilyUser();
      const { emergencyProcessor } = require('../../src/services/emergencyProcessor.service');

      const smsRecipients = await emergencyProcessor.getClientCaregivers(client.id);
      const roles = smsRecipients.map((c) => c.role);

      expect(roles).not.toContain('family');
      expect(smsRecipients.every((c) => c.phone)).toBe(true);
    });
  });

  describe('Regression: orgAdmin workflow unchanged', () => {
    test('orgAdmin still lists clients, receives alerts, and manages digests', async () => {
      const [org] = await insertOrgs([orgOne]);
      await enableFamilyPortal(org._id);
      const { accessToken, caregiver: orgAdmin } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const { client, recipients } = await seedResidentWithRecipients(accessToken, clientOne, org._id);
      const daughterId = recipients.find((r) => r.email === DAUGHTER_EMAIL).id;
      await verifyRecipientViaEmail(accessToken, client.id, daughterId, DAUGHTER_EMAIL);

      await insertAlerts(orgAdmin, 'Caregiver', [alertOne]);

      const clientsRes = await request(app)
        .get('/v1/clients')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);
      expect(clientsRes.body.results.length).toBeGreaterThanOrEqual(1);

      const alertsRes = await request(app)
        .get('/v1/alerts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);
      expect(alertsRes.body.length).toBeGreaterThan(0);

      await seedCall(client.id);
      const previewRes = await request(app)
        .post('/v1/family-weekly-digests/preview')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.OK);
      expect(previewRes.body.eligibility).toBeDefined();
    });
  });
});
