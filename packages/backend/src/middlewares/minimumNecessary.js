/**
 * Minimum Necessary Data Access Middleware
 *
 * HIPAA Requirements:
 * - §164.502(b) - Minimum Necessary Standard
 * - Limit PHI disclosure to the minimum necessary to accomplish intended purpose
 *
 * Implementation:
 * - Field-level access control based on user role
 * - Filters response data before sending to client
 * - Ensures staff only see what they need for their job function
 */

const logger = require('../config/logger');

/**
 * Define field access rules by role
 *
 * Format: { role: { resource: [allowedFields] } }
 */
const FIELD_ACCESS_RULES = {
  // Staff: Limited access - only fields needed for daily care
  staff: {
    client: [
      '_id',
      'id',
      'name',
      'preferredName',
      'age',
      'avatar',
      'preferredLanguage',
      'room',
      'moveInDate',
      'emergencyContact',
      'notes',
      'lastContact',
      'lastCallAttemptAt',
      'lastAnsweredCallAt',
      'sentimentTrendDirection',
      'sentimentAnalyzedConversations',
      'latestOverallHealthScore',
      'latestOverallRiskScore',
      'status',
      'assignedCaregivers',
      'caregivers',
      'schedules', // For care coordination / schedule views
      'org',
      'consented',
      'consentedAt',
      'consentEmailVersion',
    ],

    conversation: [
      '_id',
      'id', // DTO transforms _id to id
      'client', // ID only
      'clientId',
      'status',
      'duration',
      'startTime',
      'endTime',
      'messages', // Will be filtered separately
      'summary',
      // EXCLUDED: recordings, fullTranscript (unless specifically authorized)
    ],

    medicalAnalysis: [
      '_id',
      'client', // ID only
      'summary', // High-level summary only
      'recommendations', // What to do, not detailed medical data
      'analysisDate',
      // EXCLUDED: Detailed metrics, cognitive scores, psychiatric details
    ],

    alert: [
      '_id',
      'client', // ID only
      'type',
      'severity',
      'message',
      'createdAt',
      'acknowledged',
      // EXCLUDED: Full client context, medical details
    ],

    clientOnboarding: ['journey', 'responses', 'flags', 'questionCount', 'rollups'],
  },

  // OrgAdmin: Broader access for administrative purposes
  orgAdmin: {
    client: [
      '_id',
      'id',
      'name',
      'preferredName',
      'age',
      'email',
      'phone',
      'avatar',
      'preferredLanguage',
      'room',
      'moveInDate',
      'emergencyContact',
      'notes',
      'lastContact',
      'lastCallAttemptAt',
      'lastAnsweredCallAt',
      'sentimentTrendDirection',
      'sentimentAnalyzedConversations',
      'latestOverallHealthScore',
      'latestOverallRiskScore',
      'status',
      'assignedCaregivers',
      'caregivers',
      'schedules', // Needed for schedule management
      'org',
      'dateOfBirth',
      'address',
      'consented',
      'consentedAt',
      'consentEmailVersion',
    ],

    conversation: [
      '_id',
      'id', // DTO transforms _id to id
      'client',
      'clientId',
      'status',
      'duration',
      'startTime',
      'endTime',
      'messages',
      'summary',
      'transcript', // Can review for quality
      'cost', // For billing
      // EXCLUDED: Raw recordings (unless specifically authorized)
    ],

    medicalAnalysis: [
      '_id',
      'client',
      'summary',
      'recommendations',
      'analysisDate',
      'cognitiveMetrics', // Can see trends for staffing
      'riskLevel',
      // EXCLUDED: Detailed medical notes (unless medically trained)
    ],

    alert: '*', // Full access to all alert fields

    clientOnboarding: ['journey', 'responses', 'flags', 'questionCount', 'rollups'],
  },

  // SuperAdmin: Full access (system administration)
  superAdmin: {
    client: '*',
    conversation: '*',
    medicalAnalysis: '*',
    alert: '*',
    auditLog: '*',
  },
};

/**
 * Filter object fields based on allowed fields list
 */
function filterFields(obj, allowedFields) {
  if (!obj || typeof obj !== 'object') return obj;

  // If allowedFields is '*', return all fields
  if (allowedFields === '*') return obj;

  // If it's an array, filter each item
  if (Array.isArray(obj)) {
    return obj.map((item) => filterFields(item, allowedFields));
  }

  // Filter object fields
  const filtered = {};

  allowedFields.forEach((field) => {
    if (field in obj) {
      // Handle nested objects (e.g., 'assignedCaregivers.name')
      if (field.includes('.')) {
        const [parent, ...rest] = field.split('.');
        if (parent in obj) {
          filtered[parent] = filterFields(obj[parent], [rest.join('.')]);
        }
      } else {
        filtered[field] = obj[field];
      }
    }
  });

  return filtered;
}

/**
 * Get allowed fields for user role and resource
 */
function getAllowedFields(userRole, resourceType) {
  const roleRules = FIELD_ACCESS_RULES[userRole] || FIELD_ACCESS_RULES.staff;
  return roleRules[resourceType] || [];
}

/**
 * Middleware to filter response data based on minimum necessary standard
 */
const minimumNecessaryMiddleware = (resourceType) => {
  return (req, res, next) => {
    // Skip if no user or superAdmin (full access)
    if (!req.caregiver || req.caregiver.role === 'superAdmin') {
      return next();
    }

    const userRole = req.caregiver.role;
    const allowedFields = getAllowedFields(userRole, resourceType);

    // If full access ('*'), skip filtering
    if (allowedFields === '*') {
      return next();
    }

    const filterPayload = (data) => {
      if (!data || typeof data !== 'object') return data;
      if (data.results && Array.isArray(data.results)) {
        return {
          ...data,
          results: filterFields(data.results, allowedFields),
        };
      }
      if (Array.isArray(data)) return filterFields(data, allowedFields);
      if (data.data) {
        return {
          ...data,
          data: filterFields(data.data, allowedFields),
        };
      }
      return filterFields(data, allowedFields);
    };

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    res.json = function wrappedJson(data) {
      logger.debug(`[MINIMUM_NECESSARY] Filtered ${resourceType} fields for role: ${userRole}`);
      return originalJson(filterPayload(data));
    };
    res.send = function wrappedSend(data) {
      logger.debug(`[MINIMUM_NECESSARY] Filtered ${resourceType} fields for role: ${userRole}`);
      return originalSend(filterPayload(data));
    };

    next();
  };
};

/**
 * Manually filter data (for use in services)
 */
const filterDataForRole = (data, resourceType, userRole) => {
  const allowedFields = getAllowedFields(userRole, resourceType);

  if (allowedFields === '*') {
    return data;
  }

  return filterFields(data, allowedFields);
};

/**
 * Check if user can access specific fields
 */
const canAccessField = (userRole, resourceType, fieldName) => {
  const allowedFields = getAllowedFields(userRole, resourceType);

  if (allowedFields === '*') {
    return true;
  }

  return allowedFields.includes(fieldName);
};

/**
 * Add custom allowed fields for specific cases
 * (e.g., doctor needs full medical access for specific client)
 */
const addFieldPermission = (userId, resourceType, fields) => {
  // TODO: Implement persistent field-level permissions
  // This would require a database table to store custom permissions
  logger.info(`[MINIMUM_NECESSARY] Custom field permission requested: ${userId}, ${resourceType}, ${fields}`);
};

// Export field access rules for documentation
const getFieldAccessRules = () => ({ ...FIELD_ACCESS_RULES });

module.exports = {
  minimumNecessaryMiddleware,
  filterDataForRole,
  canAccessField,
  addFieldPermission,
  getFieldAccessRules,
};
