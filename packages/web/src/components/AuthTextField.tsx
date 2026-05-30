import { TextField, type TextFieldProps } from "@bianca-app/ui"

/** Auth form text field — matches legacy va-login-label / va-login-input styling. */
export function AuthTextField(props: TextFieldProps) {
  return (
    <TextField
      {...props}
      className={["va-login-label", props.className].filter(Boolean).join(" ")}
      inputClassName={["va-login-input", props.inputClassName].filter(Boolean).join(" ")}
    />
  )
}
