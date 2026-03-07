const ScheduleDTO = require('../../../src/dtos/schedule.dto');

describe('Schedule DTO', () => {
  describe('Timezone conversion', () => {
    test('should convert UTC time to org timezone when returning schedule', () => {
      // Mock schedule with UTC time stored in database
      const schedule = {
        _id: 'schedule123',
        client: {
          _id: 'patient123',
          org: {
            _id: 'org123',
            timezone: 'America/New_York',
          },
        },
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '14:00', // UTC time (9:00 AM EST)
        nextCallDate: new Date(),
      };

      const dto = ScheduleDTO(schedule);

      // Should convert UTC back to org timezone
      expect(dto.time).toBe('09:00'); // or '10:00' depending on DST
      expect(['09:00', '10:00']).toContain(dto.time);
    });

    test('should handle different timezones correctly', () => {
      const testCases = [
        {
          timezone: 'America/New_York',
          utcTime: '14:00',
          expectedOrgTime: ['09:00', '10:00'],
        },
        {
          timezone: 'America/Los_Angeles',
          utcTime: '17:00',
          expectedOrgTime: ['09:00', '10:00'],
        },
        {
          timezone: 'Europe/London',
          utcTime: '09:00',
          expectedOrgTime: ['09:00', '10:00'],
        },
        {
          timezone: 'Asia/Tokyo',
          utcTime: '00:00',
          expectedOrgTime: ['09:00'],
        },
      ];

      testCases.forEach(({ timezone, utcTime, expectedOrgTime }) => {
        const schedule = {
          _id: 'schedule123',
client: {
          _id: 'patient123',
          org: {
              _id: 'org123',
              timezone,
            },
          },
          frequency: 'daily',
          intervals: [],
          isActive: true,
          time: utcTime,
          nextCallDate: new Date(),
        };

        const dto = ScheduleDTO(schedule);
        expect(expectedOrgTime).toContain(dto.time);
      });
    });

    test('should use default timezone if org timezone is not set', () => {
      const schedule = {
        _id: 'schedule123',
        client: {
          _id: 'patient123',
          org: {
            _id: 'org123',
            // No timezone property
          },
        },
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '14:00',
        nextCallDate: new Date(),
      };

      const dto = ScheduleDTO(schedule);

      // Should use default (America/Los_Angeles)
      // 14:00 UTC = 6:00 AM PST or 7:00 AM PDT
      expect(['06:00', '07:00']).toContain(dto.time);
    });

    test('should handle client as ID string (not populated)', () => {
      const schedule = {
        _id: 'schedule123',
        client: 'patient123', // Just an ID, not populated
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: '14:00',
        nextCallDate: new Date(),
      };

      const dto = ScheduleDTO(schedule);

      // Should use default timezone (America/Los_Angeles) when org is not populated
      // 14:00 UTC = 6:00 AM PST or 7:00 AM PDT
      expect(['06:00', '07:00']).toContain(dto.time);
      expect(dto.client).toBe('patient123');
    });

    test('should handle missing time gracefully', () => {
      const schedule = {
        _id: 'schedule123',
        client: {
          _id: 'patient123',
          org: {
            _id: 'org123',
            timezone: 'America/New_York',
          },
        },
        frequency: 'daily',
        intervals: [],
        isActive: true,
        time: null,
        nextCallDate: new Date(),
      };

      const dto = ScheduleDTO(schedule);

      expect(dto.time).toBeNull();
    });

    test('should preserve all other schedule properties', () => {
      const schedule = {
        _id: 'schedule123',
        client: {
          _id: 'patient123',
          org: {
            _id: 'org123',
            timezone: 'America/New_York',
          },
        },
        frequency: 'weekly',
        intervals: [{ day: 1, weeks: 1 }],
        isActive: true,
        time: '14:00',
        nextCallDate: new Date('2024-01-01T14:00:00Z'),
      };

      const dto = ScheduleDTO(schedule);

      expect(dto.id).toBe('schedule123');
      expect(dto.client).toBe('patient123');
      expect(dto.frequency).toBe('weekly');
      expect(dto.intervals).toEqual([{ day: 1, weeks: 1 }]);
      expect(dto.isActive).toBe(true);
      expect(dto.nextCallDate).toEqual(schedule.nextCallDate);
      expect(['09:00', '10:00']).toContain(dto.time);
    });
  });
});

