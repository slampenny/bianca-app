require('../utils/integration-setup');

const request = require('supertest');
const httpStatus = require('http-status');
const jwt = require('jsonwebtoken');
const moment = require('moment');
const app = require('../utils/integration-app');
const config = require('../../src/config/config');
const {
  Org,
  Client,
  Caregiver,
  Token,
  Call,
  Conversation,
  FamilyWeeklyDigest,
  AuditLog,
} = require('../../src/models');
const { orgOne, insertOrgs } = require('../fixtures/org.fixture');
const { insertCaregivertoOrgAndReturnTokenByRole, insertCaregivertoOrgAndReturnToken, admin } = require('../fixtures/caregiver.fixture');
const { tokenTypes } = require('../../src/config/tokens');
const tokenService = require('../../src/services/token.service');
const emailService = require('../../src/services/email.service');
const { setupMongoMemoryServer, teardownMongoMemoryServer, clearDatabase } = require('../utils/mongodb-memory-server');

const WEEK_REF = '2026-03-25';
const RESIDENT_PHI_NAME = 'Secret Resident PHI Name';
const CALL_SUMMARY_PHI = 'Patient discussed chest pain and medication dosage.';

function extractVerifyTokenFromEmail(captured) {
  const body = `${captured.text || ''}\n${captured.html || ''}`;
  const match = body.match(/family-digest-email\/verify\?token=([^&\s"'<>]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function waitForAudit(filter, { tries = 20, delayMs = 25 } = {}) {
  for (let i = 0; i < tries; i += 1) {
    const doc = await AuditLog.findOne(filter).sort({ timestamp: -1 });
    if (doc) return doc;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return null;
}

async function seedClient(org, caregiver, overrides = {}) {
  const client = await Client.create({
    name: RESIDENT_PHI_NAME,
    firstName: 'Secret',
    lastName: 'Resident',
    email: 'resident-secret@example.org',
    phone: '+16045624264',
    org: org._id,
    caregivers: caregiver ? [caregiver._id] : [],
    consented: true,
    emergencyContact: {
      name: 'Sarah M.',
      relationship: 'daughter',
      email: 'family@test.com',
      familyDigestEmail: {
        enabled: true,
        verifiedAt: null,
        verifiedEmail: null,
      },
    },
    ...overrides,
  });
  if (caregiver) {
    caregiver.clients = [...(caregiver.clients || []), client._id];
    await caregiver.save();
  }
  return client;
}

async function seedCall(client, summary = CALL_SUMMARY_PHI) {
  const weekStart = new Date('2026-03-23T07:00:00.000Z');
  const call = await Call.create({
    callSid: `CA${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    clientId: client._id,
    status: 'completed',
    callOutcome: 'answered',
    duration: 240,
    startTime: new Date(weekStart.getTime() + 86400000),
  });
  await Conversation.create({
    callId: call._id,
    clientId: client._id,
    summary,
    history: summary,
  });
  return call;
}

async function verifyContactViaEmail(orgAdminToken, clientId) {
  await request(app)
    .post(`/v1/clients/${clientId}/family-digest-email/verification`)
    .set('Authorization', `Bearer ${orgAdminToken}`)
    .expect(httpStatus.OK);

  const captured = emailService.getLastCapturedEmail('family@test.com');
  expect(captured).toBeTruthy();
  const verifyToken = extractVerifyTokenFromEmail(captured);
  expect(verifyToken).toBeTruthy();

  await request(app)
    .get('/v1/clients/family-digest-email/verify')
    .query({ token: verifyToken })
    .set('Accept', 'application/json')
    .expect(httpStatus.OK);
}

beforeAll(async () => {
  await setupMongoMemoryServer();
});

afterAll(async () => {
  await teardownMongoMemoryServer();
});

describe('Family weekly digest HTTP integration', () => {
  beforeEach(async () => {
    await clearDatabase();
    emailService.clearCapturedEmails();
  });

  describe('POST /v1/clients/:clientId/family-digest-email/verification', () => {
    test('orgAdmin can send verification email', async () => {
      const [org] = await insertOrgs([{ ...orgOne, name: 'Sunrise Care Home' }]);
      const { accessToken, caregiver } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const client = await seedClient(org, caregiver);

      const res = await request(app)
        .post(`/v1/clients/${client.id}/family-digest-email/verification`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      const tokenDoc = await Token.findOne({
        client: client._id,
        type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY,
      });
      expect(tokenDoc).toBeTruthy();
    });

    test('staff cannot send verification email', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken: staffToken, caregiver: staff } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'staff');
      const client = await seedClient(org, staff);

      await request(app)
        .post(`/v1/clients/${client.id}/family-digest-email/verification`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(httpStatus.FORBIDDEN);
    });

    test('verification email contains org name only — no resident PHI or digest content', async () => {
      const [org] = await insertOrgs([{ ...orgOne, name: 'Sunrise Care Home' }]);
      const { accessToken, caregiver } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const client = await seedClient(org, caregiver);
      await seedCall(client);

      await request(app)
        .post(`/v1/clients/${client.id}/family-digest-email/verification`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      const captured = emailService.getLastCapturedEmail('family@test.com');
      expect(captured).toBeTruthy();
      const body = `${captured.subject || ''}\n${captured.text || ''}\n${captured.html || ''}`;

      expect(body).toMatch(/Sunrise Care Home/i);
      expect(body).toMatch(/weekly family digest/i);
      expect(body).not.toMatch(new RegExp(RESIDENT_PHI_NAME, 'i'));
      expect(body).not.toMatch(/chest pain/i);
      expect(body).not.toMatch(/medication dosage/i);
      expect(body).not.toMatch(/Sunday evening check-in/i);
    });
  });

  describe('GET /v1/clients/family-digest-email/verify', () => {
    test('valid token verifies emergency contact email', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken, caregiver } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const client = await seedClient(org, caregiver);

      await request(app)
        .post(`/v1/clients/${client.id}/family-digest-email/verification`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(httpStatus.OK);

      const captured = emailService.getLastCapturedEmail('family@test.com');
      const verifyToken = extractVerifyTokenFromEmail(captured);

      const res = await request(app)
        .get('/v1/clients/family-digest-email/verify')
        .query({ token: verifyToken })
        .set('Accept', 'application/json')
        .expect(httpStatus.OK);

      expect(res.body.success).toBe(true);
      const updated = await Client.findById(client._id);
      expect(updated.emergencyContact.familyDigestEmail.verifiedAt).toBeTruthy();
      expect(updated.emergencyContact.familyDigestEmail.verifiedEmail).toBe('family@test.com');
    });

    test('expired token fails', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { caregiver } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const client = await seedClient(org, caregiver);

      const expires = moment().subtract(1, 'minute');
      const payload = {
        sub: client.id,
        email: 'family@test.com',
        iat: moment().unix(),
        exp: expires.unix(),
        type: tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY,
      };
      const expiredToken = jwt.sign(payload, config.jwt.secret);
      await tokenService.saveToken(
        expiredToken,
        null,
        expires,
        tokenTypes.FAMILY_DIGEST_EMAIL_VERIFY,
        false,
        client._id
      );

      await request(app)
        .get('/v1/clients/family-digest-email/verify')
        .query({ token: expiredToken })
        .set('Accept', 'application/json')
        .expect(httpStatus.UNAUTHORIZED);
    });

    test('invalid token fails', async () => {
      await request(app)
        .get('/v1/clients/family-digest-email/verify')
        .query({ token: 'not-a-valid-token' })
        .set('Accept', 'application/json')
        .expect(httpStatus.UNAUTHORIZED);
    });
  });

  describe('Family digest preview / create / send lifecycle', () => {
    test('preview eligibility false before verification; true after opt-in + verification', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken: orgAdminToken, caregiver } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const client = await seedClient(org, caregiver);
      await seedCall(client);

      const previewBefore = await request(app)
        .post('/v1/family-weekly-digests/preview')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.OK);

      expect(previewBefore.body.eligibility.ok).toBe(false);
      expect(previewBefore.body.eligibility.reasons.some((r) => /verified/i.test(r))).toBe(true);

      await verifyContactViaEmail(orgAdminToken, client.id);

      const previewAfter = await request(app)
        .post('/v1/family-weekly-digests/preview')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.OK);

      expect(previewAfter.body.eligibility.ok).toBe(true);
    });

    test('create blocked before verification; succeeds after verification; second send blocked', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken: orgAdminToken, caregiver } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const client = await seedClient(org, caregiver);
      await seedCall(client);

      await request(app)
        .post('/v1/family-weekly-digests')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.BAD_REQUEST);

      await verifyContactViaEmail(orgAdminToken, client.id);

      const createRes = await request(app)
        .post('/v1/family-weekly-digests')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.CREATED);

      expect(createRes.body.eligibility.ok).toBe(true);
      const digestId = createRes.body.digest.id;

      const sendRes = await request(app)
        .post(`/v1/family-weekly-digests/${digestId}/send`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .expect(httpStatus.OK);

      expect(sendRes.body.status).toBe('sent');

      await request(app)
        .post(`/v1/family-weekly-digests/${digestId}/send`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .expect(httpStatus.BAD_REQUEST);
    });
  });

  describe('Cross-org access', () => {
    test('orgAdmin cannot access another org client digest routes', async () => {
      const [orgA, orgB] = await insertOrgs([
        { ...orgOne, name: 'Org A', email: 'orga@example.org' },
        { ...orgOne, name: 'Org B', email: 'orgb@example.org' },
      ]);
      const { accessToken: orgAdminAToken } = await insertCaregivertoOrgAndReturnTokenByRole(orgA, 'orgAdmin');
      const { caregiver: orgAdminB } = await insertCaregivertoOrgAndReturnToken(
        orgB,
        { ...admin, email: 'admin-b@example.org' }
      );
      const clientB = await seedClient(orgB, orgAdminB);
      await seedCall(clientB);

      await request(app)
        .post(`/v1/clients/${clientB.id}/family-digest-email/verification`)
        .set('Authorization', `Bearer ${orgAdminAToken}`)
        .expect(httpStatus.FORBIDDEN);

      await request(app)
        .post('/v1/family-weekly-digests/preview')
        .set('Authorization', `Bearer ${orgAdminAToken}`)
        .send({ clientId: clientB.id, weekStart: WEEK_REF })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('Audit log behavior', () => {
    test('preview/create/send are audited with PHI flags; send is high-risk export', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken: orgAdminToken, caregiver } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const client = await seedClient(org, caregiver);
      await seedCall(client);
      await verifyContactViaEmail(orgAdminToken, client.id);

      await request(app)
        .post('/v1/family-weekly-digests/preview')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.OK);

      const previewAudit = await waitForAudit({
        action: 'READ',
        resource: 'familyDigest',
      });
      expect(previewAudit).toBeTruthy();
      expect(previewAudit.complianceFlags.phiAccessed).toBe(true);
      expect(previewAudit.complianceFlags.highRiskAction).toBe(false);

      const createRes = await request(app)
        .post('/v1/family-weekly-digests')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.CREATED);

      const createAudit = await waitForAudit({
        action: 'CREATE',
        resource: 'familyDigest',
      });
      expect(createAudit).toBeTruthy();
      expect(createAudit.complianceFlags.phiAccessed).toBe(true);
      expect(createAudit.complianceFlags.highRiskAction).toBe(true);

      await request(app)
        .post(`/v1/family-weekly-digests/${createRes.body.digest.id}/send`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .expect(httpStatus.OK);

      const sendAudit = await waitForAudit({
        action: 'EXPORT',
        resource: 'familyDigest',
      });
      expect(sendAudit).toBeTruthy();
      expect(sendAudit.complianceFlags.phiAccessed).toBe(true);
      expect(sendAudit.complianceFlags.highRiskAction).toBe(true);
    });

    test('verification email request and verify success/failure are audited without PHI', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken: orgAdminToken, caregiver } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const client = await seedClient(org, caregiver);

      await request(app)
        .post(`/v1/clients/${client.id}/family-digest-email/verification`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .expect(httpStatus.OK);

      const requestAudit = await waitForAudit({
        action: 'CREATE',
        resource: 'client',
      });
      expect(requestAudit).toBeTruthy();
      expect(requestAudit.complianceFlags.phiAccessed).toBe(false);
      expect(requestAudit.metadata.get('category')).toBe('family_digest_verification');

      const captured = emailService.getLastCapturedEmail('family@test.com');
      const verifyToken = extractVerifyTokenFromEmail(captured);

      await request(app)
        .get('/v1/clients/family-digest-email/verify')
        .query({ token: verifyToken })
        .set('Accept', 'application/json')
        .expect(httpStatus.OK);

      const successAudit = await waitForAudit({
        action: 'UPDATE',
        resource: 'client',
        outcome: 'SUCCESS',
      });
      expect(successAudit).toBeTruthy();
      expect(successAudit.complianceFlags.phiAccessed).toBe(false);
      expect(successAudit.metadata.get('category')).toBe('family_digest_verification');
      expect(JSON.stringify(successAudit)).not.toMatch(verifyToken);

      await request(app)
        .get('/v1/clients/family-digest-email/verify')
        .query({ token: 'not-a-valid-token' })
        .set('Accept', 'application/json')
        .expect(httpStatus.UNAUTHORIZED);

      const failureAudit = await waitForAudit({
        action: 'UPDATE',
        resource: 'client',
        outcome: 'FAILURE',
      });
      expect(failureAudit).toBeTruthy();
      expect(failureAudit.metadata.get('category')).toBe('family_digest_verification');
      expect(JSON.stringify(failureAudit)).not.toContain('not-a-valid-token');
    });
  });

  describe('Eligibility regression', () => {
    test('preview allowed when ineligible; create blocked; send blocked after verify+create when eligibility lost', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken: orgAdminToken, caregiver } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const client = await seedClient(org, caregiver, {
        consented: false,
        emergencyContact: {
          name: 'Sarah M.',
          relationship: 'daughter',
          email: 'family@test.com',
          familyDigestEmail: { enabled: false, verifiedAt: null, verifiedEmail: null },
        },
      });
      await seedCall(client);

      const previewRes = await request(app)
        .post('/v1/family-weekly-digests/preview')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.OK);

      expect(previewRes.body.eligibility.ok).toBe(false);

      await request(app)
        .post('/v1/family-weekly-digests')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.BAD_REQUEST);

      await Client.findByIdAndUpdate(client.id, {
        consented: true,
        'emergencyContact.familyDigestEmail.enabled': true,
      });
      await verifyContactViaEmail(orgAdminToken, client.id);

      const createRes = await request(app)
        .post('/v1/family-weekly-digests')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.CREATED);

      await Client.findByIdAndUpdate(client.id, { consented: false });

      await request(app)
        .post(`/v1/family-weekly-digests/${createRes.body.digest.id}/send`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .expect(httpStatus.BAD_REQUEST);
    });

    test('create blocked for missing and invalid emergency email', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken: orgAdminToken, caregiver } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const clientMissing = await seedClient(org, caregiver);
      await Client.findByIdAndUpdate(clientMissing.id, {
        'emergencyContact.email': '',
      });
      await seedCall(clientMissing);

      await request(app)
        .post('/v1/family-weekly-digests')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: clientMissing.id, weekStart: WEEK_REF })
        .expect(httpStatus.BAD_REQUEST);

      const clientInvalid = await seedClient(org, caregiver, {
        emergencyContact: {
          name: 'Sarah M.',
          relationship: 'daughter',
          email: 'bad-email@test.com',
          familyDigestEmail: { enabled: true, verifiedAt: new Date(), verifiedEmail: 'bad-email@test.com' },
        },
      });
      await Client.findByIdAndUpdate(clientInvalid.id, {
        'emergencyContact.email': 'not-an-email',
        'emergencyContact.familyDigestEmail.verifiedEmail': 'not-an-email',
      });
      await seedCall(clientInvalid);

      await request(app)
        .post('/v1/family-weekly-digests')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: clientInvalid.id, weekStart: WEEK_REF })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('create blocked when email changed after verification', async () => {
      const [org] = await insertOrgs([orgOne]);
      const { accessToken: orgAdminToken, caregiver } = await insertCaregivertoOrgAndReturnTokenByRole(org, 'orgAdmin');
      const client = await seedClient(org, caregiver);
      await seedCall(client);
      await verifyContactViaEmail(orgAdminToken, client.id);

      await Client.findByIdAndUpdate(client.id, {
        'emergencyContact.email': 'newfamily@test.com',
      });

      await request(app)
        .post('/v1/family-weekly-digests')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ clientId: client.id, weekStart: WEEK_REF })
        .expect(httpStatus.BAD_REQUEST);
    });
  });
});
