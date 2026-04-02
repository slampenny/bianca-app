/** Keep in sync with packages/web/src/auth/AdminSessionHandoffBridge.tsx */
export const SESSION_HANDOFF_MESSAGE_TYPE = "BIANCA_INJECT_SESSION" as const

export type SessionHandoffPayload = {
  tokens: unknown
  caregiver: unknown
  org?: unknown
}
