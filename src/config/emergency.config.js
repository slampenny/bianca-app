// src/config/emergency.config.js

/**
 * Emergency Detection System Configuration
 * Allows adjusting system behavior without code changes
 */

const defaultConfig = {
  // Alert deduplication settings
  debounceMinutes: 5,
  maxAlertsPerHour: 10,
  cleanupIntervalMinutes: 30,

  // False positive filter settings
  enableFalsePositiveFilter: true,
  falsePositiveConfidenceThreshold: 0.7,

  // Severity response times (in seconds)
  severityResponseTimes: {
    CRITICAL: 60,   // 1 minute
    HIGH: 300,      // 5 minutes
    MEDIUM: 900     // 15 minutes
  },

  // Alert system settings
  enableAlertsAPI: true,
  enableSNSPushNotifications: process.env.EMERGENCY_SNS_TOPIC_ARN ? true : false,
  
  // SNS notification settings (will use main config)
  sns: {
    messageTemplate: {
      CRITICAL: '🚨 CRITICAL EMERGENCY: {patientName} - {category}: {phrase}',
      HIGH: '⚠️ HIGH PRIORITY: {patientName} - {category}: {phrase}',
      MEDIUM: '📢 ALERT: {patientName} - {category}: {phrase}'
    }
  },

  // Emergency detection settings
  emergencyDetection: {
    enableSeverityLevels: true,
    enableCategories: true,
    enablePatternMatching: true,
    caseInsensitive: true
  },

  // Logging settings
  logging: {
    logAllDetections: false,
    logFalsePositives: true,
    logAlertDecisions: true
  },

  // Confidence scoring
  confidence: {
    baseConfidence: 0.8,
    severityMultiplier: {
      CRITICAL: 1.2,
      HIGH: 1.0,
      MEDIUM: 0.8
    },
    categoryMultiplier: {
      Medical: 1.1,
      Safety: 1.0,
      Physical: 0.9,
      Request: 0.8
    }
  }
};

/**
 * Load configuration from environment variables or file
 */
function loadConfig() {
  try {
    // Try to load from environment variable first
    const envConfig = process.env.EMERGENCY_CONFIG;
    if (envConfig) {
      const parsedConfig = JSON.parse(envConfig);
      return mergeConfig(defaultConfig, parsedConfig);
    }

    // Try to load from config file
    const configPath = process.env.EMERGENCY_CONFIG_PATH || './config/emergency.config.json';
    try {
      const fs = require('fs');
      const path = require('path');
      const fullPath = path.resolve(configPath);
      
      if (fs.existsSync(fullPath)) {
        const fileConfig = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        return mergeConfig(defaultConfig, fileConfig);
      }
    } catch (fileError) {
      console.warn('Could not load emergency config file, using defaults:', fileError.message);
    }

    // Set SNS topic ARN from environment variable if available
    if (process.env.EMERGENCY_SNS_TOPIC_ARN) {
      defaultConfig.sns.topicArn = process.env.EMERGENCY_SNS_TOPIC_ARN;
    }

    // Set SNS region from AWS_REGION environment variable if available
    if (process.env.AWS_REGION) {
      defaultConfig.sns.region = process.env.AWS_REGION;
    }

    // Return default config
    return defaultConfig;
  } catch (error) {
    console.error('Error loading emergency configuration:', error);
    return defaultConfig;
  }
}

/**
 * Merge configuration objects
 * @param {Object} defaultConfig - Default configuration
 * @param {Object} overrideConfig - Configuration to override defaults
 * @returns {Object} - Merged configuration
 */
function mergeConfig(defaultConfig, overrideConfig) {
  const merged = JSON.parse(JSON.stringify(defaultConfig)); // Deep clone

  for (const key in overrideConfig) {
    if (overrideConfig.hasOwnProperty(key)) {
      if (typeof overrideConfig[key] === 'object' && !Array.isArray(overrideConfig[key])) {
        merged[key] = mergeConfig(merged[key] || {}, overrideConfig[key]);
      } else {
        merged[key] = overrideConfig[key];
      }
    }
  }

  return merged;
}

/**
 * Validate configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} - Validation result
 */
function validateConfig(config) {
  const errors = [];
  const warnings = [];

  // Validate debounce minutes
  if (config.debounceMinutes < 0 || config.debounceMinutes > 60) {
    errors.push('debounceMinutes must be between 0 and 60');
  }

  // Validate max alerts per hour
  if (config.maxAlertsPerHour < 1 || config.maxAlertsPerHour > 100) {
    errors.push('maxAlertsPerHour must be between 1 and 100');
  }

  // Validate severity response times
  if (config.severityResponseTimes.CRITICAL < 30 || config.severityResponseTimes.CRITICAL > 300) {
    warnings.push('CRITICAL response time should be between 30-300 seconds');
  }

  if (config.severityResponseTimes.HIGH < 60 || config.severityResponseTimes.HIGH > 600) {
    warnings.push('HIGH response time should be between 60-600 seconds');
  }

  if (config.severityResponseTimes.MEDIUM < 300 || config.severityResponseTimes.MEDIUM > 1800) {
    warnings.push('MEDIUM response time should be between 300-1800 seconds');
  }

  // Validate SNS settings if enabled
  if (config.enableSNSPushNotifications) {
    if (!config.sns.topicArn) {
      errors.push('SNS topic ARN is required when push notifications are enabled');
    }
    if (!config.sns.region) {
      warnings.push('SNS region not specified, using default');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get configuration value with fallback
 * @param {string} path - Dot notation path to config value
 * @param {*} defaultValue - Default value if path not found
 * @returns {*} - Configuration value or default
 */
function getConfigValue(path, defaultValue = null) {
  try {
    const keys = path.split('.');
    let value = config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  } catch (error) {
    console.error('Error getting config value:', error);
    return defaultValue;
  }
}

// Load and validate configuration
const config = loadConfig();
const validation = validateConfig(config);

// Log warnings
if (validation.warnings.length > 0) {
  console.warn('Emergency config warnings:', validation.warnings);
}

// Throw error if configuration is invalid
if (!validation.isValid) {
  throw new Error(`Emergency configuration invalid: ${validation.errors.join(', ')}`);
}

module.exports = {
  config,
  loadConfig,
  validateConfig,
  getConfigValue,
  defaultConfig
};
