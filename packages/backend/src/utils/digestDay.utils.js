const moment = require('moment-timezone');

const DEFAULT_ORG_TIMEZONE = 'America/Los_Angeles';
const LOCAL_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve org IANA timezone with model default fallback.
 * @param {string|null|undefined} timezone
 * @returns {string}
 */
const resolveOrgTimezone = (timezone) => {
  const tz = timezone != null ? String(timezone).trim() : '';
  return tz || DEFAULT_ORG_TIMEZONE;
};

/**
 * Org-local calendar date key (YYYY-MM-DD) for an instant.
 * @param {string} orgTimezone
 * @param {Date|string|number} instant
 * @returns {string}
 */
const localDateKeyForInstant = (orgTimezone, instant) => {
  const tz = resolveOrgTimezone(orgTimezone);
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid instant for localDateKeyForInstant');
  }
  return moment.tz(d, tz).format('YYYY-MM-DD');
};

/**
 * Start of org-local calendar day as a UTC Date instant.
 * @param {string} orgTimezone
 * @param {string} localDateKey - YYYY-MM-DD in org timezone
 * @returns {Date}
 */
const startOfOrgLocalDay = (orgTimezone, localDateKey) => {
  const tz = resolveOrgTimezone(orgTimezone);
  const key = String(localDateKey).trim();
  const m = moment.tz(key, 'YYYY-MM-DD', true, tz).startOf('day');
  if (!m.isValid()) {
    throw new Error(`Invalid localDateKey "${localDateKey}" for timezone ${tz}`);
  }
  return m.toDate();
};

/**
 * Last millisecond of org-local calendar day.
 * @param {string} orgTimezone
 * @param {string} localDateKey - YYYY-MM-DD in org timezone
 * @returns {Date}
 */
const endOfOrgLocalDay = (orgTimezone, localDateKey) => {
  const tz = resolveOrgTimezone(orgTimezone);
  const key = String(localDateKey).trim();
  const m = moment.tz(key, 'YYYY-MM-DD', true, tz).endOf('day');
  if (!m.isValid()) {
    throw new Error(`Invalid localDateKey "${localDateKey}" for timezone ${tz}`);
  }
  return m.toDate();
};

/**
 * Exclusive end of org-local day (start of next local day). Prefer for range queries.
 * @param {string} orgTimezone
 * @param {string} localDateKey
 * @returns {Date}
 */
const endExclusiveOfOrgLocalDay = (orgTimezone, localDateKey) => {
  const tz = resolveOrgTimezone(orgTimezone);
  const key = String(localDateKey).trim();
  const m = moment.tz(key, 'YYYY-MM-DD', true, tz).add(1, 'day').startOf('day');
  if (!m.isValid()) {
    throw new Error(`Invalid localDateKey "${localDateKey}" for timezone ${tz}`);
  }
  return m.toDate();
};

/**
 * Resolve digest day identity from optional API input and org timezone.
 * @param {string|null|undefined} orgTimezone
 * @param {Date|string|null|undefined} input - ISO instant, YYYY-MM-DD local key, or empty for today
 * @returns {{ localDateKey: string, digestDate: Date, timezone: string }}
 */
const resolveOrgLocalDigestDay = (orgTimezone, input) => {
  const timezone = resolveOrgTimezone(orgTimezone);
  const hasInput = input != null && String(input).trim() !== '';

  if (!hasInput) {
    const localDateKey = moment.tz(timezone).format('YYYY-MM-DD');
    return {
      localDateKey,
      digestDate: startOfOrgLocalDay(timezone, localDateKey),
      timezone,
    };
  }

  const trimmed = String(input).trim();
  if (LOCAL_DATE_KEY_PATTERN.test(trimmed)) {
    return {
      localDateKey: trimmed,
      digestDate: startOfOrgLocalDay(timezone, trimmed),
      timezone,
    };
  }

  const instant = new Date(trimmed);
  if (Number.isNaN(instant.getTime())) {
    throw new Error('Invalid digestDate');
  }
  const localDateKey = localDateKeyForInstant(timezone, instant);
  return {
    localDateKey,
    digestDate: startOfOrgLocalDay(timezone, localDateKey),
    timezone,
  };
};

/**
 * Org-local day-start instant from a stored digest payload (new or legacy field name).
 * @param {Record<string, unknown>|null|undefined} payload
 * @returns {string|null}
 */
const getPayloadDigestDayStartIso = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload.digestDayStartIso ?? payload.digestDateUtc ?? null;
};

module.exports = {
  DEFAULT_ORG_TIMEZONE,
  resolveOrgTimezone,
  localDateKeyForInstant,
  startOfOrgLocalDay,
  endOfOrgLocalDay,
  endExclusiveOfOrgLocalDay,
  resolveOrgLocalDigestDay,
  getPayloadDigestDayStartIso,
};
