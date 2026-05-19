const { Caregiver, CorpEmailForward } = require('../models');
const emailService = require('./email.service');
const zohoMailService = require('./zohoMail.service');
const logger = require('../config/logger');

const CORP_DOMAIN = (process.env.CORP_EMAIL_DOMAIN || 'biancatechnologies.com').toLowerCase();

function corpDomainSuffix() {
  return `@${CORP_DOMAIN}`;
}

function isCorpEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
    .endsWith(corpDomainSuffix());
}

function suggestCorpEmail(caregiver) {
  if (isCorpEmail(caregiver.email)) {
    return caregiver.email.trim().toLowerCase();
  }
  const local = String(caregiver.email || '')
    .split('@')[0]
    .replace(/[^a-z0-9._-]/gi, '')
    .toLowerCase();
  if (!local) {
    return null;
  }
  return `${local}@${CORP_DOMAIN}`;
}

function buildGmailSetupEmail(corpEmail, forwardToEmail) {
  const smtpHost = process.env.CORP_MAIL_SMTP_HOST || 'smtp.zohocloud.ca';
  const subject = `Your ${corpEmail} mailbox is forwarding to ${forwardToEmail}`;
  const text = [
    `Your Bianca staff mailbox ${corpEmail} is now set to forward incoming mail to ${forwardToEmail}.`,
    '',
    'To reply as your @biancatechnologies.com address from Gmail:',
    '1. Open Gmail → Settings (gear) → See all settings → Accounts and Import.',
    '2. Under "Send mail as", click "Add another email address".',
    `3. Enter your name and ${corpEmail}.`,
    '4. Uncheck "Treat as an alias" if you want replies to show the corp address clearly.',
    `5. For SMTP: host ${smtpHost}, port 465, SSL on, username ${corpEmail}, password = your Zoho app password.`,
    '6. Complete verification (Zoho sends a code to your corp inbox; it should arrive at this Gmail via forwarding).',
    '',
    'After verification, when composing in Gmail use the From dropdown to choose your corp address.',
    '',
    'If you did not expect this change, contact your Bianca administrator.',
  ].join('\n');

  const html = `
    <p>Your Bianca staff mailbox <strong>${corpEmail}</strong> is now set to forward incoming mail to <strong>${forwardToEmail}</strong>.</p>
    <h3>Reply as ${corpEmail} from Gmail</h3>
    <ol>
      <li>Open Gmail → Settings → <strong>Accounts and Import</strong>.</li>
      <li>Under <strong>Send mail as</strong>, click <strong>Add another email address</strong>.</li>
      <li>Enter your name and <strong>${corpEmail}</strong>.</li>
      <li>SMTP: host <code>${smtpHost}</code>, port <code>465</code>, SSL on, username <code>${corpEmail}</code>, password = your Zoho app-specific password.</li>
      <li>Complete verification (the code is sent to your corp inbox and should appear in this Gmail via forwarding).</li>
    </ol>
    <p>When composing, use the <strong>From</strong> dropdown to select your corp address.</p>
    <p style="color:#666;font-size:12px;">If you did not expect this change, contact your Bianca administrator.</p>
  `;

  return { subject, text, html };
}

/**
 * List all super-admin staff with corp mailbox + forwarding settings.
 */
async function listStaffForwards() {
  const caregivers = await Caregiver.find({ role: 'superAdmin' })
    .select('name email role')
    .sort({ name: 1 })
    .lean();

  const forwards = await CorpEmailForward.find({}).lean();
  const byCaregiverId = new Map(
    forwards.filter((f) => f.caregiverId).map((f) => [String(f.caregiverId), f]),
  );
  const byCorpEmail = new Map(forwards.map((f) => [f.corpEmail, f]));

  const staff = caregivers.map((c) => {
    const id = String(c._id);
    const stored =
      byCaregiverId.get(id) ||
      (() => {
        const suggested = suggestCorpEmail(c);
        return suggested ? byCorpEmail.get(suggested) : null;
      })();

    const corpEmail = stored?.corpEmail || suggestCorpEmail(c) || '';
    return {
      caregiverId: id,
      name: c.name,
      loginEmail: c.email,
      corpEmail,
      forwardToEmail: stored?.forwardToEmail || null,
      updatedAt: stored?.updatedAt || null,
    };
  });

  const linkedCorp = new Set(staff.map((s) => s.corpEmail).filter(Boolean));
  const extras = forwards
    .filter((f) => !f.caregiverId || !staff.some((s) => String(f.caregiverId) === s.caregiverId))
    .filter((f) => !linkedCorp.has(f.corpEmail))
    .map((f) => ({
      caregiverId: f.caregiverId ? String(f.caregiverId) : null,
      name: f.corpEmail,
      loginEmail: null,
      corpEmail: f.corpEmail,
      forwardToEmail: f.forwardToEmail || null,
      updatedAt: f.updatedAt,
    }));

  return {
    domain: CORP_DOMAIN,
    zohoConfigured: zohoMailService.isConfigured(),
    staff: [...staff, ...extras],
  };
}

/**
 * Save forwarding changes; sync Zoho; notify destinations via corp mailbox.
 * @param {Array<{ caregiverId?: string, corpEmail: string, forwardToEmail?: string|null }>} updates
 * @param {string} updatedByCaregiverId
 */
async function saveStaffForwards(updates, updatedByCaregiverId) {
  const results = [];
  const suffix = corpDomainSuffix();

  for (const row of updates) {
    const corpEmail = String(row.corpEmail || '')
      .trim()
      .toLowerCase();
    if (!corpEmail || !corpEmail.endsWith(suffix)) {
      results.push({ corpEmail: row.corpEmail, ok: false, error: `corpEmail must be a ${CORP_DOMAIN} address` });
      continue;
    }

    const forwardToEmail = row.forwardToEmail
      ? String(row.forwardToEmail).trim().toLowerCase()
      : null;

    const filter = row.caregiverId
      ? { caregiverId: row.caregiverId }
      : { corpEmail };

    const existing = await CorpEmailForward.findOne(
      row.caregiverId ? { caregiverId: row.caregiverId } : { corpEmail },
    ).lean();

    const forwardChanged =
      String(existing?.forwardToEmail || '') !== String(forwardToEmail || '');

    const doc = await CorpEmailForward.findOneAndUpdate(
      filter,
      {
        corpEmail,
        forwardToEmail,
        caregiverId: row.caregiverId || existing?.caregiverId || null,
        updatedBy: updatedByCaregiverId,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    let zoho = { synced: false, reason: 'skipped' };
    if (forwardChanged) {
      try {
        zoho = await zohoMailService.syncForwardingForMailbox(corpEmail, forwardToEmail);
      } catch (err) {
        logger.warn(`[CorpEmailForward] Zoho sync failed for ${corpEmail}: ${err.message}`);
        zoho = { synced: false, reason: err.message };
      }
    }

    let notificationSent = false;
    if (forwardChanged && forwardToEmail) {
      try {
        const { subject, text, html } = buildGmailSetupEmail(corpEmail, forwardToEmail);
        await emailService.sendEmail(corpEmail, subject, text, html);
        notificationSent = true;
      } catch (err) {
        logger.warn(`[CorpEmailForward] Setup notification failed for ${corpEmail}: ${err.message}`);
      }
    }

    results.push({
      corpEmail: doc.corpEmail,
      forwardToEmail: doc.forwardToEmail,
      forwardChanged,
      zoho,
      notificationSent,
      ok: true,
    });
  }

  return { results };
}

module.exports = {
  CORP_DOMAIN,
  listStaffForwards,
  saveStaffForwards,
  suggestCorpEmail,
  isCorpEmail,
};
