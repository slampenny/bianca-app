/**
 * Application-wide constants
 * Centralized location for magic numbers and strings
 */

/**
 * Polling intervals for real-time data updates (in milliseconds)
 */
export const POLLING_INTERVALS = {
  CALL_STATUS: 2000, // 2 seconds
  CONVERSATION: 3000, // 3 seconds
  ALERTS: 5000, // 5 seconds
  MFA_STATUS: 10000, // 10 seconds
} as const

/**
 * Fallback color values
 */
export const FALLBACK_COLORS = {
  WHITE: '#FFFFFF',
  BLACK: '#000000',
} as const

/**
 * Common string constants
 */
export const STRINGS = {
  TEMP_CALL_ID: 'temp-call',
  KEYBOARD_PERSIST_TAPS: 'handled' as const,
} as const

/**
 * Timeout values (in milliseconds)
 */
export const TIMEOUTS = {
  API_REQUEST: 10000, // 10 seconds
  AUTH_RETRY_DELAY: 100, // 100ms
  NAVIGATION_DELAY: 500, // 500ms - common delay for navigation transitions
  SUCCESS_MESSAGE_DISPLAY: 5000, // 5 seconds - how long to show success messages
  EMAIL_VERIFICATION_REDIRECT: 2000, // 2 seconds - delay before redirect after email verification
  PASSWORD_RESET_REDIRECT: 2000, // 2 seconds - delay before redirect after password reset
} as const

/**
 * Common validation constants
 */
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MIN_PHONE_LENGTH: 10,
  MFA_TOKEN_LENGTH: 6,
  BACKUP_CODE_LENGTH: 8,
} as const

/**
 * Animation and UI timing constants (in milliseconds)
 */
export const ANIMATION = {
  TOAST_DURATION: 3000, // 3 seconds - default toast display time
  MODAL_TRANSITION: 300, // 300ms - modal open/close animation
  BUTTON_PRESS_DELAY: 100, // 100ms - debounce for button presses
} as const

/**
 * Common numeric constants
 */
export const NUMBERS = {
  MAX_RETRY_ATTEMPTS: 3,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  DEBOUNCE_DELAY: 300, // 300ms - default debounce delay for inputs
} as const

