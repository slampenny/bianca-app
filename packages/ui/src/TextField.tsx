import { useId, type InputHTMLAttributes, type ReactNode } from "react"

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  label?: ReactNode
  error?: ReactNode
  helper?: ReactNode
  inputClassName?: string
  /** For E2E / Playwright (`data-testid` on the input). */
  inputTestId?: string
  id?: string
}

export function TextField({
  label,
  error,
  helper,
  className,
  inputClassName,
  inputTestId,
  id: idProp,
  required,
  disabled,
  "aria-describedby": ariaDescribedBy,
  ...inputProps
}: TextFieldProps) {
  const reactId = useId()
  const id = idProp ?? reactId
  const errorId = error ? `${id}-error` : undefined
  const helperId = helper ? `${id}-helper` : undefined
  const describedBy = [ariaDescribedBy, errorId, helperId].filter(Boolean).join(" ") || undefined

  return (
    <div className={["bianca-field", className].filter(Boolean).join(" ")}>
      {label != null ? (
        <label className="bianca-field__label" htmlFor={id}>
          {label}
          {required ? (
            <>
              {" "}
              <span aria-hidden="true">*</span>
            </>
          ) : null}
        </label>
      ) : null}
      <input
        id={id}
        className={["bianca-field__input", "bianca-focus-ring", inputClassName].filter(Boolean).join(" ")}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        data-testid={inputTestId}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="bianca-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {helper && !error ? (
        <p id={helperId} className="bianca-field__helper">
          {helper}
        </p>
      ) : null}
    </div>
  )
}
