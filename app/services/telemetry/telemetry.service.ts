// app/services/telemetry/telemetry.service.ts
// HIPAA-compliant telemetry service for frontend

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { logger } from '../../utils/logger';
import { DEFAULT_API_CONFIG } from '../api/api';
import { store } from '../../store/store';
import { RootState } from '../../store/store';

const TELEMETRY_OPT_IN_KEY = 'telemetry_opt_in';
const TELEMETRY_ENABLED_KEY = 'telemetry_enabled';

/**
 * PII fields that must never be tracked
 */
const PII_FIELDS = [
  'email',
  'phone',
  'address',
  'ssn',
  'password',
  'patientName',
  'patientId',
  'caregiverName',
  'caregiverId',
  'conversationContent',
  'messageContent',
  'medicalData',
  'diagnosis',
  'medication',
  'symptoms',
  'healthCondition',
  'personalInformation',
  'fullName',
  'dateOfBirth',
  'socialSecurityNumber',
];

/**
 * Sanitize properties to remove PII
 */
function sanitizeProperties(properties: Record<string, any>): Record<string, any> {
  if (!properties || typeof properties !== 'object') {
    return {};
  }

  const sanitized = { ...properties };

  // Remove PII fields
  PII_FIELDS.forEach(field => {
    if (sanitized[field] !== undefined) {
      delete sanitized[field];
    }
  });

  // Remove nested objects that might contain PII
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      const hasPII = PII_FIELDS.some(field => 
        key.toLowerCase().includes(field.toLowerCase()) ||
        Object.keys(sanitized[key]).some((nestedKey: string) => 
          nestedKey.toLowerCase().includes(field.toLowerCase())
        )
      );
      
      if (hasPII) {
        delete sanitized[key];
      } else {
        sanitized[key] = sanitizeProperties(sanitized[key]);
      }
    }
  });

  return sanitized;
}

/**
 * Telemetry Service Class
 * HIPAA-compliant event tracking with automatic PII scrubbing
 */
class TelemetryService {
  private enabled: boolean = false;
  private userId: string | null = null;
  private sessionId: string | null = null;
  private initialized: boolean = false;

  /**
   * Initialize telemetry service
   */
  async init() {
    if (this.initialized) return;

    try {
      // Check if user has opted in
      const optIn = await AsyncStorage.getItem(TELEMETRY_OPT_IN_KEY);
      this.enabled = optIn === 'true';

      // Generate session ID
      this.sessionId = Date.now().toString();

      this.initialized = true;

      if (this.enabled) {
        await this.track('session.started');
      }
    } catch (error) {
      logger.error('Telemetry init error:', error);
      this.enabled = false;
    }
  }

  /**
   * Set user ID
   */
  setUserId(userId: string | null) {
    this.userId = userId;
    if (this.enabled && userId) {
      this.identify(userId);
    }
  }

  /**
   * Set opt-in status
   */
  async setOptIn(optIn: boolean) {
    try {
      this.enabled = optIn;
      await AsyncStorage.setItem(TELEMETRY_OPT_IN_KEY, optIn.toString());

      if (optIn) {
        await this.track('telemetry.opted_in');
      } else {
        // Don't track opt-out to respect privacy
        logger.info('User opted out of telemetry');
      }
    } catch (error) {
      logger.error('Telemetry setOptIn error:', error);
    }
  }

  /**
   * Get opt-in status
   */
  async getOptIn(): Promise<boolean | null> {
    try {
      const optIn = await AsyncStorage.getItem(TELEMETRY_OPT_IN_KEY);
      if (optIn === null) return null;
      return optIn === 'true';
    } catch (error) {
      logger.error('Telemetry getOptIn error:', error);
      return null;
    }
  }

  /**
   * Track an event
   */
  async track(event: string, properties: Record<string, any> = {}) {
    if (!this.enabled || !this.initialized) {
      return;
    }

    try {
      // Sanitize properties
      const sanitizedProperties = sanitizeProperties(properties);

      // Add metadata
      sanitizedProperties.platform = Platform.OS;
      sanitizedProperties.sessionId = this.sessionId;
      sanitizedProperties.timestamp = new Date().toISOString();

      // Get auth token from Redux store
      const state = store.getState() as RootState;
      const token = state.auth.tokens?.access?.token;
      
      const response = await fetch(`${DEFAULT_API_CONFIG.url}/telemetry/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          event,
          properties: sanitizedProperties,
        }),
      });

      if (!response.ok) {
        logger.debug('Telemetry track failed:', response.status);
      }
    } catch (error) {
      // Silently fail - don't disrupt user experience
      logger.debug('Telemetry track error:', error);
    }
  }

  /**
   * Identify a user
   */
  async identify(userId: string, traits: Record<string, any> = {}) {
    if (!this.enabled || !this.initialized || !userId) {
      return;
    }

    try {
      const sanitizedTraits = sanitizeProperties(traits);

      // Get auth token from Redux store
      const state = store.getState() as RootState;
      const token = state.auth.tokens?.access?.token;
      
      await fetch(`${DEFAULT_API_CONFIG.url}/telemetry/identify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          traits: sanitizedTraits,
        }),
      });
    } catch (error) {
      logger.debug('Telemetry identify error:', error);
    }
  }

  /**
   * Track screen view
   */
  async trackScreen(screenName: string, properties: Record<string, any> = {}) {
    await this.track('screen.viewed', {
      screenName,
      ...properties,
    });
  }

  /**
   * Track feature usage
   */
  async trackFeature(feature: string, action: string, properties: Record<string, any> = {}) {
    await this.track(`feature.${action}`, {
      feature,
      ...properties,
    });
  }

  /**
   * Track error
   */
  async trackError(error: Error, context: Record<string, any> = {}) {
    await this.track('error.occurred', {
      errorMessage: error.message,
      errorType: error.name,
      ...context,
    });
  }

  /**
   * Track performance metric
   */
  async trackPerformance(metric: string, value: number, properties: Record<string, any> = {}) {
    await this.track(`performance.${metric}`, {
      value,
      ...properties,
    });
  }
}

// Create singleton instance
export const telemetry = new TelemetryService();

// Initialize on import
telemetry.init().catch(error => {
  logger.error('Failed to initialize telemetry:', error);
});

export default telemetry;

