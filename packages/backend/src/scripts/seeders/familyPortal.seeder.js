const mongoose = require('mongoose');
const { Org, Caregiver, FamilyResidentLink, FamilyWeeklyDigest } = require('../../models');
const { password: FAMILY_PORTAL_PASSWORD } = require('../../../tests/fixtures/caregiver.fixture');

/** E2E / dev login for org-family (facility digest recipient) mobile mode. */
const FAMILY_PORTAL_EMAIL = 'family.portal@example.org';

/**
 * Seed a facility family-portal account linked to one resident (client1).
 * Requires facility org, client1, and an org admin for invitedBy.
 */
async function seedFamilyPortalAccount(facilityOrg, client1, adminRecord) {
  console.log('Seeding facility family portal account...');

  const orgId = facilityOrg._id || facilityOrg.id;
  await Org.findByIdAndUpdate(orgId, {
    familyPortalSettings: { enabled: true, allowInviteAfterDigestVerify: true },
  });

  const recipientId = new mongoose.Types.ObjectId();
  const verifiedAt = new Date();

  client1.familyDigestRecipients = [
    {
      _id: recipientId,
      name: 'Martha Alphabet',
      relationship: 'daughter',
      email: FAMILY_PORTAL_EMAIL,
      familyDigestEmail: {
        enabled: true,
        verifiedAt,
        verifiedEmail: FAMILY_PORTAL_EMAIL,
      },
    },
  ];
  await client1.save();

  const familyCaregiver = await Caregiver.create({
    org: orgId,
    name: 'Martha Alphabet',
    email: FAMILY_PORTAL_EMAIL,
    phone: '+16045624270',
    role: 'family',
    password: FAMILY_PORTAL_PASSWORD,
    isEmailVerified: true,
    onboardingComplete: true,
    clients: [client1._id],
  });

  await Org.findByIdAndUpdate(orgId, { $addToSet: { caregivers: familyCaregiver._id } });

  const onRoster = (client1.caregivers || []).some((id) => String(id) === String(familyCaregiver._id));
  if (!onRoster) {
    client1.caregivers.push(familyCaregiver._id);
    await client1.save();
  }

  await FamilyResidentLink.create({
    caregiver: familyCaregiver._id,
    org: orgId,
    client: client1._id,
    recipientId,
    portalEnabled: true,
    invitedBy: adminRecord._id || adminRecord.id,
  });

  const weekStart = new Date('2026-03-23T07:00:00.000Z');
  const weekEnd = new Date('2026-03-30T06:59:59.999Z');
  await FamilyWeeklyDigest.create({
    org: orgId,
    client: client1._id,
    weekStart,
    weekEnd,
    localWeekKey: '2026-03-23',
    timezoneAtBuild: 'America/Los_Angeles',
    legacyUtcWeek: false,
    status: 'sent',
    sentAt: new Date(),
    emailRecipients: [FAMILY_PORTAL_EMAIL.toLowerCase()],
    emailRecipient: FAMILY_PORTAL_EMAIL.toLowerCase(),
    recipient: {
      name: 'Martha Alphabet',
      relationship: 'daughter',
      email: FAMILY_PORTAL_EMAIL,
    },
    payload: {
      version: 1,
      title: 'Weekly call digest for families',
      localWeekKey: '2026-03-23',
      atAGlance: {
        weekRangeLabel: 'Mar 23 – Mar 29, 2026',
        callsPlaced: 3,
        answeredCount: 2,
      },
      callRows: [],
      narrative: [],
      subtitleParts: {
        recipientLine: 'For Martha',
        residentLine: `Your loved one: ${client1.name}`,
      },
      eligibility: { ok: true, reasons: [], warnings: [] },
    },
    createdBy: adminRecord._id || adminRecord.id,
  });

  console.log(`Seeded family portal account: ${FAMILY_PORTAL_EMAIL} (linked to ${client1.name})`);
  return { familyCaregiver, recipientId, email: FAMILY_PORTAL_EMAIL };
}

module.exports = {
  seedFamilyPortalAccount,
  FAMILY_PORTAL_EMAIL,
  FAMILY_PORTAL_PASSWORD,
};
