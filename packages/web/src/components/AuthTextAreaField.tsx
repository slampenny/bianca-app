import { useId, type CSSProperties, type ReactNode, type TextareaHTMLAttributes } from "react"

export type AuthTextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  label: ReactNode
  id?: string
  textareaTestId?: string
  style?: CSSProperties
  className?: string
}

/** Auth form textarea — matches legacy va-login-label / va-login-input styling. */
export function AuthTextAreaField({
  label,
  className,
  style,
  id: idProp,
  textareaTestId,
  ...textareaProps
}: AuthTextAreaFieldProps) {
  const reactId = useId()
  const id = idProp ?? reactId

  return (
    <div className={["bianca-field", "va-login-label", className].filter(Boolean).join(" ")} style={style}>
      <label className="bianca-field__label" htmlFor={id}>
        {label}
      </label>
      <textarea id={id} className="va-login-input bianca-focus-ring" data-testid={textareaTestId} {...textareaProps} />
    </div>
  )
}
