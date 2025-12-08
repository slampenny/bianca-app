import i18n from "i18n-js"
import React from "react"
import { StyleProp, Text as RNText, TextProps as RNTextProps, TextStyle } from "react-native"
import { isRTL, translate, TxKeyPath } from "../i18n"
import { typography } from "../theme"
import { useTheme } from "../theme/ThemeContext"

type Sizes = keyof typeof $sizeStyles
type Weights = keyof typeof typography.primary
type Presets = keyof typeof $presets

export interface TextProps extends RNTextProps {
  /**
   * Text which is looked up via i18n.
   */
  tx?: TxKeyPath
  /**
   * The text to display if not using `tx` or nested components.
   */
  text?: string
  /**
   * Optional options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  txOptions?: i18n.TranslateOptions
  /**
   * An optional style override useful for padding & margin.
   */
  style?: StyleProp<TextStyle>
  /**
   * One of the different types of text presets.
   */
  preset?: Presets
  /**
   * Text weight modifier.
   */
  weight?: Weights
  /**
   * Text size modifier.
   */
  size?: Sizes
  /**
   * Children components.
   */
  children?: React.ReactNode
}

/**
 * For your text displaying needs.
 * This component is a HOC over the built-in React Native one.
 * @see [Documentation and Examples]{@link https://docs.infinite.red/ignite-cli/boilerplate/components/Text/}
 * @param {TextProps} props - The props for the `Text` component.
 * @returns {JSX.Element} The rendered `Text` component.
 */
export function Text(props: TextProps) {
  const { weight, size, tx, txOptions, text, children, style: $styleOverride, ...rest } = props

  const { colors, fontScale } = useTheme()
  const i18nText = tx && translate(tx, txOptions)
  const content = i18nText || text || children

  const preset: Presets = props.preset ?? "default"
  const $styles: StyleProp<TextStyle> = [
    $rtlStyle,
    getPresetStyle(preset, colors, fontScale),
    weight && $fontWeightStyles[weight],
    size && getSizeStyle(size, fontScale),
    $styleOverride,
  ]

  return (
    <RNText {...rest} style={$styles}>
      {content}
    </RNText>
  )
}

const getPresetStyle = (preset: Presets, colors: any, fontScale: number): StyleProp<TextStyle> => {
  // Use text color that's properly theme-aware
  // In dark mode: colors.text = neutral800 (#CCCCCC - light gray)
  // In light mode: colors.text = neutral800 (#1E293B - dark gray)
  const textColor = colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800
  
  const baseStyle: StyleProp<TextStyle> = [
    getSizeStyle("sm", fontScale),
    $fontWeightStyles.normal,
    { color: textColor },
  ]

  const presets = {
    default: baseStyle,
    bold: [baseStyle, $fontWeightStyles.bold] as StyleProp<TextStyle>,
    heading: [baseStyle, getSizeStyle("xxl", fontScale), $fontWeightStyles.bold] as StyleProp<TextStyle>,
    subheading: [baseStyle, getSizeStyle("lg", fontScale), $fontWeightStyles.medium] as StyleProp<TextStyle>,
    formLabel: [baseStyle, $fontWeightStyles.medium] as StyleProp<TextStyle>,
    formHelper: [baseStyle, getSizeStyle("sm", fontScale), $fontWeightStyles.normal] as StyleProp<TextStyle>,
  }

  return presets[preset]
}

const getSizeStyle = (size: Sizes, fontScale: number): TextStyle => {
  const baseStyle = $sizeStyles[size]
  return {
    fontSize: baseStyle.fontSize * fontScale,
    lineHeight: baseStyle.lineHeight * fontScale,
  }
}

const $sizeStyles = {
  xxl: { fontSize: 36, lineHeight: 44 } satisfies TextStyle,
  xl: { fontSize: 24, lineHeight: 34 } satisfies TextStyle,
  lg: { fontSize: 20, lineHeight: 32 } satisfies TextStyle,
  md: { fontSize: 18, lineHeight: 26 } satisfies TextStyle,
  sm: { fontSize: 16, lineHeight: 24 } satisfies TextStyle,
  xs: { fontSize: 14, lineHeight: 21 } satisfies TextStyle,
  xxs: { fontSize: 12, lineHeight: 18 } satisfies TextStyle,
}

const $fontWeightStyles = Object.entries(typography.primary).reduce((acc, [weight, fontFamily]) => {
  return { ...acc, [weight]: { fontFamily } }
}, {}) as Record<Weights, TextStyle>

const $rtlStyle: TextStyle = isRTL ? { writingDirection: "rtl" } : {}
