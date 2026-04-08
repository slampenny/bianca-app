/** Mirrors backend `custom.validation` password rules. */
export function validatePasswordRules(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters."
  if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
    return "Password must contain at least one letter and one number."
  }
  return null
}

export function validatePhoneDigits(phone: string): boolean {
  const trimmed = phone.replace(/\s/g, "")
  return /^(\+1\d{10}|\d{10,})$/.test(trimmed)
}
