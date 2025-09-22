import React, { useState, forwardRef, useRef } from 'react'
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native'
import { colors, spacing } from 'app/theme'

interface PhoneInputProps {
  value?: string
  onChangeText?: (text: string) => void
  placeholder?: string
  error?: string
  disabled?: boolean
  testID?: string
  style?: any
}

// Simple phone number validation and formatting
const formatPhoneNumber = (value: string): string => {
  // Remove all non-digit characters
  const phoneNumber = value.replace(/\D/g, '')
  
  // Format as +1XXXXXXXXXX for US numbers
  if (phoneNumber.length === 10) {
    return `+1${phoneNumber}`
  } else if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
    return `+${phoneNumber}`
  } else if (phoneNumber.startsWith('+1') && phoneNumber.length === 12) {
    return phoneNumber
  }
  
  return value
}

const validatePhoneNumber = (value: string): string | null => {
  if (!value) return null
  
  const phoneNumber = value.replace(/\D/g, '')
  
  // US phone number validation
  if (value.startsWith('+1')) {
    if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
      return null // Valid
    }
    return 'Invalid US phone number format'
  }
  
  // 10-digit US number
  if (phoneNumber.length === 10) {
    return null // Valid
  }
  
  return 'Phone number must be 10 digits or +1XXXXXXXXXX format'
}

export const PhoneInputWeb = forwardRef<TextInput, PhoneInputProps>(
  ({ value, onChangeText, placeholder, error, disabled, testID, style }, ref) => {
    const [isFocused, setIsFocused] = useState(false)
    const [internalValue, setInternalValue] = useState(value || '')
    const [validationError, setValidationError] = useState<string | null>(null)
    
    const inputRef = useRef<TextInput>(null)
    
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
    
    const displayError = error || validationError
    
    return (
      <View style={[styles.container, style]}>
        <View style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          displayError && styles.inputContainerError,
          disabled && styles.inputContainerDisabled
        ]}>
          <TextInput
            ref={ref || inputRef}
            value={internalValue}
            onChangeText={handleChangeText}
            placeholder={placeholder || 'Enter phone number (e.g., +15551234567)'}
            style={styles.textInput}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            editable={!disabled}
            keyboardType="phone-pad"
            autoComplete="tel"
            testID={testID}
          />
        </View>
        {displayError && (
          <Text style={styles.errorText} testID={`${testID}-error`}>
            {displayError}
          </Text>
        )}
        {!displayError && internalValue && (
          <Text style={styles.helpText} testID={`${testID}-help`}>
            Valid phone number format
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
  inputContainer: {
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.palette.neutral100,
    minHeight: 48,
  },
  inputContainerFocused: {
    borderColor: colors.palette.primary500,
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: colors.palette.angry500,
  },
  inputContainerDisabled: {
    backgroundColor: colors.palette.neutral200,
    opacity: 0.6,
  },
  textInput: {
    fontSize: 18, // md size
    color: colors.palette.neutral900,
    padding: 0,
    margin: 0,
    flex: 1,
  },
  errorText: {
    color: colors.palette.angry500,
    fontSize: 16, // sm size
    marginTop: spacing.xs,
  },
  helpText: {
    color: colors.palette.neutral600,
    fontSize: 16, // sm size
    marginTop: spacing.xs,
  },
})
