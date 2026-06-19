import { type FormEvent, useEffect, useRef, useState } from "react"
import { useEndAdminCallMutation, useLazyGetAdminCallStatusQuery, usePlaceAdminCallMutation } from "../services/api/adminApi"
import { AdminPageHeader } from "../components/AdminPageHeader"

const TERMINAL_STATUSES = ["completed", "failed", "machine", "ended", "no_answer", "busy"]

function isTerminal(status: string | undefined) {
  return TERMINAL_STATUSES.some((s) => (status ?? "").includes(s))
}

export function PlaceCallPage() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")

  const [conversationId, setConversationId] = useState<string | null>(null)
  const [callStatus, setCallStatus] = useState<string | undefined>(undefined)
  const [clientName, setClientName] = useState<string | null>(null)
  const [clientPhone, setClientPhone] = useState<string | null>(null)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [placeCall, { isLoading: placing }] = usePlaceAdminCallMutation()
  const [getStatus] = useLazyGetAdminCallStatusQuery()
  const [endCall, { isLoading: ending }] = useEndAdminCallMutation()

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => {
    if (!conversationId) return
    stopPolling()
    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const data = await getStatus(conversationId, false).unwrap()
          const status = data.callStatus ?? data.status
          setCallStatus(status)
          if (isTerminal(status)) stopPolling()
        } catch {
          // ignore transient poll errors
        }
      })()
    }, 2000)
    return stopPolling
  }, [conversationId])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      const res = await placeCall({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
      }).unwrap()
      setConversationId(res.conversationId)
      setCallStatus(res.callStatus)
      setClientName(res.clientName)
      setClientPhone(res.clientPhone)
    } catch {
      setError("Failed to place call. Check that the phone number is valid and the telephony service is configured.")
    }
  }

  const handleEndCall = async () => {
    if (!conversationId) return
    stopPolling()
    try {
      await endCall({ conversationId, outcome: "answered" }).unwrap()
      setCallStatus("completed")
    } catch {
      setError("Failed to end call.")
    }
  }

  const reset = () => {
    stopPolling()
    setConversationId(null)
    setCallStatus(undefined)
    setClientName(null)
    setClientPhone(null)
    setError("")
  }

  const active = conversationId !== null && !isTerminal(callStatus)

  return (
    <>
      <AdminPageHeader
        title="Place call"
        subtitle="Initiate an outbound call by entering a name and phone number. Clients are stored in the Admin Test Calls org — calling the same number again reuses the existing client record."
      />
      <main className="admin-main">
        <div className="admin-card admin-card--wide">
          {conversationId === null ? (
            <form
              className="admin-form"
              style={{ flexDirection: "row", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}
              onSubmit={(e) => void handleSubmit(e)}
            >
              <label className="admin-label" style={{ flex: "1 1 150px" }}>
                First name
                <input
                  className="admin-input"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
              </label>
              <label className="admin-label" style={{ flex: "1 1 150px" }}>
                Last name
                <input
                  className="admin-input"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                />
              </label>
              <label className="admin-label" style={{ flex: "1 1 170px" }}>
                Phone number
                <input
                  className="admin-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="+15551234567"
                  required
                />
              </label>
              <button type="submit" className="admin-btn admin-btn--primary" disabled={placing}>
                {placing ? "Placing call…" : "Call"}
              </button>
            </form>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p>
                <strong>{clientName}</strong>
                {clientPhone ? <> &mdash; {clientPhone}</> : null}
              </p>
              <p>
                Status: <code className="admin-code">{callStatus ?? "…"}</code>
              </p>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {active ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    onClick={() => void handleEndCall()}
                    disabled={ending}
                  >
                    {ending ? "Ending…" : "End call"}
                  </button>
                ) : null}
                <button type="button" className="admin-btn admin-btn--ghost" onClick={reset}>
                  Place another call
                </button>
              </div>
            </div>
          )}
          {error ? (
            <p className="admin-error" role="alert" style={{ marginTop: "0.75rem" }}>
              {error}
            </p>
          ) : null}
        </div>
      </main>
    </>
  )
}
