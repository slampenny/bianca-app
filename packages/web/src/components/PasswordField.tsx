import { PasswordField as UiPasswordField, type PasswordFieldProps as UiPasswordFieldProps } from "@bianca-app/ui"
import { useTranslation } from "react-i18next"

export type PasswordFieldProps = Omit<UiPasswordFieldProps, "showPasswordLabel" | "hidePasswordLabel">

export function PasswordField({ inputClassName, className, ...props }: PasswordFieldProps) {
  const { t } = useTranslation()
  return (
    <UiPasswordField
      {...props}
      className={["va-login-label", className].filter(Boolean).join(" ")}
      inputClassName={["va-login-input", inputClassName].filter(Boolean).join(" ")}
      showPasswordLabel={t("common.showPassword", { defaultValue: "Show password" })}
      hidePasswordLabel={t("common.hidePassword", { defaultValue: "Hide password" })}
    />
  )
}
