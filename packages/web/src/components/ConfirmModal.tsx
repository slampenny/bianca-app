import type { ReactNode } from "react"

export type ConfirmModalProps = {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmDisabled?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className="va-modal-backdrop" role="dialog" aria-modal aria-labelledby="va-confirm-modal-title" onClick={onClose}>
      <div className="va-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "28rem" }}>
        <div style={{ padding: "1.1rem 1.3rem", borderBottom: "1px solid var(--va-slate-200)" }}>
          <h3 id="va-confirm-modal-title" style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
            {title}
          </h3>
        </div>
        {children ? (
          <div style={{ padding: "1rem 1.3rem", fontSize: "0.875rem", color: "var(--va-slate-700)", lineHeight: 1.5 }}>
            {children}
          </div>
        ) : null}
        <div
          style={{
            padding: "0.85rem 1.3rem",
            borderTop: "1px solid var(--va-slate-200)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <button type="button" className="va-btn-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className="va-btn-primary" onClick={onConfirm} disabled={confirmDisabled}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
