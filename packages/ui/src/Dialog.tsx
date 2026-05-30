import * as DialogPrimitive from "@radix-ui/react-dialog"
import type { ReactNode } from "react"
import { Button } from "./Button"

export type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children?: ReactNode
  wide?: boolean
  /** ID for aria-labelledby; auto-generated from title if omitted. */
  titleId?: string
}

export function Dialog({ open, onOpenChange, title, children, wide, titleId }: DialogProps) {
  const labelledBy = titleId ?? "bianca-dialog-title"

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bianca-dialog-overlay" />
        <DialogPrimitive.Content
          className={["bianca-dialog-content", wide ? "bianca-dialog-content--wide" : ""].filter(Boolean).join(" ")}
          aria-labelledby={labelledBy}
        >
          <div className="bianca-dialog-header">
            <DialogPrimitive.Title id={labelledBy} className="bianca-dialog-title">
              {title}
            </DialogPrimitive.Title>
          </div>
          {children ? <div className="bianca-dialog-body">{children}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export type ModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  wide?: boolean
  closeLabel: string
  footer?: ReactNode
  children: ReactNode
  titleId?: string
}

/** Flexible modal with optional subtitle, close control, and custom footer. */
export function Modal({ open, onOpenChange, title, subtitle, wide, closeLabel, footer, children, titleId }: ModalProps) {
  const labelledBy = titleId ?? "bianca-modal-title"

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bianca-dialog-overlay" />
        <DialogPrimitive.Content
          className={["bianca-dialog-content", wide ? "bianca-dialog-content--wide" : ""].filter(Boolean).join(" ")}
          aria-labelledby={labelledBy}
        >
          <div className="bianca-dialog-header bianca-dialog-header--split">
            <div>
              <DialogPrimitive.Title id={labelledBy} className="bianca-dialog-title">
                {title}
              </DialogPrimitive.Title>
              {subtitle ? <p className="bianca-dialog-subtitle">{subtitle}</p> : null}
            </div>
            <DialogPrimitive.Close asChild>
              <button type="button" className="bianca-dialog-close bianca-focus-ring" aria-label={closeLabel}>
                ×
              </button>
            </DialogPrimitive.Close>
          </div>
          <div className="bianca-dialog-body">{children}</div>
          {footer ? <div className="bianca-dialog-footer bianca-dialog-footer--muted">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export type ConfirmDialogProps = {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmDisabled?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Accessible confirm/cancel modal — drop-in for legacy ConfirmModal. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmDisabled,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bianca-dialog-overlay" />
        <DialogPrimitive.Content
          className="bianca-dialog-content"
          aria-labelledby="bianca-confirm-dialog-title"
        >
          <div className="bianca-dialog-header">
            <DialogPrimitive.Title id="bianca-confirm-dialog-title" className="bianca-dialog-title">
              {title}
            </DialogPrimitive.Title>
          </div>
          {children ? <div className="bianca-dialog-body">{children}</div> : null}
          <div className="bianca-dialog-footer">
            <Button variant="secondary" onClick={onClose}>
              {cancelLabel}
            </Button>
            <Button variant="primary" onClick={onConfirm} disabled={confirmDisabled}>
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
