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
    patient: [
      '_id',
      'name',
      'preferredName',
      'avatar',
      'language',
      'lastContact',
      'status', // active, inactive, etc.
      'assignedCaregivers', // Only their ID will be visible
      // EXCLUDED: email, phone, dateOfBirth, medicalRecordNumber, address, emergencyContacts
    ],
    
    conversation: [
      '_id',
      'patient', // ID only
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
      'patient', // ID only
      'summary', // High-level summary only
      'recommendations', // What to do, not detailed medical data
      'analysisDate',
      // EXCLUDED: Detailed metrics, cognitive scores, psychiatric details
    ],
    
    alert: [
      '_id',
      'patient', // ID only
      'type',
      'severity',
      'message',
      'createdAt',
      'acknowledged',
      // EXCLUDED: Full patient context, medical details
    ]
  },

  // OrgAdmin: Broader access for administrative purposes
  orgAdmin: {
    patient: [
      '_id',
      'name',
      'preferredName',
      'email', // Can contact patients
      'phone', // Can contact patients
      'avatar',
      'language',
      'lastContact',
      'status',
      'assignedCaregivers',
      'dateOfBirth', // For verification
      'address', // For service delivery
      // EXCLUDED: medicalRecordNumber (unless billing admin)
    ],
    
    conversation: [
      '_id',
      'patient',
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
      'patient',
      'summary',
      'recommendations',
      'analysisDate',
      'cognitiveMetrics', // Can see trends for staffing
      'riskLevel',
      // EXCLUDED: Detailed medical notes (unless medically trained)
    ],
    
    alert: '*' // Full access to all alert fields
  },

  // SuperAdmin: Full access (system administration)
  superAdmin: {
    patient: '*',
    conversation: '*',
    medicalAnalysis: '*',
    alert: '*',
    auditLog: '*'
  }
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
    return obj.map(item => filterFields(item, allowedFields));
  }
  
  // Filter object fields
  const filtered = {};
  
  allowedFields.forEach(field => {
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
  return roleRules[resourceType] || '*'; // Default to all if not specified
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

    // Intercept res.json to filter data
    const originalJson = res.json;
    
    res.json = function (data) {
      // Filter the data
      let filteredData = data;
      
      if (data && typeof data === 'object') {
        // Handle different response structures
        if (data.results && Array.isArray(data.results)) {
          // Paginated response
          filteredData = {
            ...data,
            results: filterFields(data.results, allowedFields)
          };
        } else if (Array.isArray(data)) {
          // Array response
          filteredData = filterFields(data, allowedFields);
        } else if (data.data) {
          // Wrapped response
          filteredData = {
            ...data,
            data: filterFields(data.data, allowedFields)
          };
        } else {
          // Single object response
          filteredData = filterFields(data, allowedFields);
        }
      }

      // Log field filtering (without PHI)
      logger.debug(`[MINIMUM_NECESSARY] Filtered ${resourceType} fields for role: ${userRole}`);

      // Call original json method with filtered data
      originalJson.call(this, filteredData);
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
 * (e.g., doctor needs full medical access for specific patient)
 */
const addFieldPermission = (userId, resourceType, fields) => {
  // TODO: Implement persistent field-level permissions
  // This would require a database table to store custom permissions
  logger.info(`[MINIMUM_NECESSARY] Custom field permission requested: ${userId}, ${resourceType}, ${fields}`);
};

// Export field access rules for documentation
const getFieldAccessRules = () => FIELD_ACCESS_RULES;

module.exports = {
  minimumNecessaryMiddleware,
  filterDataForRole,
  canAccessField,
  addFieldPermission,
  getFieldAccessRules
};

