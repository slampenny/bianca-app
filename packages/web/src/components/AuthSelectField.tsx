import { useId, type CSSProperties, type ReactNode, type SelectHTMLAttributes } from "react"

export type AuthSelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  label: ReactNode
  id?: string
  selectTestId?: string
  selectClassName?: string
  labelClassName?: string
  style?: CSSProperties
}

/** Auth form select — matches legacy va-login-label / va-login-input styling. */
export function AuthSelectField({
  label,
  className,
  style,
  id: idProp,
  selectTestId,
  selectClassName,
  labelClassName,
  children,
  ...selectProps
}: AuthSelectFieldProps) {
  const reactId = useId()
  const id = idProp ?? reactId
  const selectClasses = selectClassName
    ? ["bianca-focus-ring", selectClassName].filter(Boolean).join(" ")
    : ["va-login-input", "bianca-focus-ring"].filter(Boolean).join(" ")

  return (
    <div className={["bianca-field", "va-login-label", className].filter(Boolean).join(" ")} style={style}>
      <label className={["bianca-field__label", labelClassName].filter(Boolean).join(" ")} htmlFor={id}>
        {label}
      </label>
      <select id={id} className={selectClasses} data-testid={selectTestId} {...selectProps}>
        {children}
      </select>
    </div>
  )
}
