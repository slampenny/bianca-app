/**
 * Normalize RTK Query / fetch errors from POST /auth/login (aligned with mobile LoginForm).
 */
export function mapValidationErrorToMessage(validationError: string): string {
  if (validationError === "can't be blank") return "Please enter your email address"
  if (validationError === "must be at least 6 characters") return "Email address is too short"
  if (validationError === "must be a valid email address") return "Please enter a valid email address"
  return validationError
}

export function parseLoginError(error: unknown): {
  message: string
  requiresSSOLinking?: boolean
  ssoProvider?: string
  emailVerificationRequired?: boolean
} {
  const errorAny = error as Record<string, unknown>
  const errorData = errorAny?.data as Record<string, unknown> | string | undefined
  const errorStatus = errorAny?.status as number | string | undefined
  const customError = errorAny?.error as { status?: string; error?: string } | undefined

  let errorMessage: string | null = null
  if (customError?.status === "CUSTOM_ERROR" && customError.error) {
    errorMessage = customError.error
  } else if (errorData && typeof errorData === "object") {
    if (typeof errorData.message === "string") errorMessage = errorData.message
    else if (typeof errorData.error === "string") errorMessage = errorData.error
  } else if (typeof errorData === "string") {
    errorMessage = errorData
  }

  const dataObj = errorData && typeof errorData === "object" ? (errorData as Record<string, unknown>) : {}
  const requiresLinking =
    dataObj.requiresPasswordLinking === true ||
    dataObj.requiresPasswordLinking === "true" ||
    dataObj.requiresPasswordLinking === 1 ||
    (errorStatus === 403 &&
      (errorMessage?.toLowerCase().includes("sso") || errorMessage?.toLowerCase().includes("link")))

  if (requiresLinking) {
    return {
      message:
        errorMessage ||
        "This account was created with SSO. Please link your account by setting a password or using SSO login.",
      requiresSSOLinking: true,
      ssoProvider: (dataObj.ssoProvider as string) || "google",
    }
  }

  if (errorMessage?.includes("verify your email") || errorMessage?.includes("verification")) {
    return { message: errorMessage || "Please verify your email address before logging in.", emailVerificationRequired: true }
  }

  let finalMessage = "Failed to log in. Please check your email and password."
  if (errorMessage) finalMessage = errorMessage
  else if (typeof dataObj.error === "string") finalMessage = dataObj.error
  else if (typeof errorData === "string") finalMessage = errorData
  else if (errorStatus === 401 || errorStatus === "FETCH_ERROR") {
    finalMessage = "Invalid email or password. Please check your credentials and try again."
  } else if (errorStatus) {
    finalMessage = "Login failed. Please check your email and password."
  }

  return { message: finalMessage }
}
