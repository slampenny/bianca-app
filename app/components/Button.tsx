import React, { ComponentType } from "react"
import {
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  TextStyle,
  ViewStyle,
  ActivityIndicator,
} from "react-native"
import { spacing, typography } from "../theme"
import { useTheme } from "../theme/ThemeContext"
import { Text, TextProps } from "./Text"

/**
 * Button Preset Guide - Consistent Button Color System
 * 
 * Use presets to maintain consistent button styling across the app:
 * 
 * - **primary**: Main actions (Save, Invite, Submit, Call, Create) - Blue/Indigo
 * - **default**: Secondary actions (View, Navigate, Browse, Cancel) - Outlined/Gray
 * - **success**: Success/Assign actions (Assign, Confirm positive actions) - Green/Emerald
 * - **danger**: Destructive actions (Delete, Remove, Logout, Confirm delete) - Red/Rose
 * - **warning**: Warning actions (Caution, Alert) - Amber/Yellow
 * - **filled**: Avoid - Use "default" instead for neutral secondary actions
 * - **reversed**: Dark themed buttons (rarely needed)
 * - **medical**: Healthcare-specific actions (rarely needed)
 */
type PresetNames = "default" | "filled" | "reversed" | "primary" | "success" | "danger" | "warning" | "medical"
type Presets = PresetNames

export interface ButtonAccessoryProps {
  style: StyleProp<any>
  pressableState: PressableStateCallbackType
  disabled?: boolean
}

export interface ButtonProps extends PressableProps {
  /**
   * Text which is looked up via i18n.
   */
  tx?: TextProps["tx"]
  /**
   * The text to display if not using `tx` or nested components.
   */
  text?: TextProps["text"]
  /**
   * Optional options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  txOptions?: TextProps["txOptions"]
  /**
   * An optional style override useful for padding & margin.
   */
  style?: StyleProp<ViewStyle>
  /**
   * An optional style override for the "pressed" state.
   */
  pressedStyle?: StyleProp<ViewStyle>
  /**
   * An optional style override for the button text.
   */
  textStyle?: StyleProp<TextStyle>
  /**
   * An optional style override for the button text when in the "pressed" state.
   */
  pressedTextStyle?: StyleProp<TextStyle>
  /**
   * An optional style override for the button text when in the "disabled" state.
   */
  disabledTextStyle?: StyleProp<TextStyle>
  /**
   * One of the different types of button presets.
   */
  preset?: Presets
  /**
   * An optional component to render on the right side of the text.
   * Example: `RightAccessory={(props) => <View {...props} />}`
   */
  RightAccessory?: ComponentType<ButtonAccessoryProps>
  /**
   * An optional component to render on the left side of the text.
   * Example: `LeftAccessory={(props) => <View {...props} />}`
   */
  LeftAccessory?: ComponentType<ButtonAccessoryProps>
  /**
   * Children components.
   */
  children?: React.ReactNode
  /**
   * disabled prop, accessed directly for declarative styling reasons.
   * https://reactnative.dev/docs/pressable#disabled
   */
  disabled?: boolean
  /**
   * An optional style override for the disabled state
   */
  disabledStyle?: StyleProp<ViewStyle>
  /**
   * Show loading spinner and disable button when true
   */
  loading?: boolean

  testID?: string
}

/**
 * A component that allows users to take actions and make choices.
 * Wraps the Text component with a Pressable component.
 * @see [Documentation and Examples]{@link https://docs.infinite.red/ignite-cli/boilerplate/components/Button/}
 * @param {ButtonProps} props - The props for the `Button` component.
 * @returns {JSX.Element} The rendered `Button` component.
 * @example
 * <Button
 *   tx="common.ok"
 *   style={styles.button}
 *   textStyle={styles.buttonText}
 *   onPress={handleButtonPress}
 * />
 */
export function Button(props: ButtonProps) {
  const { colors } = useTheme()
  
  const {
    tx,
    text,
    txOptions,
    style: $viewStyleOverride,
    pressedStyle: $pressedViewStyleOverride,
    textStyle: $textStyleOverride,
    pressedTextStyle: $pressedTextStyleOverride,
    disabledTextStyle: $disabledTextStyleOverride,
    children,
    RightAccessory,
    LeftAccessory,
    disabled,
    loading = false,
    disabledStyle: $disabledViewStyleOverride,
    testID,
    ...rest
  } = props

  const preset: Presets = props.preset ?? "default"
  
  // Button is disabled if explicitly disabled OR loading
  const isDisabled = disabled || loading
  
  // Create presets dynamically based on current theme colors
  const $viewPresets = getViewPresets(colors)
  const $textPresets = getTextPresets(colors)
  const $pressedViewPresets = getPressedViewPresets(colors)
  const $pressedTextPresets = getPressedTextPresets(colors)
  
  /**
   * @param {PressableStateCallbackType} root0 - The root object containing the pressed state.
   * @param {boolean} root0.pressed - The pressed state.
   * @returns {StyleProp<ViewStyle>} The view style based on the pressed state.
   */
  function $viewStyle({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> {
    return [
      $viewPresets[preset],
      $viewStyleOverride,
      !!pressed && [$pressedViewPresets[preset], $pressedViewStyleOverride],
      !!isDisabled && $disabledViewStyleOverride,
    ]
  }
  /**
   * @param {PressableStateCallbackType} root0 - The root object containing the pressed state.
   * @param {boolean} root0.pressed - The pressed state.
   * @returns {StyleProp<TextStyle>} The text style based on the pressed state.
   */
  function $textStyle({ pressed }: PressableStateCallbackType): StyleProp<TextStyle> {
    return [
      $textPresets[preset],
      $textStyleOverride,
      !!pressed && [$pressedTextPresets[preset], $pressedTextStyleOverride],
      !!isDisabled && $disabledTextStyleOverride,
    ]
  }
  
  // Determine spinner color based on preset
  const getSpinnerColor = () => {
    if (preset === 'primary' || preset === 'success' || preset === 'danger' || preset === 'warning') {
      return colors.palette.neutral100 // White spinner on colored buttons
    }
    return colors.palette.biancaHeader // Dark spinner on default buttons
  }

  return (
    <Pressable
      style={$viewStyle}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      {...rest}
      disabled={isDisabled}
      testID={testID}
    >
      {(state) => (
        <>
          {!!LeftAccessory && !loading && (
            <LeftAccessory style={$leftAccessoryStyle} pressableState={state} disabled={isDisabled} />
          )}
          
          {loading && (
            <ActivityIndicator 
              size="small" 
              color={getSpinnerColor()} 
              style={{ marginRight: 8 }}
              testID={`${testID}-spinner`}
            />
          )}

          <Text tx={tx} text={text} txOptions={txOptions} style={$textStyle(state)}>
            {children}
          </Text>

          {!!RightAccessory && !loading && (
            <RightAccessory
              style={$rightAccessoryStyle}
              pressableState={state}
              disabled={isDisabled}
            />
          )}
        </>
      )}
    </Pressable>
  )
}

const $baseViewStyle: ViewStyle = {
  minHeight: 56,
  borderRadius: 4,
  justifyContent: "center",
  alignItems: "center",
  flexDirection: "row",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.sm,
  overflow: "hidden",
}

const $baseTextStyle: TextStyle = {
  fontSize: 16,
  lineHeight: 20,
  fontFamily: typography.primary.medium,
  textAlign: "center",
  flexShrink: 1,
  flexGrow: 0,
  zIndex: 2,
}

const $rightAccessoryStyle: ViewStyle = { marginStart: spacing.xs, zIndex: 1 }
const $leftAccessoryStyle: ViewStyle = { marginEnd: spacing.xs, zIndex: 1 }

function getViewPresets(colors: any): Record<PresetNames, StyleProp<ViewStyle>> {
  return {
    default: [
      $baseViewStyle,
      {
        borderWidth: 1,
        borderColor: colors.palette.neutral400,
        backgroundColor: colors.palette.neutral100,
      },
    ] as StyleProp<ViewStyle>,

    // CRITICAL: filled preset uses a neutral background that's theme-aware
    // In dark mode: neutral300 = dark gray (#262626)
    // In light mode: neutral300 = light gray (#F0F0F0)
    filled: [$baseViewStyle, { backgroundColor: colors.palette?.neutral300 || colors.palette?.neutral200 }] as StyleProp<ViewStyle>,

    reversed: [
      $baseViewStyle,
      { backgroundColor: colors.palette.neutral800 },
    ] as StyleProp<ViewStyle>,

    primary: [
      $baseViewStyle,
      { 
        backgroundColor: colors.palette.primary500,
        borderWidth: 0,
      },
    ] as StyleProp<ViewStyle>,

    success: [
      $baseViewStyle,
      { 
        backgroundColor: colors.palette.success500,
        borderWidth: 0,
      },
    ] as StyleProp<ViewStyle>,

    danger: [
      $baseViewStyle,
      { 
        backgroundColor: colors.palette.error500,
        borderWidth: 0,
      },
    ] as StyleProp<ViewStyle>,

    warning: [
      $baseViewStyle,
      { 
        backgroundColor: colors.palette.warning500,
        borderWidth: 0,
      },
    ] as StyleProp<ViewStyle>,

    medical: [
      $baseViewStyle,
      { 
        backgroundColor: colors.palette.medical500,
        borderWidth: 0,
      },
    ] as StyleProp<ViewStyle>,
  }
}

function getTextPresets(colors: any): Record<PresetNames, StyleProp<TextStyle>> {
  return {
    // Default preset uses border, so text should be theme-aware
    default: [$baseTextStyle, { color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 }],
    // CRITICAL: filled preset uses neutral300 background
    // In dark mode: neutral300 = #262626 (dark gray), so use light text
    // In light mode: neutral300 = #F0F0F0 (light gray), so use dark text
    // Use theme's text color which automatically adjusts for light/dark mode
    filled: [$baseTextStyle, { 
      color: colors.text || colors.palette?.biancaHeader || colors.palette?.neutral800 
    }],
    // Reversed uses dark background (neutral800), so always use light text
    reversed: [$baseTextStyle, { color: colors.palette?.neutral100 || "#FFFFFF" }],
    // Colored presets always use white/light text for contrast
    primary: [$baseTextStyle, { color: colors.palette?.neutral900 || "#FFFFFF" }],
    success: [$baseTextStyle, { color: colors.palette?.neutral900 || "#FFFFFF" }],
    danger: [$baseTextStyle, { color: colors.palette?.neutral900 || "#FFFFFF" }],
    warning: [$baseTextStyle, { color: colors.palette?.neutral900 || "#FFFFFF" }],
    medical: [$baseTextStyle, { color: colors.palette?.neutral900 || "#FFFFFF" }],
  }
}

function getPressedViewPresets(colors: any): Record<PresetNames, StyleProp<ViewStyle>> {
  return {
    default: { backgroundColor: colors.palette.neutral200 },
    filled: { backgroundColor: colors.palette.neutral400 },
    reversed: { backgroundColor: colors.palette.neutral700 },
    primary: { opacity: 0.8 },
    success: { opacity: 0.8 },
    danger: { opacity: 0.8 },
    warning: { opacity: 0.8 },
    medical: { opacity: 0.8 },
  }
}

function getPressedTextPresets(colors: any): Record<PresetNames, StyleProp<TextStyle>> {
  return {
    default: { opacity: 0.9 },
    filled: { opacity: 0.9 },
    reversed: { opacity: 0.9 },
    primary: { opacity: 0.9 },
    success: { opacity: 0.9 },
    danger: { opacity: 0.9 },
    warning: { opacity: 0.9 },
    medical: { opacity: 0.9 },
  }
}
