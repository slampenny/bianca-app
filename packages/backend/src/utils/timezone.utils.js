const moment = require('moment-timezone');

/**
 * Convert a time string (HH:mm) from org timezone to UTC time string
 * @param {string} timeStr - Time in HH:mm format (e.g., "09:00")
 * @param {string} orgTimezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns {string} - Time in HH:mm format in UTC
 */
function convertOrgTimeToUTC(timeStr, orgTimezone) {
  if (!timeStr || !orgTimezone) {
    return timeStr; // Return as-is if missing
  }

  // Parse the time string (HH:mm)
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Create a moment in the org's timezone for today at the specified time
  const today = moment.tz(orgTimezone);
  const timeInOrgTz = today.clone().hour(hours).minute(minutes).second(0).millisecond(0);
  
  // Convert to UTC
  const timeInUTC = timeInOrgTz.utc();
  
  // Return as HH:mm string
  return `${String(timeInUTC.hour()).padStart(2, '0')}:${String(timeInUTC.minute()).padStart(2, '0')}`;
}

/**
 * Convert a time string (HH:mm) from UTC to org timezone time string
 * @param {string} timeStr - Time in HH:mm format in UTC (e.g., "14:00")
 * @param {string} orgTimezone - IANA timezone identifier (e.g., "America/New_York")
 * @returns {string} - Time in HH:mm format in org timezone
 */
function convertUTCToOrgTime(timeStr, orgTimezone) {
  if (!timeStr || !orgTimezone) {
    return timeStr; // Return as-is if missing
  }

  // Parse the time string (HH:mm)
  const [hours, minutes] = timeStr.split(':').map(Number);
  
  // Create a moment in UTC for today at the specified time
  const today = moment.utc();
  const timeInUTC = today.clone().hour(hours).minute(minutes).second(0).millisecond(0);
  
  // Convert to org timezone
  const timeInOrgTz = timeInUTC.tz(orgTimezone);
  
  // Return as HH:mm string
  return `${String(timeInOrgTz.hour()).padStart(2, '0')}:${String(timeInOrgTz.minute()).padStart(2, '0')}`;
}

module.exports = {
  convertOrgTimeToUTC,
  convertUTCToOrgTime,
};

