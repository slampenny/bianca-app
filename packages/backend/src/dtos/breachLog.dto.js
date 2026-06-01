const { getJurisdiction } = require('../utils/jurisdiction.utils');

function mapCaregiverSummary(caregiver) {
  if (!caregiver) return null;
  const org = caregiver.org;
  return {
    id: caregiver._id?.toString() || caregiver.id,
    name: caregiver.name,
    email: caregiver.email,
    role: caregiver.role,
    orgId: org?._id?.toString() || org?.toString() || null,
    orgName: org?.name || null,
  };
}

function mapOrgSummary(org) {
  if (!org) return null;
  return {
    id: org._id?.toString() || org.id,
    name: org.name,
    timezone: org.timezone || null,
    country: org.country || null,
  };
}

function BreachLogSummaryDTO(breach, { org } = {}) {
  const jurisdiction = getJurisdiction(breach.organizationCountry);
  const orgSummary = org || (breach.orgId && typeof breach.orgId === 'object' ? mapOrgSummary(breach.orgId) : null);
  const userSummary = breach.userId && typeof breach.userId === 'object'
    ? mapCaregiverSummary(breach.userId)
    : null;

  return {
    id: breach._id?.toString() || breach.id,
    type: breach.type,
    severity: breach.severity,
    status: breach.status,
    jurisdiction: jurisdiction.jurisdiction,
    organizationCountry: breach.organizationCountry || null,
    detectedAt: breach.detectedAt,
    details: breach.details,
    ipAddress: breach.ipAddress || null,
    userId: userSummary?.id || breach.userId?.toString() || null,
    userName: userSummary?.name || null,
    userEmail: userSummary?.email || null,
    userRole: userSummary?.role || null,
    orgId: orgSummary?.id || breach.orgId?.toString() || userSummary?.orgId || null,
    orgName: orgSummary?.name || userSummary?.orgName || null,
    affectedResourceType: breach.affectedResourceType || null,
    affectedResourceIds: breach.affectedResourceIds || [],
    affectedCount: breach.affectedCount || 0,
    notificationDeadline: breach.notificationDeadline || null,
    requiresHHSNotification: breach.requiresHHSNotification === true,
    requiresPrivacyCommissionerNotification: breach.requiresPrivacyCommissionerNotification === true,
    resolvedAt: breach.resolvedAt || null,
    resolvedBy: breach.resolvedBy?._id?.toString() || breach.resolvedBy?.toString() || null,
    resolutionReason: breach.resolutionReason || null,
    resolutionNotes: breach.resolutionNotes || null,
    createdAt: breach.createdAt,
    updatedAt: breach.updatedAt,
  };
}

function BreachLogDetailDTO(breach, { org, relatedAuditLogs = [] } = {}) {
  const summary = BreachLogSummaryDTO(breach, { org });
  const resolvedBy = breach.resolvedBy && typeof breach.resolvedBy === 'object'
    ? { id: breach.resolvedBy._id?.toString(), name: breach.resolvedBy.name, email: breach.resolvedBy.email }
    : null;

  return {
    ...summary,
    userAgent: breach.userAgent || null,
    evidence: breach.evidence || null,
    alertSnapshot: breach.alertSnapshot || null,
    statusHistory: (breach.statusHistory || []).map((entry) => ({
      status: entry.status,
      changedAt: entry.changedAt,
      changedBy: entry.changedBy?._id?.toString() || entry.changedBy?.toString() || null,
      notes: entry.notes || null,
      resolutionReason: entry.resolutionReason || null,
    })),
    resolvedBy,
    org: org ? mapOrgSummary(org) : null,
    relatedAuditLogs: relatedAuditLogs.map((log) => ({
      id: log._id?.toString(),
      timestamp: log.timestamp,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      outcome: log.outcome,
      ipAddress: log.ipAddress,
      userRole: log.userRole,
    })),
    mitigationSteps: breach.mitigationSteps || [],
    rootCause: breach.rootCause || null,
    preventiveMeasures: breach.preventiveMeasures || null,
  };
}

module.exports = {
  BreachLogSummaryDTO,
  BreachLogDetailDTO,
};
