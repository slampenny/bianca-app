const moment = require('moment-timezone');
const { resolveOrgTimezone, endOfOrgLocalDay } = require('./digestDay.utils');

const LOCAL_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Org-local Monday date key (YYYY-MM-DD) for the ISO week containing `instant`.
 * @param {string} orgTimezone
 * @param {Date|string|number} instant
 * @returns {string}
 */
const localWeekKeyForInstant = (orgTimezone, instant) => {
  const tz = resolveOrgTimezone(orgTimezone);
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid instant for localWeekKeyForInstant');
  }
  return moment.tz(d, tz).startOf('isoWeek').format('YYYY-MM-DD');
};

/**
 * Start of org-local ISO week (Monday 00:00:00) as a UTC Date instant.
 * @param {string} orgTimezone
 * @param {string} localWeekKey - YYYY-MM-DD of the org-local Monday
 * @returns {Date}
 */
const startOfOrgLocalWeek = (orgTimezone, localWeekKey) => {
  const tz = resolveOrgTimezone(orgTimezone);
  const key = String(localWeekKey).trim();
  const m = moment.tz(key, 'YYYY-MM-DD', true, tz);
  if (!m.isValid()) {
    throw new Error(`Invalid localWeekKey "${localWeekKey}" for timezone ${tz}`);
  }
  if (m.isoWeekday() !== 1) {
    throw new Error(`localWeekKey "${localWeekKey}" must be a Monday in ${tz}`);
  }
  return m.startOf('day').toDate();
};

/**
 * Exclusive end of org-local week (start of next Monday 00:00:00 org-local).
 * @param {string} orgTimezone
 * @param {string} localWeekKey
 * @returns {Date}
 */
const endExclusiveOfOrgLocalWeek = (orgTimezone, localWeekKey) => {
  const tz = resolveOrgTimezone(orgTimezone);
  const key = String(localWeekKey).trim();
  const m = moment.tz(key, 'YYYY-MM-DD', true, tz);
  if (!m.isValid()) {
    throw new Error(`Invalid localWeekKey "${localWeekKey}" for timezone ${tz}`);
  }
  return m.add(1, 'week').startOf('day').toDate();
};

/**
 * Last millisecond of org-local Sunday for the week starting on localWeekKey.
 * @param {string} orgTimezone
 * @param {string} localWeekKey
 * @returns {Date}
 */
const endInclusiveOfOrgLocalWeek = (orgTimezone, localWeekKey) => {
  const tz = resolveOrgTimezone(orgTimezone);
  const sundayKey = moment
    .tz(localWeekKey, 'YYYY-MM-DD', true, tz)
    .add(6, 'days')
    .format('YYYY-MM-DD');
  return endOfOrgLocalDay(tz, sundayKey);
};

/**
 * Resolve digest week identity from optional API input and org timezone.
 * @param {string|null|undefined} orgTimezone
 * @param {Date|string|null|undefined} input - ISO instant, YYYY-MM-DD local key, or empty for current org-local week
 * @returns {{ localWeekKey: string, weekStart: Date, weekEndExclusive: Date, weekEnd: Date, timezone: string }}
 */
const resolveOrgLocalDigestWeek = (orgTimezone, input) => {
  const timezone = resolveOrgTimezone(orgTimezone);
  const hasInput = input != null && String(input).trim() !== '';

  const build = (localWeekKey) => {
    const weekStart = startOfOrgLocalWeek(timezone, localWeekKey);
    const weekEndExclusive = endExclusiveOfOrgLocalWeek(timezone, localWeekKey);
    const weekEnd = endInclusiveOfOrgLocalWeek(timezone, localWeekKey);
    return { localWeekKey, weekStart, weekEndExclusive, weekEnd, timezone };
  };

  if (!hasInput) {
    const localWeekKey = moment.tz(timezone).startOf('isoWeek').format('YYYY-MM-DD');
    return build(localWeekKey);
  }

  const trimmed = String(input).trim();
  if (LOCAL_DATE_KEY_PATTERN.test(trimmed)) {
    const localWeekKey = moment.tz(trimmed, 'YYYY-MM-DD', true, timezone).startOf('isoWeek').format('YYYY-MM-DD');
    return build(localWeekKey);
  }

  const instant = new Date(trimmed);
  if (Number.isNaN(instant.getTime())) {
    throw new Error('Invalid weekStart');
  }
  const localWeekKey = localWeekKeyForInstant(timezone, instant);
  return build(localWeekKey);
};

/** @deprecated Legacy UTC Monday helper — used only for legacyUtcWeek records. */
const startOfUtcWeekContaining = (input) => {
  const hasInput = input != null && String(input).trim() !== '';
  const d = hasInput ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid weekStart date');
  }
  const day = d.getUTCDay();
  const diffFromMonday = (day + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diffFromMonday, 0, 0, 0, 0));
};

/** @deprecated Legacy UTC week end — used only for legacyUtcWeek records. */
const endOfUtcWeek = (weekStartMonday) => {
  const end = new Date(weekStartMonday);
  end.setUTCDate(end.getUTCDate() + 7);
  end.setUTCMilliseconds(-1);
  return end;
};

module.exports = {
  LOCAL_DATE_KEY_PATTERN,
  localWeekKeyForInstant,
  startOfOrgLocalWeek,
  endExclusiveOfOrgLocalWeek,
  endInclusiveOfOrgLocalWeek,
  resolveOrgLocalDigestWeek,
  startOfUtcWeekContaining,
  endOfUtcWeek,
};
