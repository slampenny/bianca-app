import type { TFunction } from "i18next"

/**
 * Normalize RTK Query / fetch errors from POST /auth/login (aligned with mobile LoginForm).
 */
export function mapValidationErrorToMessage(validationError: string, t: TFunction): string {
  if (validationError === "can't be blank") return t("login.validation.emailBlank")
  if (validationError === "must be at least 6 characters") return t("login.validation.emailTooShort")
  if (validationError === "must be a valid email address") return t("login.validation.emailInvalid")
  return validationError
}

export function parseLoginError(
  error: unknown,
  t: TFunction,
): {
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
      message: errorMessage || t("login.errors.ssoLinkDefault"),
      requiresSSOLinking: true,
      ssoProvider: (dataObj.ssoProvider as string) || "google",
    }
  }

  if (errorMessage?.includes("verify your email") || errorMessage?.includes("verification")) {
    return {
      message: errorMessage || t("login.errors.verifyBeforeLogin"),
      emailVerificationRequired: true,
    }
  }

  let finalMessage = t("login.errors.generic")
  if (errorMessage) finalMessage = errorMessage
  else if (typeof dataObj.error === "string") finalMessage = dataObj.error
  else if (typeof errorData === "string") finalMessage = errorData
  else if (errorStatus === 401 || errorStatus === "FETCH_ERROR") {
    finalMessage = t("login.errors.invalidCredentials")
  } else if (errorStatus) {
    finalMessage = t("login.errors.checkCredentials")
  }

  return { message: finalMessage }
}
