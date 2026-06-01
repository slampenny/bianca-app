const moment = require('moment-timezone');
const { resolveOrgTimezone, localDateKeyForInstant } = require('./digestDay.utils');

const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * @param {string|null|undefined} timeStr
 * @returns {boolean}
 */
const isValidHHmm = (timeStr) => {
  if (timeStr == null || String(timeStr).trim() === '') {
    return false;
  }
  return HH_MM_PATTERN.test(String(timeStr).trim());
};

/**
 * @param {string} timeStr - HH:mm
 * @returns {{ hour: number, minute: number }}
 */
const parseHHmm = (timeStr) => {
  const trimmed = String(timeStr).trim();
  if (!isValidHHmm(trimmed)) {
    throw new Error(`Invalid sendTime "${timeStr}" — expected HH:mm`);
  }
  const [hour, minute] = trimmed.split(':').map(Number);
  return { hour, minute };
};

/**
 * Resolve org send time, falling back to platform default.
 * @param {string|null|undefined} orgSendTime
 * @param {string} defaultSendTime
 * @returns {string}
 */
const resolveOrgDigestSendTime = (orgSendTime, defaultSendTime) => {
  const fallback = isValidHHmm(defaultSendTime) ? String(defaultSendTime).trim() : '18:00';
  const candidate =
    orgSendTime != null && String(orgSendTime).trim() !== '' ? String(orgSendTime).trim() : fallback;
  if (!isValidHHmm(candidate)) {
    throw new Error(`Invalid sendTime "${candidate}" — expected HH:mm`);
  }
  return candidate;
};

/**
 * Whether `now` falls within ±windowMinutes of org-local sendTime on the org-local calendar day.
 * @param {{ orgTimezone: string, sendTime: string, now: Date, windowMinutes: number }} params
 * @returns {boolean}
 */
const isWithinOrgLocalSendWindow = ({ orgTimezone, sendTime, now, windowMinutes }) => {
  const tz = resolveOrgTimezone(orgTimezone);
  const { hour, minute } = parseHHmm(sendTime);
  const localNow = moment.tz(now, tz);
  const scheduled = localNow.clone().hour(hour).minute(minute).second(0).millisecond(0);
  const diffMs = Math.abs(localNow.diff(scheduled));
  return diffMs <= windowMinutes * 60 * 1000;
};

/**
 * Org-local date key for an instant.
 * @param {string} orgTimezone
 * @param {Date} now
 * @returns {string}
 */
const orgLocalDateKeyForInstant = (orgTimezone, now) => localDateKeyForInstant(orgTimezone, now);

module.exports = {
  HH_MM_PATTERN,
  isValidHHmm,
  parseHHmm,
  resolveOrgDigestSendTime,
  isWithinOrgLocalSendWindow,
  orgLocalDateKeyForInstant,
};
