// src/utils/alertDeduplicator.js

/**
 * Alert Deduplication System
 * Prevents sending multiple alerts for the same emergency within a specified time window
 */

class AlertDeduplicator {
  constructor(config = {}) {
    // Default configuration
    this.config = {
      debounceMinutes: config.debounceMinutes || 5,
      maxAlertsPerHour: config.maxAlertsPerHour || 10,
      cleanupIntervalMinutes: config.cleanupIntervalMinutes || 30,
      ...config
    };

    // In-memory storage for tracking recent alerts
    // Structure: { patientId: { alerts: [{ category, timestamp, text }], hourlyCount: number } }
    this.alertHistory = new Map();
    
    // Store cleanup interval ID for proper cleanup
    this.cleanupIntervalId = null;
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Check if we should send an alert for this patient and emergency type
   * @param {string} patientId - The patient ID
   * @param {string} category - The emergency category (Medical, Safety, Physical, Request)
   * @param {string} text - The original text that triggered the emergency
   * @param {number} timestamp - Current timestamp (defaults to now)
   * @returns {Object} - { shouldAlert: boolean, reason: string }
   */
  shouldAlert(patientId, category, text, timestamp = Date.now()) {
    try {
      // Validate inputs
      if (!patientId || !category || !text) {
        return { shouldAlert: false, reason: 'Invalid input parameters' };
      }

      const patientHistory = this.alertHistory.get(patientId) || {
        alerts: [],
        hourlyCount: 0,
        hourlyWindowStart: timestamp
      };

      // Check hourly alert limit
      if (this.isHourlyLimitExceeded(patientHistory, timestamp)) {
        return { 
          shouldAlert: false, 
          reason: `Hourly alert limit exceeded (${this.config.maxAlertsPerHour})` 
        };
      }

      // Check for recent alerts of the same category within debounce window
      const debounceWindowMs = this.config.debounceMinutes * 60 * 1000;
      const recentAlert = patientHistory.alerts.find(alert => 
        alert.category === category && 
        (timestamp - alert.timestamp) < debounceWindowMs
      );

      if (recentAlert) {
        const timeSinceLastAlert = Math.round((timestamp - recentAlert.timestamp) / 1000 / 60);
        return { 
          shouldAlert: false, 
          reason: `Recent ${category} alert within ${timeSinceLastAlert} minutes (debounce: ${this.config.debounceMinutes}min)` 
        };
      }

      return { shouldAlert: true, reason: 'No recent alerts of this category' };
    } catch (error) {
      console.error('Error in shouldAlert:', error);
      // Fail safe - allow alert if there's an error
      return { shouldAlert: true, reason: 'Error checking deduplication, allowing alert' };
    }
  }

  /**
   * Record that an alert was sent for this patient
   * @param {string} patientId - The patient ID
   * @param {string} category - The emergency category
   * @param {number} timestamp - When the alert was sent (defaults to now)
   * @param {string} text - The original text that triggered the emergency
   * @returns {Object} - Recorded alert data
   */
  recordAlert(patientId, category, timestamp = Date.now(), text = '') {
    try {
      if (!patientId || !category) {
        throw new Error('Patient ID and category are required');
      }

      let patientHistory = this.alertHistory.get(patientId);
      
      if (!patientHistory) {
        patientHistory = {
          alerts: [],
          hourlyCount: 0,
          hourlyWindowStart: timestamp
        };
      }

      // Reset hourly count if we're in a new hour window
      this.resetHourlyCountIfNeeded(patientHistory, timestamp);

      // Create alert record
      const alertRecord = {
        category,
        timestamp,
        text: text.substring(0, 200), // Limit text length for storage
        id: `${patientId}_${timestamp}_${category}`
      };

      // Add to patient history
      patientHistory.alerts.push(alertRecord);
      patientHistory.hourlyCount++;

      // Store updated history
      this.alertHistory.set(patientId, patientHistory);

      return alertRecord;
    } catch (error) {
      console.error('Error recording alert:', error);
      return null;
    }
  }

  /**
   * Get recent alerts for a patient
   * @param {string} patientId - The patient ID
   * @param {number} hoursBack - How many hours back to look (default: 24)
   * @returns {Array} - Array of recent alerts
   */
  getRecentAlerts(patientId, hoursBack = 24) {
    try {
      const patientHistory = this.alertHistory.get(patientId);
      if (!patientHistory) {
        return [];
      }

      const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
      return patientHistory.alerts.filter(alert => alert.timestamp >= cutoffTime);
    } catch (error) {
      console.error('Error getting recent alerts:', error);
      return [];
    }
  }

  /**
   * Check if hourly alert limit is exceeded
   * @private
   */
  isHourlyLimitExceeded(patientHistory, timestamp) {
    this.resetHourlyCountIfNeeded(patientHistory, timestamp);
    return patientHistory.hourlyCount >= this.config.maxAlertsPerHour;
  }

  /**
   * Reset hourly count if we're in a new hour window
   * @private
   */
  resetHourlyCountIfNeeded(patientHistory, timestamp) {
    const hourInMs = 60 * 60 * 1000;
    if (timestamp - patientHistory.hourlyWindowStart >= hourInMs) {
      patientHistory.hourlyCount = 0;
      patientHistory.hourlyWindowStart = timestamp;
    }
  }

  /**
   * Start cleanup interval to remove old alerts
   * @private
   */
  startCleanupInterval() {
    const cleanupIntervalMs = this.config.cleanupIntervalMinutes * 60 * 1000;
    
    this.cleanupIntervalId = setInterval(() => {
      this.cleanupOldAlerts();
    }, cleanupIntervalMs);
  }

  /**
   * Stop the cleanup interval (useful for testing)
   * @public
   */
  stopCleanupInterval() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  /**
   * Remove alerts older than 24 hours to prevent memory bloat
   * @private
   */
  cleanupOldAlerts() {
    try {
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      
      for (const [patientId, patientHistory] of this.alertHistory.entries()) {
        const originalLength = patientHistory.alerts.length;
        patientHistory.alerts = patientHistory.alerts.filter(alert => alert.timestamp >= cutoffTime);
        
        // Remove patient entry if no alerts remain
        if (patientHistory.alerts.length === 0) {
          this.alertHistory.delete(patientId);
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Get statistics about the deduplicator
   * @returns {Object} - Statistics object
   */
  getStats() {
    try {
      const totalPatients = this.alertHistory.size;
      let totalAlerts = 0;
      let alertsInLastHour = 0;
      
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      for (const patientHistory of this.alertHistory.values()) {
        totalAlerts += patientHistory.alerts.length;
        alertsInLastHour += patientHistory.alerts.filter(alert => alert.timestamp >= oneHourAgo).length;
      }
      
      return {
        totalPatients,
        totalAlerts,
        alertsInLastHour,
        config: this.config
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Clear all alert history (useful for testing)
   */
  clearHistory() {
    this.alertHistory.clear();
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

// Lazy singleton instance
let alertDeduplicatorInstance = null;

function getAlertDeduplicator() {
  if (!alertDeduplicatorInstance) {
    alertDeduplicatorInstance = new AlertDeduplicator();
  }
  return alertDeduplicatorInstance;
}

module.exports = {
  AlertDeduplicator,
  getAlertDeduplicator,
  // For backward compatibility, export the getter as the default export
  get alertDeduplicator() {
    return getAlertDeduplicator();
  }
};
