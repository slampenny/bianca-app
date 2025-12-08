/**
 * Centralized logging utility
 * - In development: logs to console
 * - In production: errors/warnings still log, but info/debug are suppressed
 * - Future: Can integrate with crash reporting services
 */

const isDev = __DEV__

export const logger = {
  /**
   * Log informational messages (only in development)
   */
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args)
    }
  },

  /**
   * Log errors (always logged, even in production)
   */
  error: (...args: any[]) => {
    console.error(...args)
    // TODO: In production, send to crash reporting service
  },

  /**
   * Log warnings (always logged, even in production)
   */
  warn: (...args: any[]) => {
    console.warn(...args)
    // TODO: In production, send to monitoring service
  },

  /**
   * Log debug messages (only in development)
   */
  debug: (...args: any[]) => {
    if (isDev) {
      console.log('[DEBUG]', ...args)
    }
  },

  /**
   * Structured logging for production analytics
   */
  info: (message: string, meta?: object) => {
    if (isDev) {
      console.log(`[INFO] ${message}`, meta || '')
    }
    // TODO: In production, send to analytics service
  },
}

export default logger

