/** Format phone number to E.164 (+1XXXXXXXXXX for NANP). Matches mobile PhoneInputWeb behavior. */
export function formatPhoneNumber(value: string): string {
  if (!value) return ""

  const digits = value.replace(/\D/g, "")

  if (value.startsWith("+")) {
    return value
  }

  if (digits.length === 10) {
    return `+1${digits}`
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`
  }

  if (digits.length > 11) {
    return value.startsWith("+") ? value : `+${digits}`
  }

  return value
}

/** Returns an error message when invalid, or null when valid/empty. */
export function validatePhoneNumber(value: string): string | null {
  if (!value) return null

  const digits = value.replace(/\D/g, "")

  if (value.startsWith("+")) {
    const e164Regex = /^\+[1-9]\d{9,14}$/
    if (e164Regex.test(value)) {
      return null
    }
    return "Phone number must be in E.164 format (e.g., +1234567890)"
  }

  if (digits.length === 10) {
    return null
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return null
  }

  return "Phone number must be 10 digits or in E.164 format (e.g., +1234567890)"
}

export function isValidPhoneNumber(value: string): boolean {
  const formatted = formatPhoneNumber(value.trim())
  return formatted.length > 0 && validatePhoneNumber(formatted) === null
}
