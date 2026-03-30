export function mapValidationErrorToMessage(validationError: string): string {
  if (validationError === "can't be blank") return "Please enter your email address"
  if (validationError === "must be at least 6 characters") return "Email address is too short"
  if (validationError === "must be a valid email address") return "Please enter a valid email address"
  return validationError
}

export function parseLoginError(error: unknown): {
  message: string
  requiresSSOLinking?: boolean
  emailVerificationRequired?: boolean
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

  let finalMessage = "Failed to log in. Check your email and password."
  if (errorMessage) finalMessage = errorMessage
  else if (errorStatus === 401 || errorStatus === "FETCH_ERROR") {
    finalMessage = "Invalid email or password."
  }

  return { message: finalMessage }
}
