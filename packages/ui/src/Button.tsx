import type { ButtonHTMLAttributes, ReactNode } from "react"

export type ButtonVariant = "primary" | "secondary" | "ghost"

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  children: ReactNode
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "bianca-btn--primary",
  secondary: "bianca-btn--secondary",
  ghost: "bianca-btn--ghost",
}

export function Button({ variant = "primary", className, children, type = "button", ...rest }: ButtonProps) {
  const classes = ["bianca-btn", "bianca-focus-ring", variantClass[variant], className].filter(Boolean).join(" ")
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
