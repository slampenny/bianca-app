import React, { useState, forwardRef, useRef, useEffect } from 'react'
import { View, StyleSheet, TextInput, Platform } from 'react-native'
import { formatPhoneNumber, validatePhoneNumber } from '@bianca-app/shared'
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
  onFocus?: () => void
}

export const PhoneInputWeb = forwardRef<TextInput, PhoneInputProps>(
  ({ value, onChangeText, placeholder, placeholderTx, placeholderTxOptions, label, labelTx, labelTxOptions, error, disabled, editable, testID, accessibilityLabel, status, helper, style, containerStyle, inputWrapperStyle, onFocus }, ref) => {
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
      ? translate(placeholderTx as import("../i18n").TxKeyPath, placeholderTxOptions)
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
      isFocused && { borderColor: (themeColors.palette as { primary500?: string })?.primary500 || themeColors.tint || (colors as { primary500?: string }).primary500, borderWidth: 2 },
      displayError && { borderColor: themeColors.error || colors.error },
      (disabled || !isEditable) && { backgroundColor: themeColors.palette?.neutral200 || (themeColors as { backgroundDim?: string }).backgroundDim || "#F5F5F5", opacity: 0.6 },
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
            text={label || (labelTx ? translate(labelTx as import("../i18n").TxKeyPath, labelTxOptions) : undefined)}
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
            onFocus={() => { setIsFocused(true); onFocus?.() }}
            onBlur={() => setIsFocused(false)}
            editable={isEditable}
            keyboardType="phone-pad"
            autoComplete="tel"
            testID={testID}
            {...testingProps(testID)}
            accessibilityLabel={accessibilityLabel || label || (labelTx ? translate(labelTx as import("../i18n").TxKeyPath, labelTxOptions) : undefined) || "Phone number"}
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
