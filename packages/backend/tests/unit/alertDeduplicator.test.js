// tests/unit/alertDeduplicator.test.js

const { AlertDeduplicator } = require('../../src/utils/alertDeduplicator');

describe('Alert Deduplicator', () => {
  let deduplicator;

  beforeEach(() => {
    deduplicator = new AlertDeduplicator({
      debounceMinutes: 5,
      maxAlertsPerHour: 3,
      cleanupIntervalMinutes: 1 // Short interval for testing
    });
  });

  afterEach(() => {
    deduplicator.clearHistory();
  });

  describe('shouldAlert', () => {
    test('should allow first alert', () => {
      const result = deduplicator.shouldAlert('patient1', 'Medical', 'I have chest pain');
      expect(result.shouldAlert).toBe(true);
      expect(result.reason).toBe('No recent alerts of this category');
    });

    test('should block duplicate alert within debounce window', () => {
      const timestamp = Date.now();
      
      // First alert should be allowed
      const firstResult = deduplicator.shouldAlert('patient1', 'Medical', 'I have chest pain', timestamp);
      expect(firstResult.shouldAlert).toBe(true);

      // Record the alert
      deduplicator.recordAlert('patient1', 'Medical', timestamp, 'I have chest pain');

      // Second alert within debounce window should be blocked
      const secondResult = deduplicator.shouldAlert('patient1', 'Medical', 'Still have chest pain', timestamp + 1000);
      expect(secondResult.shouldAlert).toBe(false);
      expect(secondResult.reason).toContain('Recent Medical alert within');
    });

    test('should allow alert after debounce window expires', () => {
      const timestamp = Date.now();
      
      // First alert
      deduplicator.recordAlert('patient1', 'Medical', timestamp, 'I have chest pain');

      // Alert after debounce window (6 minutes later)
      const laterResult = deduplicator.shouldAlert('patient1', 'Medical', 'Still have chest pain', timestamp + (6 * 60 * 1000));
      expect(laterResult.shouldAlert).toBe(true);
    });

    test('should allow different categories within debounce window', () => {
      const timestamp = Date.now();
      
      // Record Medical alert
      deduplicator.recordAlert('patient1', 'Medical', timestamp, 'I have chest pain');

      // Safety alert should be allowed
      const safetyResult = deduplicator.shouldAlert('patient1', 'Safety', 'I want to hurt myself', timestamp + 1000);
      expect(safetyResult.shouldAlert).toBe(true);
    });

    test('should enforce hourly alert limit', () => {
      const timestamp = Date.now();
      
      // Record 3 alerts (max allowed)
      deduplicator.recordAlert('patient1', 'Medical', timestamp, 'Chest pain 1');
      deduplicator.recordAlert('patient1', 'Physical', timestamp + 1000, 'Fell down 1');
      deduplicator.recordAlert('patient1', 'Safety', timestamp + 2000, 'Intruder 1');

      // Fourth alert should be blocked
      const fourthResult = deduplicator.shouldAlert('patient1', 'Request', 'Need help', timestamp + 3000);
      expect(fourthResult.shouldAlert).toBe(false);
      expect(fourthResult.reason).toContain('Hourly alert limit exceeded');
    });

    test('should reset hourly count in new hour', () => {
      const timestamp = Date.now();
      
      // Record 3 alerts
      deduplicator.recordAlert('patient1', 'Medical', timestamp, 'Chest pain 1');
      deduplicator.recordAlert('patient1', 'Physical', timestamp + 1000, 'Fell down 1');
      deduplicator.recordAlert('patient1', 'Safety', timestamp + 2000, 'Intruder 1');

      // Alert in new hour should be allowed
      const newHourTimestamp = timestamp + (61 * 60 * 1000); // 61 minutes later
      const newHourResult = deduplicator.shouldAlert('patient1', 'Request', 'Need help', newHourTimestamp);
      expect(newHourResult.shouldAlert).toBe(true);
    });

    test('should handle invalid inputs gracefully', () => {
      expect(deduplicator.shouldAlert(null, 'Medical', 'text')).toEqual({
        shouldAlert: false,
        reason: 'Invalid input parameters'
      });

      expect(deduplicator.shouldAlert('patient1', null, 'text')).toEqual({
        shouldAlert: false,
        reason: 'Invalid input parameters'
      });

      expect(deduplicator.shouldAlert('patient1', 'Medical', null)).toEqual({
        shouldAlert: false,
        reason: 'Invalid input parameters'
      });
    });
  });

  describe('recordAlert', () => {
    test('should record alert successfully', () => {
      const timestamp = Date.now();
      const result = deduplicator.recordAlert('patient1', 'Medical', timestamp, 'I have chest pain');
      
      expect(result).toBeDefined();
      expect(result.category).toBe('Medical');
      expect(result.timestamp).toBe(timestamp);
      expect(result.text).toBe('I have chest pain');
      expect(result.id).toBeDefined();
    });

    test('should handle invalid inputs', () => {
      // Suppress console.error for this test since we're testing error handling
      const originalError = console.error;
      console.error = jest.fn();
      
      expect(deduplicator.recordAlert(null, 'Medical')).toBeNull();
      expect(deduplicator.recordAlert('patient1', null)).toBeNull();
      
      // Restore console.error
      console.error = originalError;
    });

    test('should limit text length', () => {
      const longText = 'A'.repeat(300);
      const result = deduplicator.recordAlert('patient1', 'Medical', Date.now(), longText);
      
      expect(result.text.length).toBe(200);
    });
  });

  describe('getRecentAlerts', () => {
    test('should return recent alerts', () => {
      const timestamp = Date.now();
      deduplicator.recordAlert('patient1', 'Medical', timestamp, 'Chest pain');
      deduplicator.recordAlert('patient1', 'Safety', timestamp + 1000, 'Suicide thoughts');

      const alerts = deduplicator.getRecentAlerts('patient1');
      expect(alerts).toHaveLength(2);
      expect(alerts[0].category).toBe('Medical');
      expect(alerts[1].category).toBe('Safety');
    });

    test('should return empty array for unknown patient', () => {
      const alerts = deduplicator.getRecentAlerts('unknown');
      expect(alerts).toEqual([]);
    });

    test('should filter by time window', () => {
      const timestamp = Date.now();
      deduplicator.recordAlert('patient1', 'Medical', timestamp, 'Chest pain');

      // Get alerts from last hour only
      const alerts = deduplicator.getRecentAlerts('patient1', 1);
      expect(alerts).toHaveLength(1);

      // Get alerts from last minute only
      const recentAlerts = deduplicator.getRecentAlerts('patient1', 1/60);
      expect(recentAlerts).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    test('should return correct statistics', () => {
      const timestamp = Date.now();
      deduplicator.recordAlert('patient1', 'Medical', timestamp, 'Chest pain');
      deduplicator.recordAlert('patient2', 'Safety', timestamp + 1000, 'Suicide');

      const stats = deduplicator.getStats();
      expect(stats.totalPatients).toBe(2);
      expect(stats.totalAlerts).toBe(2);
      expect(stats.alertsInLastHour).toBe(2);
      expect(stats.config.debounceMinutes).toBe(5);
    });
  });

  describe('clearHistory', () => {
    test('should clear all history', () => {
      deduplicator.recordAlert('patient1', 'Medical', Date.now(), 'Chest pain');
      expect(deduplicator.getRecentAlerts('patient1')).toHaveLength(1);

      deduplicator.clearHistory();
      expect(deduplicator.getRecentAlerts('patient1')).toHaveLength(0);
    });
  });

  describe('updateConfig', () => {
    test('should update configuration', () => {
      deduplicator.updateConfig({ debounceMinutes: 10 });
      const stats = deduplicator.getStats();
      expect(stats.config.debounceMinutes).toBe(10);
    });
  });
});
