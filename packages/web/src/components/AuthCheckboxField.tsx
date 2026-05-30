import { useId, type InputHTMLAttributes, type ReactNode } from "react"

export type AuthCheckboxFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  label: ReactNode
  id?: string
  inputTestId?: string
}

/** Auth form checkbox with an associated label (supports rich label content). */
export function AuthCheckboxField({
  label,
  className,
  id: idProp,
  inputTestId,
  ...inputProps
}: AuthCheckboxFieldProps) {
  const reactId = useId()
  const id = idProp ?? reactId

  return (
    <div
      className={["bianca-field", "va-login-label", className].filter(Boolean).join(" ")}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: "0.5rem" }}
    >
      <input id={id} type="checkbox" className="bianca-focus-ring" data-testid={inputTestId} {...inputProps} />
      <label className="bianca-field__label" htmlFor={id} style={{ fontWeight: 400, lineHeight: 1.5 }}>
        {label}
      </label>
    </div>
  )
}
