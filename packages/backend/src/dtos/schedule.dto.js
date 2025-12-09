// schedule.dto.js
const { convertUTCToOrgTime } = require('../utils/timezone.utils');

const ScheduleDTO = (schedule) => {
  const { _id, patient, frequency, intervals, isActive, time, nextCallDate } = schedule;

  const id = _id;
  const patientId = patient ? (typeof patient === 'object' ? patient._id : patient) : null;

  // Get org timezone (default to 'America/New_York' if not set)
  // Check if patient is populated and has org
  let orgTimezone = 'America/New_York';
  if (patient && typeof patient === 'object' && patient.org) {
    if (typeof patient.org === 'object' && patient.org.timezone) {
      orgTimezone = patient.org.timezone;
    } else if (typeof patient.org === 'string') {
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
    patient: patientId,
    frequency,
    intervals: intervalData,
    isActive,
    nextCallDate,
    time: orgTime, // Return time in org timezone
  };
};

module.exports = ScheduleDTO;
