const defaultLogger = require('../config/logger');

/**
 * Register a recurring Agenda job idempotently.
 *
 * Cancels existing jobs with the same name, then calls agenda.every().
 * Intended for recurring jobs only — do not use for one-off agenda.schedule() jobs.
 *
 * @param {object} params
 * @param {import('agenda').Agenda} params.agenda
 * @param {string} params.jobName
 * @param {string} params.interval - Agenda interval (e.g. '15 minutes', cron expression)
 * @param {object} [params.data] - Optional job data passed to agenda.every()
 * @param {object} [params.logger] - Logger with info/warn methods
 * @returns {Promise<{ removed: number, job: * }>}
 */
async function scheduleRecurringJob({ agenda, jobName, interval, data, logger = defaultLogger }) {
  if (!agenda || !jobName || !interval) {
    throw new Error('scheduleRecurringJob requires agenda, jobName, and interval');
  }

  const removed = await agenda.cancel({ name: jobName });
  if (removed > 0) {
    logger.info(`[Agenda] Cancelled ${removed} existing ${jobName} job(s) before reschedule`);
  }

  const job = data !== undefined ? agenda.every(interval, jobName, data) : agenda.every(interval, jobName);
  logger.info(`[Agenda] Scheduled recurring job ${jobName} (${interval})`);
  return { removed, job };
}

module.exports = {
  scheduleRecurringJob,
};
