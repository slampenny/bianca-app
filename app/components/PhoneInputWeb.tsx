import React, { useState, forwardRef, useRef, useEffect } from 'react'
import { View, StyleSheet, TextInput, Platform } from 'react-native'
import { colors, spacing, typography } from 'app/theme'
import { useTheme } from 'app/theme/ThemeContext'
import { translate } from 'app/i18n'
import { Text } from './Text'
import { testingProps } from '../utils/testingProps'

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

// Format phone number to E.164 format (+1XXXXXXXXXX)
const formatPhoneNumber = (value: string): string => {
  if (!value) return ''
  
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '')
  
  // If already in E.164 format (starts with +), return as-is
  if (value.startsWith('+')) {
    return value
  }
  
  // Convert 10-digit US number to E.164 format
  if (digits.length === 10) {
    return `+1${digits}`
  }
  
  // Convert 11-digit number starting with 1 to E.164 format
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  
  // If it's already longer (international), add + if missing
  if (digits.length > 11) {
    return value.startsWith('+') ? value : `+${digits}`
  }
  
  // Return as-is if we can't format (let backend handle validation)
  return value
}

const validatePhoneNumber = (value: string): string | null => {
  if (!value) return null
  
  // Remove all non-digit characters for validation
  const digits = value.replace(/\D/g, '')
  
  // Accept E.164 format (+1XXXXXXXXXX) or 10-digit US numbers
  if (value.startsWith('+')) {
    // E.164 format: + followed by country code and number (10-15 digits total)
    const e164Regex = /^\+[1-9]\d{9,14}$/
    if (e164Regex.test(value)) {
      return null // Valid
    }
    return 'Phone number must be in E.164 format (e.g., +1234567890)'
  }
  
  // Accept 10-digit US numbers (will be converted to E.164)
  if (digits.length === 10) {
    return null // Valid
  }
  
  // Accept 11-digit numbers starting with 1 (will be converted to E.164)
  if (digits.length === 11 && digits.startsWith('1')) {
    return null // Valid
  }
  
  return 'Phone number must be 10 digits or in E.164 format (e.g., +1234567890)'
}

export const PhoneInputWeb = forwardRef<TextInput, PhoneInputProps>(
  ({ value, onChangeText, placeholder, placeholderTx, placeholderTxOptions, label, labelTx, labelTxOptions, error, disabled, editable, testID, accessibilityLabel, status, helper, style, containerStyle, inputWrapperStyle }, ref) => {
    const { colors: themeColors } = useTheme()
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
    
    // IMPORTANT: Only "disabled" status disables the input, NOT "error" status
    // Error status is purely visual (red border) and should never make inputs uneditable
    // Check all conditions that would make the input uneditable
    const isEditable = editable !== false && !disabled && status !== 'disabled'
    
    const inputWrapperStyles = [
      {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        marginBottom: spacing.md,
        // CRITICAL: Use theme-aware background with proper fallbacks
        // In dark mode: neutral100 = #000000 (black)
        // In light mode: neutral100 = #FFFFFF (white)
        backgroundColor: themeColors.palette?.neutral100 || themeColors.background || "#FFFFFF",
        borderWidth: 1,
        // CRITICAL: Border color should have good contrast
        borderColor: themeColors.palette?.neutral300 || themeColors.palette?.biancaBorder || themeColors.border || "#E2E8F0",
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 12,
        shadowColor: themeColors.palette?.neutral900 || "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
      },
      isFocused && { borderColor: themeColors.palette?.primary500 || themeColors.tint || colors.primary500, borderWidth: 2 },
      displayError && { borderColor: themeColors.error || colors.error },
      (disabled || !isEditable) && { backgroundColor: themeColors.palette?.neutral200 || themeColors.backgroundDim || "#F5F5F5", opacity: 0.6 },
      inputWrapperStyle
    ]
    
    const inputStyles = [
      {
        flex: 1,
        fontFamily: typography.primary.normal,
        // CRITICAL: Use theme-aware text color with fallbacks
        // In dark mode: text = neutral800 (#CCCCCC - light gray)
        // In light mode: text = neutral800 (#1E293B - dark gray)
        color: themeColors.text || themeColors.palette?.biancaHeader || themeColors.palette?.neutral800 || "#000000",
        fontSize: 16,
        lineHeight: 20,
        height: undefined,
        marginVertical: 0,
        marginHorizontal: 0,
        paddingVertical: 0,
        paddingHorizontal: 0,
      },
      Platform.OS === "web" && {
        outlineStyle: "none",
        outlineWidth: 0,
        outlineColor: "transparent",
        boxShadow: "none",
      },
      style
    ]
    
    const labelStyles = {
      marginBottom: spacing.xs,
      fontSize: 16,
      fontWeight: "500" as const,
      // CRITICAL: Use theme-aware text color with fallbacks
      color: themeColors.text || themeColors.palette?.biancaHeader || themeColors.palette?.neutral800 || "#000000",
    }
    
    return (
      <View style={[styles.container, containerStyle]}>
        {!!(label || labelTx) && (
          <Text
            preset="formLabel"
            text={label || (labelTx ? translate(labelTx, labelTxOptions) : undefined)}
            style={labelStyles}
          />
        )}
        
        <View style={inputWrapperStyles}>
          <TextInput
            ref={ref || inputRef}
            value={internalValue}
            onChangeText={handleChangeText}
            placeholder={placeholderContent || 'Enter phone number (e.g., 5551234567)'}
            placeholderTextColor={themeColors.textDim || themeColors.palette?.neutral500 || themeColors.palette?.neutral600 || "#666666"}
            style={inputStyles}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            editable={isEditable}
            keyboardType="phone-pad"
            autoComplete="tel"
            testID={testID}
            {...testingProps(testID)}
            accessibilityLabel={accessibilityLabel || label || (labelTx ? translate(labelTx, labelTxOptions) : undefined) || "Phone number"}
            accessibilityState={{ disabled: !isEditable }}
            accessibilityHint={error || validationError || helper}
          />
        </View>
        
        {displayError && (
          <Text style={{ marginTop: spacing.xs, fontSize: 14, color: themeColors.error || colors.error }}>
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
})
