const httpStatus = require('http-status');
const ApiError = require('../utils/ApiError');
const { Org, Invoice, PaymentMethod, AuditLog, Client, Caregiver } = require('../models');
const {
  ALLOWED_HISTORY_DAYS,
  DEFAULT_HISTORY_DAYS,
  assertAllowedHistoryDays,
  wipeDemoOrgData,
  seedDemoOrgData,
  countOrgChildDocuments,
  DEMO_SEED_VERSION,
} = require('../scripts/seeders/demoOrg.seeder');

const SET_AS_DEMO_CONFIRM = 'SET_AS_DEMO_ORG';
const UNSET_DEMO_CONFIRM = 'UNSET_DEMO_ORG';
const REFRESH_DEMO_CONFIRM = 'REFRESH_DEMO_DATA';

async function writeDemoAudit({
  actorCaregiverId,
  action,
  orgId,
  outcome = 'SUCCESS',
  metadataObj = {},
  req = null,
}) {
  const actor = await Caregiver.findById(actorCaregiverId).select('role email').lean();
  const metadata = new Map();
  Object.entries(metadataObj).forEach(([k, v]) => {
    metadata.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  });
  await AuditLog.create({
    timestamp: new Date(),
    userId: actorCaregiverId,
    userRole: actor?.role || 'superAdmin',
    action,
    resource: 'org',
    resourceId: String(orgId),
    outcome,
    ipAddress: req?.ip || req?.connection?.remoteAddress || '127.0.0.1',
    userAgent: req?.get?.('user-agent') || 'demo-org-service',
    metadata,
    complianceFlags: {
      phiAccessed: false,
      highRiskAction: true,
      requiresReview: true,
    },
  });
}

/**
 * Hard refusal reasons if org cannot be marked isDemo.
 * Blocking: stripe subscription, any payment method, any invoice history.
 */
async function getDemoFlagBlockers(org) {
  const blockers = [];
  if (org.stripeSubscriptionId) {
    blockers.push('stripeSubscriptionId');
  }
  if (org.stripeSubscriptionItemId) {
    blockers.push('stripeSubscriptionItemId');
  }
  const [paymentMethodCount, invoiceCount] = await Promise.all([
    PaymentMethod.countDocuments({ org: org._id }),
    Invoice.countDocuments({ org: org._id }),
  ]);
  if (paymentMethodCount > 0) {
    blockers.push(`paymentMethods:${paymentMethodCount}`);
  }
  if (invoiceCount > 0) {
    blockers.push(`invoices:${invoiceCount}`);
  }
  return blockers;
}

async function assertEligibleToMarkAsDemo(org) {
  const blockers = await getDemoFlagBlockers(org);
  if (blockers.length > 0) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      `Cannot mark org as demo: org has billing history (${blockers.join(', ')}). ` +
        'Refuse isDemo=true when Stripe subscription, payment methods, or invoices exist.'
    );
  }
}

async function listDemoOrgs({ limit = 50, page = 1 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const pg = Math.max(Number(page) || 1, 1);
  const filter = { isDemo: true };
  const totalResults = await Org.countDocuments(filter);
  const orgs = await Org.find(filter)
    .sort({ name: 1 })
    .skip((pg - 1) * lim)
    .limit(lim);
  return {
    results: orgs,
    page: pg,
    limit: lim,
    totalPages: Math.ceil(totalResults / lim) || 0,
    totalResults,
  };
}

async function setOrgDemoFlag({ orgId, isDemo, confirm, actorCaregiverId, req = null }) {
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }

  const before = { isDemo: org.isDemo === true };

  if (isDemo === true) {
    if (confirm !== SET_AS_DEMO_CONFIRM) {
      throw new ApiError(httpStatus.BAD_REQUEST, `confirm must be exactly "${SET_AS_DEMO_CONFIRM}"`);
    }
    await assertEligibleToMarkAsDemo(org);
    org.isDemo = true;
  } else {
    if (confirm !== UNSET_DEMO_CONFIRM) {
      throw new ApiError(httpStatus.BAD_REQUEST, `confirm must be exactly "${UNSET_DEMO_CONFIRM}"`);
    }
    org.isDemo = false;
  }

  await org.save();
  const after = { isDemo: org.isDemo === true };

  await writeDemoAudit({
    actorCaregiverId,
    action: isDemo ? 'SET_ORG_IS_DEMO' : 'UNSET_ORG_IS_DEMO',
    orgId: org._id,
    metadataObj: { before, after, confirm },
    req,
  });

  return org;
}

async function refreshDemoOrgData({
  orgId,
  confirm,
  historyDays = DEFAULT_HISTORY_DAYS,
  actorCaregiverId,
  now = new Date(),
  req = null,
}) {
  if (confirm !== REFRESH_DEMO_CONFIRM) {
    throw new ApiError(httpStatus.BAD_REQUEST, `confirm must be exactly "${REFRESH_DEMO_CONFIRM}"`);
  }

  const days = assertAllowedHistoryDays(historyDays);
  const org = await Org.findById(orgId);
  if (!org) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Org not found');
  }
  if (org.isDemo !== true) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Demo data refresh is only allowed for organizations marked isDemo=true'
    );
  }

  const priorClients = await Client.find({ org: org._id }).select('_id').lean();
  const priorClientIds = priorClients.map((c) => String(c._id));

  const wipeResult = await wipeDemoOrgData(org._id);
  const seedResult = await seedDemoOrgData({
    orgId: org._id,
    historyDays: days,
    now,
    staffCaregiverId: null,
  });

  await writeDemoAudit({
    actorCaregiverId,
    action: 'REFRESH_DEMO_ORG_DATA',
    orgId: org._id,
    metadataObj: {
      historyDays: days,
      seedVersion: DEMO_SEED_VERSION,
      wipedClientIds: wipeResult.wipedClientIds,
      priorClientIds,
      seededClientIds: seedResult.clients.map((c) => c.id),
    },
    req,
  });

  return {
    ...seedResult,
    wipedClientIds: wipeResult.wipedClientIds,
  };
}

module.exports = {
  SET_AS_DEMO_CONFIRM,
  UNSET_DEMO_CONFIRM,
  REFRESH_DEMO_CONFIRM,
  ALLOWED_HISTORY_DAYS,
  DEFAULT_HISTORY_DAYS,
  getDemoFlagBlockers,
  assertEligibleToMarkAsDemo,
  listDemoOrgs,
  setOrgDemoFlag,
  refreshDemoOrgData,
  countOrgChildDocuments,
  wipeDemoOrgData,
  seedDemoOrgData,
};
