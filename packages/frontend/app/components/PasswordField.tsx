import React, { useState, forwardRef } from "react"
import { View, ViewStyle, StyleProp, TouchableOpacity, TextInput } from "react-native"
import { TextField, TextFieldProps, TextFieldAccessoryProps } from "./TextField"
import { Icon } from "./Icon"
import { Text } from "./Text"
import { useTheme } from "../theme/ThemeContext"
import { spacing } from "../theme"

export interface PasswordFieldProps extends Omit<TextFieldProps, "secureTextEntry" | "RightAccessory"> {
  /**
   * Whether to show password validation rules below the field
   * @default true
   */
  showRules?: boolean
  /**
   * Custom password validation function. If provided, rules will be checked against this.
   * Should return true if password is valid.
   */
  validatePassword?: (password: string) => boolean
  /**
   * Password value for validation
   */
  passwordValue?: string
  /**
   * For confirm password fields: the original password to compare against
   */
  comparePassword?: string
  /**
   * Whether this is a confirm password field (will show mismatch error)
   */
  isConfirmField?: boolean
}

/**
 * Password field component with eye icon toggle and optional password rules display
 */
export const PasswordField = forwardRef<TextInput, PasswordFieldProps>((props, ref) => {
  const {
    showRules = true,
    validatePassword,
    passwordValue,
    comparePassword,
    isConfirmField = false,
    value,
    onChangeText,
    ...textFieldProps
  } = props

  const { colors } = useTheme()
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  // Default password validation: uppercase, lowercase, number, special char, min 8
  const defaultValidatePassword = (pwd: string) =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(pwd)

  const passwordValidator = validatePassword || defaultValidatePassword
  const currentPassword = passwordValue || value || ""
  const isUsingDefaultValidation = !validatePassword

  // Check password rules (only show full rules if using default validation)
  const hasMinLength = currentPassword.length >= 8
  const hasLowercase = /[a-z]/.test(currentPassword)
  const hasUppercase = /[A-Z]/.test(currentPassword)
  const hasNumber = /\d/.test(currentPassword)
  const hasSpecialChar = /[^A-Za-z\d]/.test(currentPassword)
  const isValidPassword = passwordValidator(currentPassword)

  // For confirm password field, check if passwords match
  const passwordsMatch = isConfirmField && comparePassword
    ? currentPassword === comparePassword
    : true

  // Determine if confirm password field should show error (red border)
  const showConfirmError = isConfirmField && comparePassword && currentPassword.length > 0 && !passwordsMatch

  // Password rules to display - only show full rules if using default validation
  // Otherwise, show a simple "meets requirements" indicator
  const passwordRules = isUsingDefaultValidation
    ? [
        { rule: "At least 8 characters", met: hasMinLength },
        { rule: "One lowercase letter", met: hasLowercase },
        { rule: "One uppercase letter", met: hasUppercase },
        { rule: "One number", met: hasNumber },
        { rule: "One special character", met: hasSpecialChar },
      ]
    : [
        { rule: "Meets password requirements", met: isValidPassword },
      ]

  // Eye icon accessory component
  const EyeIconAccessory = (accessoryProps: TextFieldAccessoryProps) => {
    return (
      <TouchableOpacity
        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
        style={$eyeIconContainer}
        accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
        accessibilityRole="button"
      >
        <Icon
          icon={isPasswordVisible ? "hidden" : "view"}
          size={20}
          color={colors.textDim || colors.palette?.neutral600}
        />
      </TouchableOpacity>
    )
  }

  // Handle text change with confirm password validation
  const handleChangeText = (text: string) => {
    if (onChangeText) {
      onChangeText(text)
    }
  }

  // Determine field status
  const fieldStatus = showConfirmError ? "error" : textFieldProps.status

  return (
    <View>
      <TextField
        {...textFieldProps}
        ref={ref}
        value={value}
        onChangeText={handleChangeText}
        secureTextEntry={!isPasswordVisible}
        RightAccessory={EyeIconAccessory}
        status={fieldStatus}
      />

      {/* Password rules display */}
      {showRules && !isConfirmField && currentPassword.length > 0 && (
        <View style={$rulesContainer}>
          {passwordRules.map(({ rule, met }, index) => (
            <Text
              key={index}
              style={[
                $ruleText,
                {
                  color: met
                    ? colors.palette?.biancaPrimary || colors.palette?.primary500 || colors.success || "#10B981"
                    : colors.textDim || colors.palette?.neutral600,
                },
              ]}
            >
              {met ? "✓ " : "○ "}
              {rule}
            </Text>
          ))}
        </View>
      )}

      {/* Confirm password mismatch indicator - only show if no helper/error from parent */}
      {isConfirmField && comparePassword && currentPassword.length > 0 && !passwordsMatch && !textFieldProps.helper && (
        <Text
          style={[
            $confirmErrorText,
            {
              color: colors.error || "#EF4444",
            },
          ]}
        >
          Passwords do not match
        </Text>
      )}
    </View>
  )
})

const $eyeIconContainer: ViewStyle = {
  justifyContent: "center",
  alignItems: "center",
  padding: spacing.xxs,
}

const $rulesContainer: ViewStyle = {
  marginTop: spacing.xs,
  marginBottom: spacing.sm,
}

const $ruleText: ViewStyle = {
  fontSize: 12,
  marginBottom: spacing.xxs,
}

const $confirmErrorText: ViewStyle = {
  fontSize: 12,
  marginTop: spacing.xs,
  marginBottom: spacing.xs,
}

