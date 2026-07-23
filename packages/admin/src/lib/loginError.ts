export function mapValidationErrorToMessage(validationError: string): string {
  if (validationError === "can't be blank") return "Please enter your email address"
  if (validationError === "must be at least 6 characters") return "Email address is too short"
  if (validationError === "must be a valid email address") return "Please enter a valid email address"
  return validationError
}

function isGenericInternalServerMessage(message: string | null | undefined): boolean {
  if (!message) return false
  const normalized = message.trim().toLowerCase()
  return (
    normalized === "internal server error" ||
    normalized === "internal server error." ||
    normalized === "an internal server error occurred"
  )
}

/**
 * Normalize RTK Query errors from POST /auth/login for the admin console.
 * Never surface a bare "Internal Server Error" — prefer the API message, or a clear fallback.
 */
export function parseLoginError(error: unknown): {
  message: string
  requiresSSOLinking?: boolean
  emailVerificationRequired?: boolean
  accountLocked?: boolean
} {
  const errorAny = error as Record<string, unknown>
  const errorData = errorAny?.data as Record<string, unknown> | string | undefined
  const errorStatus = errorAny?.status as number | string | undefined

  let errorMessage: string | null = null
  if (errorData && typeof errorData === "object") {
    if (typeof errorData.message === "string") errorMessage = errorData.message
    else if (typeof errorData.error === "string") errorMessage = errorData.error
  } else if (typeof errorData === "string") {
    errorMessage = errorData
  }

  const dataObj = errorData && typeof errorData === "object" ? (errorData as Record<string, unknown>) : {}
  const requiresLinking =
    dataObj.requiresPasswordLinking === true ||
    (errorStatus === 403 &&
      (errorMessage?.toLowerCase().includes("sso") || errorMessage?.toLowerCase().includes("link")))

  if (requiresLinking) {
    return {
      message:
        errorMessage ||
        "This account uses SSO. Sign in from the main Bianca app or use a password-linked admin account.",
      requiresSSOLinking: true,
    }
  }

  if (errorMessage?.includes("verify your email") || errorMessage?.includes("verification")) {
    return { message: errorMessage || "Please verify your email before signing in.", emailVerificationRequired: true }
  }

  const locked =
    Boolean(errorMessage && /account is locked/i.test(errorMessage)) ||
    (errorStatus === 403 && Boolean(errorMessage && /locked/i.test(errorMessage)))
  if (locked && errorMessage && !isGenericInternalServerMessage(errorMessage)) {
    return {
      message: errorMessage,
      accountLocked: true,
    }
  }
  if (locked) {
    return {
      message: "This account is locked. Contact support to restore access.",
      accountLocked: true,
    }
  }

  let finalMessage = "Failed to log in. Check your email and password."
  if (errorMessage && !isGenericInternalServerMessage(errorMessage)) {
    finalMessage = errorMessage
  } else if (errorStatus === 401 || errorStatus === "FETCH_ERROR") {
    finalMessage = "Invalid email or password."
  } else if (errorStatus === 403) {
    finalMessage = errorMessage && !isGenericInternalServerMessage(errorMessage)
      ? errorMessage
      : "Access denied. Contact support if you believe this is a mistake."
  } else if (errorStatus === 500 || isGenericInternalServerMessage(errorMessage)) {
    finalMessage = "Sign-in failed due to a server problem. Please try again, or contact support if it continues."
  }

  return { message: finalMessage }
}
