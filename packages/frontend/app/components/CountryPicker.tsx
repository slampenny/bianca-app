import React, { useEffect, useMemo } from "react"
import { StyleSheet, View, ViewStyle, Platform } from "react-native"
import { Picker } from "@react-native-picker/picker"
import { useTheme } from "../theme/ThemeContext"
import { Text, TextProps } from "./Text"
import { translate, getLocale } from "../i18n"
import { spacing } from "../theme"

// Common countries list (ISO 3166-1 alpha-2 codes)
// Note: Labels are fallbacks - actual labels are localized using Intl.DisplayNames
export const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'IT', label: 'Italy' },
  { value: 'ES', label: 'Spain' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'SE', label: 'Sweden' },
  { value: 'CH', label: 'Switzerland' },
  { value: 'JP', label: 'Japan' },
  { value: 'CN', label: 'China' },
  { value: 'HK', label: 'Hong Kong' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'IN', label: 'India' },
  { value: 'MX', label: 'Mexico' },
  { value: 'BR', label: 'Brazil' },
  { value: 'OTHER', label: 'Other' },
]

/**
 * Get localized country name using Intl.DisplayNames API
 * Falls back to English label if Intl is not available
 */
function getLocalizedCountryName(countryCode: string, locale: string, fallbackLabel: string): string {
  // Handle special case for "OTHER"
  if (countryCode === 'OTHER') {
    // Try to translate "Other" - fallback to English if translation key doesn't exist
    try {
      const translated = translate("common.other")
      if (translated && translated !== "common.other") {
        return translated
      }
    } catch {
      // Translation key doesn't exist, use fallback
    }
    return fallbackLabel
  }

  // Use Intl.DisplayNames for native localization (browser/React Native)
  // This automatically provides country names in the user's language
  if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
    try {
      const displayNames = new Intl.DisplayNames([locale], { type: 'region' })
      const localizedName = displayNames.of(countryCode)
      if (localizedName && localizedName !== countryCode) {
        return localizedName
      }
    } catch (error) {
      // Fallback to English label if Intl fails
    }
  }
  
  return fallbackLabel
}

export interface CountryPickerProps {
  value: string
  onValueChange: (value: string) => void
  label?: TextProps["text"]
  labelTx?: TextProps["tx"]
  labelTxOptions?: TextProps["txOptions"]
  helper?: TextProps["text"]
  helperTx?: TextProps["tx"]
  helperTxOptions?: TextProps["txOptions"]
  enabled?: boolean
  containerStyle?: ViewStyle
  testID?: string
  accessibilityLabel?: string
}

export function CountryPicker({
  value,
  onValueChange,
  label,
  labelTx,
  labelTxOptions,
  helper,
  helperTx,
  helperTxOptions,
  enabled = true,
  containerStyle,
  testID,
  accessibilityLabel,
}: CountryPickerProps) {
  const { colors, currentTheme } = useTheme()
  const currentLocale = getLocale()

  // Get localized country names based on current locale
  const localizedCountries = useMemo(() => {
    return COUNTRIES.map((country) => ({
      ...country,
      label: getLocalizedCountryName(country.value, currentLocale, country.label),
    }))
  }, [currentLocale])

  // Get selected country label for accessibility
  const selectedCountryLabel = useMemo(() => {
    const selected = localizedCountries.find((c) => c.value === value)
    return selected?.label || value
  }, [value, localizedCountries])

  // Generate accessibility label
  const getAccessibilityLabel = () => {
    if (accessibilityLabel) return accessibilityLabel
    const labelText = labelTx ? translate(labelTx, labelTxOptions) : label
    if (labelText) {
      return `${labelText}, ${selectedCountryLabel}`
    }
    return `Country, ${selectedCountryLabel}`
  }

  // Generate accessibility hint
  const getAccessibilityHint = () => {
    if (helper || helperTx) {
      return helperTx ? translate(helperTx, helperTxOptions) : helper
    }
    return "Select a country from the dropdown"
  }

  // Inject CSS for web Picker dropdown theming with WCAG-compliant focus indicators
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const isDarkMode = currentTheme === "dark"
      
      const dropdownBg = isDarkMode 
        ? (colors.palette?.neutral500 || "#525252") 
        : (colors.palette?.neutral100 || "#FFFFFF")
      const dropdownText = isDarkMode
        ? (colors.text || colors.palette?.neutral900 || "#FAFAFA")
        : (colors.text || colors.palette?.neutral800 || "#000000")
      const hoverBg = isDarkMode
        ? (colors.palette?.neutral400 || "#404040")
        : (colors.palette?.neutral200 || "#FAFAFA")
      const focusColor = colors.palette?.primary500 || colors.tint || "#3B82F6"
      const borderColor = colors.palette?.neutral300 || colors.palette?.biancaBorder || colors.border || "#E2E8F0"

      const styleId = 'picker-dropdown-theme-country'
      let styleElement = document.getElementById(styleId)
      
      if (!styleElement) {
        styleElement = document.createElement('style')
        styleElement.id = styleId
        document.head.appendChild(styleElement)
      }

      // WCAG-compliant styling with proper focus indicators and contrast
      styleElement.textContent = `
        select {
          background-color: ${dropdownBg} !important;
          color: ${dropdownText} !important;
          border: 1px solid ${borderColor} !important;
          border-radius: 5px !important;
          padding: 12px !important;
          min-height: 48px !important;
          font-size: 16px !important;
          outline: none !important;
        }
        select:focus {
          border-color: ${focusColor} !important;
          border-width: 2px !important;
          box-shadow: 0 0 0 3px ${focusColor}33 !important;
        }
        select:disabled {
          opacity: 0.6 !important;
          cursor: not-allowed !important;
        }
        select option {
          background-color: ${dropdownBg} !important;
          color: ${dropdownText} !important;
          padding: 8px 12px !important;
        }
        select option:hover,
        select option:focus {
          background-color: ${hoverBg} !important;
          color: ${dropdownText} !important;
        }
        select option:checked {
          background-color: ${hoverBg} !important;
          color: ${dropdownText} !important;
        }
      `

      return () => {
        // Cleanup on unmount
        const element = document.getElementById(styleId)
        if (element) {
          element.remove()
        }
      }
    }
  }, [colors, currentTheme])

  const styles = createStyles(colors)

  const textColor = colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000"

  return (
    <View style={[styles.container, containerStyle]}>
      {!!(label || labelTx) && (
        <Text
          preset="formLabel"
          text={label}
          tx={labelTx}
          txOptions={labelTxOptions}
          style={styles.label}
        />
      )}

      <View 
        style={styles.pickerWrapper}
        accessibilityRole="none"
        accessibilityElementsHidden={true}
      >
        <Picker
          selectedValue={value}
          onValueChange={onValueChange}
          enabled={enabled}
          style={styles.picker}
          itemStyle={styles.pickerItem}
          dropdownIconColor={textColor}
          testID={testID}
          accessibilityLabel={getAccessibilityLabel()}
          accessibilityHint={getAccessibilityHint()}
          accessibilityRole="combobox"
          accessibilityState={{ 
            disabled: !enabled,
            selected: true,
          }}
          {...(Platform.OS === 'web' && {
            // ARIA attributes for web WCAG compliance
            'aria-label': getAccessibilityLabel(),
            'aria-describedby': helper || helperTx ? `${testID || 'country'}-helper` : undefined,
            'aria-disabled': !enabled,
            'aria-required': false,
            'aria-invalid': false,
          } as any)}
        >
          {localizedCountries.map((c) => (
            <Picker.Item
              key={c.value}
              label={c.label}
              value={c.value}
              color={textColor}
            />
          ))}
        </Picker>
      </View>

      {!!(helper || helperTx) && (
        <Text
          preset="formHelper"
          text={helper}
          tx={helperTx}
          txOptions={helperTxOptions}
          style={styles.helper}
          nativeID={Platform.OS === 'web' ? `${testID || 'country'}-helper` : undefined}
        />
      )}
    </View>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
    color: colors.palette?.biancaHeader || colors.text,
  },
  pickerWrapper: {
    backgroundColor: colors.palette?.neutral100 || colors.background || "#FFFFFF",
    borderColor: colors.palette?.neutral300 || colors.palette?.biancaBorder || colors.border || "#E2E8F0",
    borderRadius: 5,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  picker: {
    height: 50,
    width: "100%",
    backgroundColor: "transparent",
    color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
  },
  pickerItem: {
    color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 || "#000000",
  },
  helper: {
    marginTop: spacing.xs,
    color: colors.textDim,
  },
})





