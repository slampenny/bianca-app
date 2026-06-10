/**
 * End-to-end HTTP integration: emergency contacts + family digest recipients.
 * Uses real services; only external deps are mocked via integration-setup (agenda, OpenAI, AWS, etc.).
 */
require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const app = require('../utils/integration-app');
const { Org, Client, Caregiver, Call, Conversation, FamilyWeeklyDigest } = require('../../src/models');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { clientOne, insertClientsWithOrg, insertClientsAndAddToCaregiver } = require('../fixtures/client.fixture');
const { insertCaregivertoOrgAndReturnTokenByRole } = require('../fixtures/caregiver.fixture');
const emailService = require('../../src/services/email.service');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

const WEEK_REF = '2026-03-25';

function extractVerifyTokenFromEmail(captured) {
  const body = `${captured.text || ''}\n${captured.html || ''}`;
  const match = body.match(/family-digest-email\/verify\?token=([^&\s"'<>]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function verifyRecipientViaEmail(orgAdminToken, clientId, recipientId, email) {
  await request(app)
    .post(`/v1/clients/${clientId}/family-digest-email/verification`)
    .set('Authorization', `Bearer ${orgAdminToken}`)
    .send(recipientId ? { recipientId } : {})
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

const contactsPatchBody = {
  emergencyContacts: [
    { name: 'Bob Helper', relationship: 'Son', phone: '+16045550101', email: 'bob.helper@example.org' },
    { name: 'Jane Helper', relationship: 'Daughter', phone: '+16045550102', email: 'jane.helper@example.org' },
  ],
  familyDigestRecipients: [
    {
      name: 'Sarah Family',
      relationship: 'daughter',
      email: 'daughter@family.test',
      familyDigestEmail: { enabled: true },
    },
    {
      name: 'Mike Family',
      relationship: 'son',
      email: 'son@family.test',
      familyDigestEmail: { enabled: true },
    },
  ],
};

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Client contacts & family digest recipients (HTTP E2E)', () => {
  beforeEach(async () => {
    await clearDatabase();
    emailService.clearCapturedEmails();
  });

  describe('PATCH /v1/clients/:clientId → GET profile & list', () => {
    test('orgAdmin saves multiple emergency contacts and digest recipients; GET returns them through minimum-necessary filter', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const [client] = await insertClientsWithOrg(
        [{ ...clientOne, email: 'contacts-e2e@example.org', phone: '+16045624270' }],
        org._id
      );

      const patchRes = await request(app)
        .patch(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(contactsPatchBody)
        .expect(httpStatus.OK);

      expect(patchRes.body.emergencyContacts).toHaveLength(2);
      expect(patchRes.body.familyDigestRecipients).toHaveLength(2);
      expect(patchRes.body.emergencyContacts[0]).toMatchObject({
        name: 'Bob Helper',
        phone: '+16045550101',
      });
      expect(patchRes.body.familyDigestRecipients[0].email).toBe('daughter@family.test');

      const getRes = await request(app)
        .get(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(getRes.body.emergencyContacts).toHaveLength(2);
      expect(getRes.body.familyDigestRecipients).toHaveLength(2);
      expect(getRes.body.emergencyContacts[1].name).toBe('Jane Helper');
      expect(getRes.body.familyDigestRecipients[1].email).toBe('son@family.test');
      expect(getRes.body.emergencyContact.name).toBe('Bob Helper');

      const listRes = await request(app)
        .get('/v1/clients')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ limit: 50, page: 1 })
        .expect(httpStatus.OK);

      const row = listRes.body.results.find((r) => r.id === client.id);
      expect(row).toBeTruthy();
      expect(row.emergencyContacts).toHaveLength(2);
      expect(row.familyDigestRecipients).toHaveLength(2);
    });

    test('staff on roster can read contacts but cannot modify familyDigestRecipients via PATCH', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken: orgAdminToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const { accessToken: staffToken, caregiver: staff } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'staff');
      const [client] = await insertClientsAndAddToCaregiver(staff, [
        { ...clientOne, email: 'staff-contacts@example.org', phone: '+16045624271' },
      ]);

      await request(app)
        .patch(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send(contactsPatchBody)
        .expect(httpStatus.OK);

      const staffGet = await request(app)
        .get(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(httpStatus.OK);

      expect(staffGet.body.familyDigestRecipients).toHaveLength(2);
      expect(staffGet.body.emergencyContacts).toHaveLength(2);

      await request(app)
        .patch(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          familyDigestRecipients: [
            {
              name: 'Hacker',
              relationship: 'none',
              email: 'evil@test.com',
              familyDigestEmail: { enabled: true },
            },
          ],
          emergencyContacts: [{ name: 'Staff Updated', relationship: 'Friend', phone: '+16045550999', email: '' }],
        })
        .expect(httpStatus.OK);

      const afterStaffPatch = await request(app)
        .get(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .expect(httpStatus.OK);

      expect(afterStaffPatch.body.familyDigestRecipients).toHaveLength(2);
      expect(afterStaffPatch.body.familyDigestRecipients[0].email).toBe('daughter@family.test');
      expect(afterStaffPatch.body.emergencyContacts[0].name).toBe('Staff Updated');
    });

    test('PATCH merges existing digest recipients by id and clears verification when email changes', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const [client] = await insertClientsWithOrg(
        [{ ...clientOne, email: 'merge-recipient@example.org', phone: '+16045624272' }],
        org._id
      );

      const firstPatch = await request(app)
        .patch(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          familyDigestRecipients: [
            {
              name: 'Sarah',
              relationship: 'daughter',
              email: 'daughter@family.test',
              familyDigestEmail: { enabled: true },
            },
          ],
        })
        .expect(httpStatus.OK);

      const recipientId = firstPatch.body.familyDigestRecipients[0].id;
      await verifyRecipientViaEmail(accessToken, client.id, recipientId, 'daughter@family.test');

      const secondPatch = await request(app)
        .patch(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          familyDigestRecipients: [
            {
              id: recipientId,
              name: 'Sarah',
              relationship: 'daughter',
              email: 'new-daughter@family.test',
              familyDigestEmail: { enabled: true },
            },
          ],
        })
        .expect(httpStatus.OK);

      const fd = secondPatch.body.familyDigestRecipients[0];
      expect(fd.email).toBe('new-daughter@family.test');
      expect(fd.familyDigestEmail.verifiedAt).toBeNull();
      expect(fd.familyDigestEmail.verifiedEmail).toBeNull();
      expect(fd.familyDigestEmail.enabled).toBe(true);
    });
  });

  describe('Per-recipient verification', () => {
    test('verification email can target a specific familyDigestRecipient by recipientId', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const [client] = await insertClientsWithOrg(
        [{ ...clientOne, email: 'verify-by-id@example.org', phone: '+16045624273' }],
        org._id
      );

      const patchRes = await request(app)
        .patch(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(contactsPatchBody)
        .expect(httpStatus.OK);

      const secondRecipientId = patchRes.body.familyDigestRecipients.find((r) => r.email === 'son@family.test').id;
      await verifyRecipientViaEmail(accessToken, client.id, secondRecipientId, 'son@family.test');

      const updated = await Client.findById(client._id);
      const verified = updated.familyDigestRecipients.find((r) => String(r._id) === String(secondRecipientId));
      expect(verified.familyDigestEmail.verifiedEmail).toBe('son@family.test');
      expect(verified.familyDigestEmail.verifiedAt).toBeTruthy();

      const first = updated.familyDigestRecipients.find((r) => r.email === 'daughter@family.test');
      expect(first.familyDigestEmail.verifiedAt).toBeFalsy();
    });
  });

  describe('Family weekly digest with multiple recipients', () => {
    test('preview → create → send delivers email to each verified enabled recipient', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const [client] = await insertClientsWithOrg(
        [{ ...clientOne, email: 'multi-digest@example.org', phone: '+16045624274', consented: true }],
        org._id
      );

      const patchRes = await request(app)
        .patch(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(contactsPatchBody)
        .expect(httpStatus.OK);

      const recipients = patchRes.body.familyDigestRecipients;
      for (const recipient of recipients) {
        await verifyRecipientViaEmail(accessToken, client.id, recipient.id, recipient.email);
      }

      await seedCall(client._id);

      const previewRes = await request(app)
        .post('/v1/family-weekly-digests/preview')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.OK);

      expect(previewRes.body.eligibility.ok).toBe(true);

      const createRes = await request(app)
        .post('/v1/family-weekly-digests')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.CREATED);

      const digestId = createRes.body.digest.id;

      emailService.clearCapturedEmails();

      const sendRes = await request(app)
        .post(`/v1/family-weekly-digests/${digestId}/send`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(sendRes.body.status).toBe('sent');
      expect(emailService.getLastCapturedEmail('daughter@family.test')).toBeTruthy();
      expect(emailService.getLastCapturedEmail('son@family.test')).toBeTruthy();

      const digestDoc = await FamilyWeeklyDigest.findById(digestId);
      expect(digestDoc.emailRecipients).toEqual(
        expect.arrayContaining(['daughter@family.test', 'son@family.test'])
      );
    });

    test('sends digest only to verified recipients when the other is unverified', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const [client] = await insertClientsWithOrg(
        [{ ...clientOne, email: 'partial-verify@example.org', phone: '+16045624275', consented: true }],
        org._id
      );

      const patchRes = await request(app)
        .patch(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(contactsPatchBody)
        .expect(httpStatus.OK);

      const first = patchRes.body.familyDigestRecipients[0];
      await verifyRecipientViaEmail(accessToken, client.id, first.id, first.email);
      await seedCall(client._id);

      const previewRes = await request(app)
        .post('/v1/family-weekly-digests/preview')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.OK);

      expect(previewRes.body.eligibility.ok).toBe(true);

      const createRes = await request(app)
        .post('/v1/family-weekly-digests')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.CREATED);

      emailService.clearCapturedEmails();

      const sendRes = await request(app)
        .post(`/v1/family-weekly-digests/${createRes.body.digest.id}/send`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(sendRes.body.status).toBe('sent');
      expect(emailService.getLastCapturedEmail('daughter@family.test')).toBeTruthy();
      expect(emailService.getLastCapturedEmail('son@family.test')).toBeFalsy();
    });
  });

  describe('Legacy emergencyContact compatibility', () => {
    test('client with legacy emergencyContact only can verify and digest until arrays are configured', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken, caregiver } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');

      const client = await Client.create({
        ...clientOne,
        org: org._id,
        email: 'legacy-only@example.org',
        phone: '+16045624276',
        caregivers: [caregiver._id],
        consented: true,
        emergencyContact: {
          name: 'Legacy Contact',
          relationship: 'daughter',
          phone: '+16045550100',
          email: 'legacy-family@test.com',
          familyDigestEmail: { enabled: true, verifiedAt: null, verifiedEmail: null },
        },
      });
      caregiver.clients = [...(caregiver.clients || []), client._id];
      await caregiver.save();

      await verifyRecipientViaEmail(accessToken, client.id, null, 'legacy-family@test.com');
      await seedCall(client._id);

      const previewRes = await request(app)
        .post('/v1/family-weekly-digests/preview')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.OK);

      expect(previewRes.body.eligibility.ok).toBe(true);

      const getRes = await request(app)
        .get(`/v1/clients/${client.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(getRes.body.familyDigestRecipients).toHaveLength(1);
      expect(getRes.body.familyDigestRecipients[0].email).toBe('legacy-family@test.com');
    });
  });
});
