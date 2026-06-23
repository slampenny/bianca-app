import * as DialogPrimitive from "@radix-ui/react-dialog"
import type { ReactNode } from "react"
import { Button } from "./Button"

export type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children?: ReactNode
  wide?: boolean
}

export function Dialog({ open, onOpenChange, title, children, wide }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bianca-dialog-overlay" />
        <DialogPrimitive.Content
          className={["bianca-dialog-content", wide ? "bianca-dialog-content--wide" : ""].filter(Boolean).join(" ")}
          aria-describedby={undefined}
        >
          <div className="bianca-dialog-header">
            <DialogPrimitive.Title className="bianca-dialog-title">{title}</DialogPrimitive.Title>
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
}

/** Flexible modal with optional subtitle, close control, and custom footer. */
export function Modal({ open, onOpenChange, title, subtitle, wide, closeLabel, footer, children }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bianca-dialog-overlay" />
        <DialogPrimitive.Content
          className={["bianca-dialog-content", wide ? "bianca-dialog-content--wide" : ""].filter(Boolean).join(" ")}
          {...(!subtitle ? { "aria-describedby": undefined } : {})}
        >
          <div className="bianca-dialog-header bianca-dialog-header--split">
            <div>
              <DialogPrimitive.Title className="bianca-dialog-title">{title}</DialogPrimitive.Title>
              {subtitle ? (
                <DialogPrimitive.Description className="bianca-dialog-subtitle">{subtitle}</DialogPrimitive.Description>
              ) : null}
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
        <DialogPrimitive.Content className="bianca-dialog-content" aria-describedby={undefined}>
          <div className="bianca-dialog-header">
            <DialogPrimitive.Title className="bianca-dialog-title">{title}</DialogPrimitive.Title>
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
