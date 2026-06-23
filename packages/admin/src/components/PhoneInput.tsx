import { useEffect, useState, type CSSProperties } from "react"
import { formatPhoneNumber, validatePhoneNumber } from "@bianca-app/shared"

type PhoneInputProps = {
  value: string
  onChange: (formatted: string) => void
  label?: string
  error?: string
  disabled?: boolean
  required?: boolean
  id?: string
  placeholder?: string
  className?: string
  style?: CSSProperties
}

export function PhoneInput({
  value,
  onChange,
  label = "Phone number",
  error,
  disabled,
  required,
  id,
  placeholder = "6045624263 or +16045624263",
  className,
  style,
}: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    setDisplayValue(value)
  }, [value])

  const handleChange = (text: string) => {
    setDisplayValue(text)
    const formatted = formatPhoneNumber(text)
    setValidationError(formatted ? validatePhoneNumber(formatted) : null)
    onChange(formatted)
  }

  const displayError = error || validationError

  return (
    <label className={className ?? "admin-label"} style={style}>
      {label}
      <input
        id={id}
        className="admin-input"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={displayError ? true : undefined}
      />
      {displayError ? (
        <span className="admin-error" role="alert" style={{ display: "block", marginTop: "0.35rem", fontSize: "0.8125rem" }}>
          {displayError}
        </span>
      ) : null}
    </label>
  )
}
