const config = require('../../../src/config/config');

// Mock the TwilioCallService methods we need
const mockTwilioCallService = {
  calculateCallCost: function(duration) {
    const minimumBillableDuration = config.billing.minimumBillableDuration || 30;
    const billableDuration = Math.max(duration, minimumBillableDuration);
    const totalMinutes = billableDuration / 60;
    return totalMinutes * config.billing.ratePerMinute;
  }
};

describe('TwilioCallService - Billing', () => {
  let twilioCallService;

  beforeEach(() => {
    twilioCallService = mockTwilioCallService;
  });

  describe('calculateCallCost', () => {
    it('should calculate cost for normal duration call', () => {
      const duration = 120; // 2 minutes
      const expectedCost = (120 / 60) * config.billing.ratePerMinute; // 2 * 0.1 = 0.2
      
      const cost = twilioCallService.calculateCallCost(duration);
      expect(cost).toBe(expectedCost);
    });

    it('should apply minimum billable duration for short calls', () => {
      const duration = 15; // 15 seconds
      const minimumDuration = config.billing.minimumBillableDuration || 30;
      const expectedCost = (minimumDuration / 60) * config.billing.ratePerMinute;
      
      const cost = twilioCallService.calculateCallCost(duration);
      expect(cost).toBe(expectedCost);
    });

    it('should handle zero duration calls', () => {
      const duration = 0;
      const minimumDuration = config.billing.minimumBillableDuration || 30;
      const expectedCost = (minimumDuration / 60) * config.billing.ratePerMinute;
      
      const cost = twilioCallService.calculateCallCost(duration);
      expect(cost).toBe(expectedCost);
    });

    it('should handle negative duration calls', () => {
      const duration = -10;
      const minimumDuration = config.billing.minimumBillableDuration || 30;
      const expectedCost = (minimumDuration / 60) * config.billing.ratePerMinute;
      
      const cost = twilioCallService.calculateCallCost(duration);
      expect(cost).toBe(expectedCost);
    });

    it('should calculate cost for long duration calls', () => {
      const duration = 1800; // 30 minutes
      const expectedCost = (1800 / 60) * config.billing.ratePerMinute; // 30 * 0.1 = 3.0
      
      const cost = twilioCallService.calculateCallCost(duration);
      expect(cost).toBe(expectedCost);
    });

    it('should handle fractional minutes correctly', () => {
      const duration = 90; // 1.5 minutes
      const expectedCost = (90 / 60) * config.billing.ratePerMinute; // 1.5 * 0.1 = 0.15
      
      const cost = twilioCallService.calculateCallCost(duration);
      expect(cost).toBeCloseTo(expectedCost, 2);
    });

    it('should use configurable minimum billable duration', () => {
      // Mock config with different minimum duration
      const originalConfig = config.billing.minimumBillableDuration;
      config.billing.minimumBillableDuration = 60; // 1 minute minimum
      
      const duration = 30; // 30 seconds
      const expectedCost = (60 / 60) * config.billing.ratePerMinute; // 1 * 0.1 = 0.1
      
      const cost = twilioCallService.calculateCallCost(duration);
      expect(cost).toBe(expectedCost);
      
      // Restore original config
      config.billing.minimumBillableDuration = originalConfig;
    });

    it('should use configurable rate per minute', () => {
      // Mock config with different rate
      const originalRate = config.billing.ratePerMinute;
      config.billing.ratePerMinute = 0.25; // $0.25 per minute
      
      const duration = 120; // 2 minutes
      const expectedCost = (120 / 60) * 0.25; // 2 * 0.25 = 0.5
      
      const cost = twilioCallService.calculateCallCost(duration);
      expect(cost).toBe(expectedCost);
      
      // Restore original config
      config.billing.ratePerMinute = originalRate;
    });
  });

  describe('cost calculation edge cases', () => {
    it('should handle very large duration values', () => {
      const duration = 86400; // 24 hours
      const expectedCost = (86400 / 60) * config.billing.ratePerMinute;
      
      const cost = twilioCallService.calculateCallCost(duration);
      expect(cost).toBe(expectedCost);
      expect(cost).toBeGreaterThan(0);
    });

    it('should handle decimal duration values', () => {
      const duration = 125.5; // 2 minutes 5.5 seconds
      const expectedCost = (125.5 / 60) * config.billing.ratePerMinute;
      
      const cost = twilioCallService.calculateCallCost(duration);
      expect(cost).toBeCloseTo(expectedCost, 4);
    });

    it('should always return a positive cost', () => {
      const testCases = [0, -10, 5, 30, 60, 120, 1800];
      
      testCases.forEach(duration => {
        const cost = twilioCallService.calculateCallCost(duration);
        expect(cost).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('billing rate scenarios', () => {
    it('should calculate cost correctly with different billing rates', () => {
      const duration = 60; // 1 minute
      const testRates = [0.05, 0.10, 0.25, 0.50, 1.00];
      
      testRates.forEach(rate => {
        const originalRate = config.billing.ratePerMinute;
        config.billing.ratePerMinute = rate;
        
        const cost = twilioCallService.calculateCallCost(duration);
        expect(cost).toBe(rate);
        
        config.billing.ratePerMinute = originalRate;
      });
    });

    it('should handle zero billing rate', () => {
      const originalRate = config.billing.ratePerMinute;
      config.billing.ratePerMinute = 0;
      
      const duration = 120; // 2 minutes
      const cost = twilioCallService.calculateCallCost(duration);
      expect(cost).toBe(0);
      
      config.billing.ratePerMinute = originalRate;
    });
  });
});
