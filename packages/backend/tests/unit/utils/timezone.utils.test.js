const { convertOrgTimeToUTC, convertUTCToOrgTime } = require('../../../src/utils/timezone.utils');

describe('Timezone Utils', () => {
  describe('convertOrgTimeToUTC', () => {
    test('should convert Eastern Time (EST) to UTC correctly', () => {
      // 9:00 AM EST = 14:00 UTC (EST is UTC-5)
      const result = convertOrgTimeToUTC('09:00', 'America/New_York');
      expect(result).toBe('14:00');
    });

    test('should convert Eastern Time (EDT) to UTC correctly during daylight saving', () => {
      // 9:00 AM EDT = 13:00 UTC (EDT is UTC-4)
      // Note: This will vary based on when the test runs, but should be either 13:00 or 14:00
      const result = convertOrgTimeToUTC('09:00', 'America/New_York');
      // During DST (March-November), EDT is UTC-4, so 9:00 AM = 13:00 UTC
      // During EST (November-March), EST is UTC-5, so 9:00 AM = 14:00 UTC
      expect(['13:00', '14:00']).toContain(result);
    });

    test('should convert Pacific Time to UTC correctly', () => {
      // 9:00 AM PST = 17:00 UTC (PST is UTC-8)
      // 9:00 AM PDT = 16:00 UTC (PDT is UTC-7)
      const result = convertOrgTimeToUTC('09:00', 'America/Los_Angeles');
      // During DST: 16:00, during standard time: 17:00
      expect(['16:00', '17:00']).toContain(result);
    });

    test('should convert Central Time to UTC correctly', () => {
      // 9:00 AM CST = 15:00 UTC (CST is UTC-6)
      // 9:00 AM CDT = 14:00 UTC (CDT is UTC-5)
      const result = convertOrgTimeToUTC('09:00', 'America/Chicago');
      expect(['14:00', '15:00']).toContain(result);
    });

    test('should convert London time to UTC correctly', () => {
      // 9:00 AM GMT = 09:00 UTC (GMT is UTC+0)
      // 9:00 AM BST = 08:00 UTC (BST is UTC+1)
      const result = convertOrgTimeToUTC('09:00', 'Europe/London');
      expect(['08:00', '09:00']).toContain(result);
    });

    test('should convert Tokyo time to UTC correctly', () => {
      // 9:00 AM JST = 00:00 UTC (JST is UTC+9)
      const result = convertOrgTimeToUTC('09:00', 'Asia/Tokyo');
      expect(result).toBe('00:00');
    });

    test('should handle midnight correctly', () => {
      const result = convertOrgTimeToUTC('00:00', 'America/New_York');
      expect(['04:00', '05:00']).toContain(result);
    });

    test('should handle times with minutes correctly', () => {
      const result = convertOrgTimeToUTC('09:30', 'America/New_York');
      expect(['13:30', '14:30']).toContain(result);
    });

    test('should return original time if timezone is missing', () => {
      const result = convertOrgTimeToUTC('09:00', null);
      expect(result).toBe('09:00');
    });

    test('should return original time if time is missing', () => {
      const result = convertOrgTimeToUTC(null, 'America/New_York');
      expect(result).toBeNull();
    });
  });

  describe('convertUTCToOrgTime', () => {
    test('should convert UTC to Eastern Time (EST) correctly', () => {
      // 14:00 UTC = 9:00 AM EST (EST is UTC-5)
      const result = convertUTCToOrgTime('14:00', 'America/New_York');
      expect(['09:00', '10:00']).toContain(result); // Could be 9:00 or 10:00 depending on DST
    });

    test('should convert UTC to Pacific Time correctly', () => {
      // 17:00 UTC = 9:00 AM PST (PST is UTC-8)
      // 16:00 UTC = 9:00 AM PDT (PDT is UTC-7)
      const result = convertUTCToOrgTime('17:00', 'America/Los_Angeles');
      expect(['09:00', '10:00']).toContain(result);
    });

    test('should convert UTC to London time correctly', () => {
      // 09:00 UTC = 9:00 AM GMT or 10:00 AM BST
      const result = convertUTCToOrgTime('09:00', 'Europe/London');
      expect(['09:00', '10:00']).toContain(result);
    });

    test('should convert UTC to Tokyo time correctly', () => {
      // 00:00 UTC = 9:00 AM JST (JST is UTC+9)
      const result = convertUTCToOrgTime('00:00', 'Asia/Tokyo');
      expect(result).toBe('09:00');
    });

    test('should handle midnight correctly', () => {
      const result = convertUTCToOrgTime('00:00', 'America/New_York');
      expect(['19:00', '20:00']).toContain(result); // Previous day
    });

    test('should handle times with minutes correctly', () => {
      const result = convertUTCToOrgTime('14:30', 'America/New_York');
      expect(['09:30', '10:30']).toContain(result);
    });

    test('should return original time if timezone is missing', () => {
      const result = convertUTCToOrgTime('09:00', null);
      expect(result).toBe('09:00');
    });

    test('should return original time if time is missing', () => {
      const result = convertUTCToOrgTime(null, 'America/New_York');
      expect(result).toBeNull();
    });
  });

  describe('Round-trip conversion', () => {
    test('should convert org time to UTC and back to same org time', () => {
      const originalTime = '09:00';
      const timezone = 'America/New_York';
      
      const utcTime = convertOrgTimeToUTC(originalTime, timezone);
      const backToOrgTime = convertUTCToOrgTime(utcTime, timezone);
      
      expect(backToOrgTime).toBe(originalTime);
    });

    test('should handle different timezones correctly in round-trip', () => {
      const timezones = [
        'America/New_York',
        'America/Los_Angeles',
        'America/Chicago',
        'Europe/London',
        'Asia/Tokyo',
      ];

      timezones.forEach((timezone) => {
        const originalTime = '09:00';
        const utcTime = convertOrgTimeToUTC(originalTime, timezone);
        const backToOrgTime = convertUTCToOrgTime(utcTime, timezone);
        expect(backToOrgTime).toBe(originalTime);
      });
    });

    test('should handle edge case times in round-trip', () => {
      const times = ['00:00', '12:00', '23:59'];
      const timezone = 'America/New_York';

      times.forEach((time) => {
        const utcTime = convertOrgTimeToUTC(time, timezone);
        const backToOrgTime = convertUTCToOrgTime(utcTime, timezone);
        expect(backToOrgTime).toBe(time);
      });
    });
  });
});






