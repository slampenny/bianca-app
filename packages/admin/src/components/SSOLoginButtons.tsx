import { useState } from "react"
import { isGoogleSsoConfigured, isMicrosoftSsoConfigured } from "../config/sso"
import type { SSOError, SSOUser } from "../services/webSsoService"
import { startSsoRedirect } from "../services/webSsoService"

type Props = {
  disabled?: boolean
  onSsoError?: (err: SSOError) => void
  onSsoSuccess?: (
    user: SSOUser & {
      tokens?: unknown
      backendUser?: unknown
      backendOrg?: unknown
    },
  ) => void
}

export function SSOLoginButtons({ disabled, onSsoError, onSsoSuccess }: Props) {
  const [googleLoading, setGoogleLoading] = useState(false)
  const [microsoftLoading, setMicrosoftLoading] = useState(false)

  const showGoogle = isGoogleSsoConfigured()
  const showMicrosoft = isMicrosoftSsoConfigured()
  if (!showGoogle && !showMicrosoft) return null

  const busy = disabled || googleLoading || microsoftLoading

  const runGoogle = async () => {
    if (busy) return
    setGoogleLoading(true)
    try {
      const result = await startSsoRedirect("google")
      if ("redirecting" in result && result.redirecting) return
      if ("error" in result) {
        onSsoError?.(result)
        return
      }
      onSsoSuccess?.(result)
    } finally {
      setGoogleLoading(false)
    }
  }

  const runMicrosoft = async () => {
    if (busy) return
    setMicrosoftLoading(true)
    try {
      const result = await startSsoRedirect("microsoft")
      if ("redirecting" in result && result.redirecting) return
      if ("error" in result) {
        onSsoError?.(result)
        return
      }
      onSsoSuccess?.(result)
    } finally {
      setMicrosoftLoading(false)
    }
  }

  return (
    <div className="admin-sso-block">
      <p className="admin-sso-divider">or continue with</p>
      <div className="admin-sso-row">
        {showGoogle ? (
          <button
            type="button"
            className="admin-sso-google"
            disabled={busy}
            data-testid="admin-google-sso-button"
            onClick={() => void runGoogle()}
          >
            {googleLoading ? "…" : (
              <>
                <span className="admin-sso-google-icon" aria-hidden>
                  G
                </span>
                Google
              </>
            )}
          </button>
        ) : null}
        {showMicrosoft ? (
          <button
            type="button"
            className="admin-sso-microsoft"
            disabled={busy}
            data-testid="admin-microsoft-sso-button"
            onClick={() => void runMicrosoft()}
          >
            {microsoftLoading ? "…" : (
              <>
                <span className="admin-sso-ms-icon" aria-hidden>
                  M
                </span>
                Microsoft
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  )
}
