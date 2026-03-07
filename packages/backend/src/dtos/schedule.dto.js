// schedule.dto.js
const { convertUTCToOrgTime } = require('../utils/timezone.utils');

const ScheduleDTO = (schedule) => {
  const { _id, client, frequency, intervals, isActive, time, nextCallDate } = schedule;

  const id = _id;
  const clientId = client ? (typeof client === 'object' ? client._id : client) : null;

  let orgTimezone = 'America/Los_Angeles';
  if (client && typeof client === 'object' && client.org) {
    if (typeof client.org === 'object' && client.org.timezone) {
      orgTimezone = client.org.timezone;
    } else if (typeof client.org === 'string') {
      // If org is just an ID, we can't get timezone - use default
      // In practice, schedules should be populated with org when needed
    }
  }

  // Convert UTC time back to org timezone for display
  const orgTime = time ? convertUTCToOrgTime(time, orgTimezone) : time;

  // Transform intervals to only include necessary properties
  const intervalData = intervals && Array.isArray(intervals)
    ? intervals.map((interval) => ({
        day: interval.day,
        weeks: interval.weeks,
      }))
    : [];

  return {
    id,
    client: clientId,
    frequency,
    intervals: intervalData,
    isActive,
    nextCallDate,
    time: orgTime, // Return time in org timezone
  };
};

module.exports = ScheduleDTO;
