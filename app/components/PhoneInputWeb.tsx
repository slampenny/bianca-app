import React, { useState, forwardRef, useRef, useEffect } from 'react'
import { View, StyleSheet, TextInput, Platform } from 'react-native'
import { colors, spacing, typography } from 'app/theme'
import { translate } from 'app/i18n'
import { Text } from './Text'

interface PhoneInputProps {
  value?: string
  onChangeText?: (text: string) => void
  placeholder?: string
  placeholderTx?: string
  placeholderTxOptions?: any
  label?: string
  labelTx?: string
  labelTxOptions?: any
  error?: string
  disabled?: boolean
  editable?: boolean
  testID?: string
  accessibilityLabel?: string
  status?: 'error' | 'disabled' | undefined
  helper?: string
  style?: any
  containerStyle?: any
  inputWrapperStyle?: any
}

// Simple phone number validation and formatting
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const phoneNumber = value.replace(/\D/g, '')
  
  // Return raw 10-digit format for backend compatibility
  if (phoneNumber.length === 10) {
    return phoneNumber
  } else if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
    // Remove leading 1 and return 10-digit format
    return phoneNumber.slice(1)
  }
  
  return value
}

const validatePhoneNumber = (value: string): string | null => {
  if (!value) return null
  
  const phoneNumber = value.replace(/\D/g, '')
  
  // Accept 10-digit numbers
  if (phoneNumber.length === 10) {
    return null // Valid
  }
  
  return 'Phone number must be 10 digits'
}

export const PhoneInputWeb = forwardRef<TextInput, PhoneInputProps>(
  ({ value, onChangeText, placeholder, placeholderTx, placeholderTxOptions, label, labelTx, labelTxOptions, error, disabled, editable, testID, accessibilityLabel, status, helper, style, containerStyle, inputWrapperStyle }, ref) => {
    const [isFocused, setIsFocused] = useState(false)
    const [internalValue, setInternalValue] = useState(value || '')
    const [validationError, setValidationError] = useState<string | null>(null)
    
    const inputRef = useRef<TextInput>(null)
    
    // Sync internalValue with value prop when it changes
    useEffect(() => {
      setInternalValue(value || '')
    }, [value])
    
    const handleChangeText = (text: string) => {
      setInternalValue(text)
      
      // Format the phone number
      const formatted = formatPhoneNumber(text)
      
      // Validate
      const validation = validatePhoneNumber(formatted)
      setValidationError(validation)
      
      // Call parent onChangeText with formatted value
      if (onChangeText) {
        onChangeText(formatted)
      }
    }
    
    const displayError = error || validationError || (status === 'error' ? helper : null)
    const placeholderContent = placeholderTx
      ? translate(placeholderTx, placeholderTxOptions)
      : placeholder
    
    const isEditable = editable !== false && !disabled
    
    return (
      <View style={[styles.container, containerStyle]}>
        {!!(label || labelTx) && (
          <Text
            preset="formLabel"
            text={label || (labelTx ? translate(labelTx, labelTxOptions) : undefined)}
            style={styles.label}
          />
        )}
        
        <View style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          displayError && styles.inputWrapperError,
          (disabled || !isEditable) && styles.inputWrapperDisabled,
          inputWrapperStyle
        ]}>
          <TextInput
            ref={ref || inputRef}
            value={internalValue}
            onChangeText={handleChangeText}
            placeholder={placeholderContent || 'Enter phone number (e.g., 5551234567)'}
            style={[styles.input, style]}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            editable={isEditable}
            keyboardType="phone-pad"
            autoComplete="tel"
            testID={testID}
            accessibilityLabel={accessibilityLabel}
          />
        </View>
        
        {displayError && (
          <Text style={styles.errorText}>
            {displayError}
          </Text>
        )}
      </View>
    )
  }
)

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  label: {
    marginBottom: spacing.xs,
    fontSize: 16,
    fontWeight: "500",
    color: "#2c3e50",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  inputWrapperFocused: {
    borderColor: colors.palette.primary500,
    borderWidth: 2,
  },
  inputWrapperError: {
    borderColor: colors.error,
  },
  inputWrapperDisabled: {
    backgroundColor: colors.palette.neutral200,
    opacity: 0.6,
  },
  input: {
    flex: 1,
    fontFamily: typography.primary.normal,
    color: "#2c3e50",
    fontSize: 16,
    lineHeight: 20,
    height: undefined,
    marginVertical: 0,
    marginHorizontal: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    ...(Platform.OS === "web" && {
      outlineStyle: "none",
      outlineWidth: 0,
      outlineColor: "transparent",
      boxShadow: "none",
    }),
  },
  errorText: {
    marginTop: spacing.xs,
    fontSize: 14,
    color: colors.error,
  },
})
