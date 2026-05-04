import { FormEvent, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { canManageBilling } from "../lib/roleAccess"
import {
  useAttachPaymentMethodMutation,
  useDetachPaymentMethodMutation,
  useGetOrgPaymentMethodsQuery,
  useSetDefaultPaymentMethodMutation,
} from "../services/api/paymentMethodApi"
import { getCurrentUser } from "../store/authSlice"
import { useAppSelector } from "../store/store"
import { ConfirmModal } from "../components/ConfirmModal"
import "../app.css"

function methodLabel(type?: string, brand?: string) {
  if (type === "card") return brand ? `Card (${brand})` : "Card"
  if (type) return type
  return "Payment method"
}

export function SettingsBillingPage() {
  const user = useAppSelector(getCurrentUser)
  const role = user?.role
  const orgId = user?.org ? String(user.org) : ""
  const canManage = canManageBilling(role)

  const { data, isLoading, isError, error, refetch } = useGetOrgPaymentMethodsQuery({ orgId }, { skip: !orgId || !canManage })
  const [attachPaymentMethod, { isLoading: attaching }] = useAttachPaymentMethodMutation()
  const [setDefaultPaymentMethod, { isLoading: settingDefault }] = useSetDefaultPaymentMethodMutation()
  const [detachPaymentMethod, { isLoading: detaching }] = useDetachPaymentMethodMutation()

  const methods = useMemo(() => data ?? [], [data])
  const [newPaymentMethodId, setNewPaymentMethodId] = useState("")
  const [message, setMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [removePaymentMethodId, setRemovePaymentMethodId] = useState<string | null>(null)

  if (!canManage) {
    return (
      <div data-testid="settings-billing-page" className="va-page-wrap">
        <Link to="/settings" className="va-link" style={{ fontSize: "0.875rem" }}>
          ← Back to settings
        </Link>
        <h1 className="va-page-title" style={{ marginTop: "1rem" }}>
          Billing
        </h1>
        <div className="va-page-section">
          <p style={{ margin: 0, color: "var(--va-slate-600)" }}>You do not have permission to manage billing.</p>
        </div>
      </div>
    )
  }

  const onAttach = async (e: FormEvent) => {
    e.preventDefault()
    setMessage("")
    setErrorMessage("")
    try {
      await attachPaymentMethod({ orgId, paymentMethodId: newPaymentMethodId.trim() }).unwrap()
      setNewPaymentMethodId("")
      setMessage("Payment method added.")
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setErrorMessage(typeof msg === "string" ? msg : "Could not add payment method.")
    }
  }

  const onSetDefault = async (paymentMethodId: string) => {
    setMessage("")
    setErrorMessage("")
    try {
      await setDefaultPaymentMethod({ orgId, paymentMethodId }).unwrap()
      setMessage("Default payment method updated.")
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setErrorMessage(typeof msg === "string" ? msg : "Could not update default method.")
    }
  }

  const performRemovePaymentMethod = async () => {
    if (!removePaymentMethodId) return
    const paymentMethodId = removePaymentMethodId
    setMessage("")
    setErrorMessage("")
    try {
      await detachPaymentMethod({ orgId, paymentMethodId }).unwrap()
      setMessage("Payment method removed.")
      setRemovePaymentMethodId(null)
      await refetch()
    } catch (err: unknown) {
      const msg = (err as { data?: { message?: string } })?.data?.message
      setErrorMessage(typeof msg === "string" ? msg : "Could not remove payment method.")
    }
  }

  return (
    <div data-testid="settings-billing-page" className="va-page-wrap">
      <Link to="/settings" className="va-link" style={{ fontSize: "0.875rem" }}>
        ← Back to settings
      </Link>
      <h1 className="va-page-title" style={{ marginTop: "1rem" }}>
        Billing
      </h1>
      <p style={{ color: "var(--va-slate-500)", fontSize: "0.875rem", lineHeight: 1.45 }}>
        Manage organization payment methods and default billing source.
      </p>

      <div className="va-page-section" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Payment methods</h2>
        {isLoading ? <p style={{ color: "var(--va-slate-500)", margin: 0 }}>Loading…</p> : null}
        {isError ? (
          <p style={{ color: "var(--va-red-600)", margin: 0 }}>
            {(error as { data?: { message?: string } })?.data?.message || "Could not load payment methods."}
          </p>
        ) : null}
        {!isLoading && !isError && methods.length === 0 ? (
          <p data-testid="billing-empty-state" style={{ color: "var(--va-slate-500)", margin: 0 }}>
            No payment methods yet.
          </p>
        ) : null}
        {!isLoading && !isError && methods.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {methods.map((m) => {
              const id = String(m.id ?? "")
              return (
                <li
                  key={id}
                  data-testid={`billing-payment-method-${id}`}
                  style={{ border: "1px solid var(--va-slate-200)", borderRadius: 10, padding: "0.65rem 0.75rem" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "0.875rem", color: "var(--va-slate-700)" }}>
                      <strong>{methodLabel(m.type, m.brand)}</strong> · •••• {m.last4 || "----"}
                      {m.expMonth && m.expYear ? ` · exp ${String(m.expMonth).padStart(2, "0")}/${String(m.expYear).slice(-2)}` : ""}
                      {m.isDefault ? " · Default" : ""}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {!m.isDefault ? (
                        <button
                          type="button"
                          className="va-btn-secondary"
                          data-testid={`billing-set-default-${id}`}
                          onClick={() => void onSetDefault(id)}
                          disabled={settingDefault}
                        >
                          Set default
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="va-btn-ghost"
                        data-testid={`billing-remove-${id}`}
                        style={{ color: "var(--va-red-600)", borderColor: "var(--va-red-200)" }}
                        onClick={() => setRemovePaymentMethodId(id)}
                        disabled={detaching}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      <div className="va-page-section" style={{ marginTop: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Add payment method</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--va-slate-600)", marginTop: 0 }}>
          Enter a Stripe payment method ID (for staging/testing workflows).
        </p>
        <form onSubmit={(e) => void onAttach(e)} style={{ display: "grid", gap: 8 }}>
          <label style={{ display: "grid", gap: 6, fontSize: "0.8125rem", color: "var(--va-slate-600)" }}>
            Payment method ID
            <input
              data-testid="billing-payment-method-id-input"
              className="va-login-input"
              value={newPaymentMethodId}
              onChange={(e) => setNewPaymentMethodId(e.target.value)}
              placeholder="pm_..."
              required
            />
          </label>
          <button type="submit" className="va-btn-primary" data-testid="billing-add-payment-method" disabled={attaching}>
            {attaching ? "Adding…" : "Add payment method"}
          </button>
        </form>
        {message ? (
          <div className="va-login-success" role="status" style={{ marginTop: 8 }}>
            {message}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="va-login-error" role="alert" style={{ marginTop: 8 }}>
            {errorMessage}
          </div>
        ) : null}
      </div>

      <ConfirmModal
        open={removePaymentMethodId !== null}
        title="Remove this payment method?"
        onClose={() => setRemovePaymentMethodId(null)}
        onConfirm={() => void performRemovePaymentMethod()}
        confirmLabel={detaching ? "Removing…" : "Remove"}
        confirmDisabled={detaching}
      />
    </div>
  )
}
