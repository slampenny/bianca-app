/**
 * Form validation utilities
 * Reusable validators following a consistent pattern
 */

export type ValidatorResult = string | null // null = valid, string = error message

export const validators = {
  /**
   * Email validation
   */
  email: (email: string): ValidatorResult => {
    if (!email || !email.trim()) {
      return 'Email is required'
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email) ? null : 'Invalid email address'
  },

  /**
   * Phone number validation
   * Accepts various formats, validates minimum length
   */
  phone: (phone: string): ValidatorResult => {
    if (!phone || !phone.trim()) {
      return 'Phone number is required'
    }
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 10) {
      return 'Phone number must be at least 10 digits'
    }
    return null
  },

  /**
   * Required field validation
   */
  required: (value: string | null | undefined, fieldName: string = 'This field'): ValidatorResult => {
    if (!value || !value.trim()) {
      return `${fieldName} is required`
    }
    return null
  },

  /**
   * Password validation
   */
  password: (password: string, minLength: number = 8): ValidatorResult => {
    if (!password) {
      return 'Password is required'
    }
    if (password.length < minLength) {
      return `Password must be at least ${minLength} characters`
    }
    return null
  },

  /**
   * Password confirmation validation
   */
  passwordMatch: (password: string, confirmPassword: string): ValidatorResult => {
    if (password !== confirmPassword) {
      return 'Passwords do not match'
    }
    return null
  },

  /**
   * MFA token validation (6 digits)
   */
  mfaToken: (token: string): ValidatorResult => {
    if (!token) {
      return 'Verification code is required'
    }
    const digitsOnly = token.replace(/\D/g, '')
    if (digitsOnly.length !== 6) {
      return 'Verification code must be 6 digits'
    }
    return null
  },

  /**
   * Backup code validation (8 characters)
   */
  backupCode: (code: string): ValidatorResult => {
    if (!code) {
      return 'Backup code is required'
    }
    if (code.length !== 8) {
      return 'Backup code must be 8 characters'
    }
    return null
  },
}

/**
 * Run multiple validators and return first error
 */
export function validate(
  value: string,
  ...validators: Array<(value: string) => ValidatorResult>
): ValidatorResult {
  for (const validator of validators) {
    const result = validator(value)
    if (result) return result
  }
  return null
}

