import React, { ComponentType, FC, useMemo } from "react"
import {
  GestureResponderEvent,
  Image,
  ImageStyle,
  Platform,
  Pressable,
  PressableProps,
  StyleProp,
  SwitchProps,
  TextInputProps,
  TextStyle,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewProps,
  ViewStyle,
} from "react-native"
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated"
import { colors, spacing } from "../theme"
import { iconRegistry, IconTypes } from "./Icon"
import { Text, TextProps } from "./Text"
import { useTheme } from "../theme/ThemeContext"

type Variants = "checkbox" | "switch" | "radio"

interface BaseToggleProps extends Omit<PressableProps, "style"> {
  /**
   * The variant of the toggle.
   * Options: "checkbox", "switch", "radio"
   * Default: "checkbox"
   */
  variant?: unknown
  /**
   * A style modifier for different input states.
   */
  status?: "error" | "disabled"
  /**
   * If false, input is not editable. The default value is true.
   */
  editable?: TextInputProps["editable"]
  /**
   * The value of the field. If true the component will be turned on.
   */
  value?: boolean
  /**
   * Invoked with the new value when the value changes.
   */
  onValueChange?: SwitchProps["onValueChange"]
  /**
   * Style overrides for the container
   */
  containerStyle?: StyleProp<ViewStyle>
  /**
   * Style overrides for the input wrapper
   */
  inputWrapperStyle?: StyleProp<ViewStyle>
  /**
   * Optional input wrapper style override.
   * This gives the inputs their size, shape, "off" background-color, and outer border.
   */
  inputOuterStyle?: ViewStyle
  /**
   * Optional input style override.
   * This gives the inputs their inner characteristics and "on" background-color.
   */
  inputInnerStyle?: ViewStyle
  /**
   * The position of the label relative to the action component.
   * Default: right
   */
  labelPosition?: "left" | "right"
  /**
   * The label text to display if not using `labelTx`.
   */
  label?: TextProps["text"]
  /**
   * Label text which is looked up via i18n.
   */
  labelTx?: TextProps["tx"]
  /**
   * Optional label options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  labelTxOptions?: TextProps["txOptions"]
  /**
   * Style overrides for label text.
   */
  labelStyle?: StyleProp<TextStyle>
  /**
   * Pass any additional props directly to the label Text component.
   */
  LabelTextProps?: TextProps
  /**
   * The helper text to display if not using `helperTx`.
   */
  helper?: TextProps["text"]
  /**
   * Helper text which is looked up via i18n.
   */
  helperTx?: TextProps["tx"]
  /**
   * Optional helper options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  helperTxOptions?: TextProps["txOptions"]
  /**
   * Pass any additional props directly to the helper Text component.
   */
  HelperTextProps?: TextProps
  /**
   * Optional testID for E2E testing
   */
  testID?: string
}

interface CheckboxToggleProps extends BaseToggleProps {
  variant?: "checkbox"
  /**
   * Optional style prop that affects the Image component.
   */
  inputDetailStyle?: ImageStyle
  /**
   * Checkbox-only prop that changes the icon used for the "on" state.
   */
  checkboxIcon?: IconTypes
}

interface RadioToggleProps extends BaseToggleProps {
  variant?: "radio"
  /**
   * Optional style prop that affects the dot View.
   */
  inputDetailStyle?: ViewStyle
}

interface SwitchToggleProps extends BaseToggleProps {
  variant?: "switch"
  /**
   * Switch-only prop that adds a text/icon label for on/off states.
   */
  switchAccessibilityMode?: "text" | "icon"
  /**
   * Optional style prop that affects the knob View.
   * Note: `width` and `height` rules should be points (numbers), not percentages.
   */
  inputDetailStyle?: Omit<ViewStyle, "width" | "height"> & { width?: number; height?: number }
}

export type ToggleProps = CheckboxToggleProps | RadioToggleProps | SwitchToggleProps

interface ToggleInputProps {
  on: boolean
  status: BaseToggleProps["status"]
  disabled: boolean
  outerStyle: ViewStyle
  innerStyle: ViewStyle
  detailStyle: Omit<ViewStyle & ImageStyle, "overflow">
  switchAccessibilityMode?: SwitchToggleProps["switchAccessibilityMode"]
  checkboxIcon?: CheckboxToggleProps["checkboxIcon"]
  testID?: string
}

/**
 * Renders a boolean input.
 * This is a controlled component that requires an onValueChange callback that updates the value prop in order for the component to reflect user actions. If the value prop is not updated, the component will continue to render the supplied value prop instead of the expected result of any user actions.
 * @see [Documentation and Examples]{@link https://docs.infinite.red/ignite-cli/boilerplate/components/Toggle/}
 * @param {ToggleProps} props - The props for the `Toggle` component.
 * @returns {JSX.Element} The rendered `Toggle` component.
 */
export function Toggle(props: ToggleProps) {
  const {
    variant = "checkbox",
    editable = true,
    status,
    value,
    onPress,
    onValueChange,
    labelPosition = "right",
    helper,
    helperTx,
    helperTxOptions,
    HelperTextProps,
    containerStyle: $containerStyleOverride,
    inputWrapperStyle: $inputWrapperStyleOverride,
    testID,
    accessibilityLabel,
    ...WrapperProps
  } = props

  const { switchAccessibilityMode } = props as SwitchToggleProps
  const { checkboxIcon } = props as CheckboxToggleProps

  const disabled = editable === false || status === "disabled" || props.disabled

  // Use Pressable instead of TouchableOpacity for better React Native Web compatibility
  const Wrapper = useMemo(
    () => (disabled ? View : Pressable) as ComponentType<PressableProps | ViewProps>,
    [disabled],
  )
  const ToggleInput = useMemo(() => ToggleInputs[variant] || (() => null), [variant])

  const $containerStyles = [$containerStyleOverride]
  const $inputWrapperStyles = [$inputWrapper, $inputWrapperStyleOverride]
  const $helperStyles = [
    $helper,
    status === "error" && { color: colors.error },
    HelperTextProps?.style,
  ]

  /**
   * @param {GestureResponderEvent} e - The event object.
   */
  function handlePress(e: GestureResponderEvent) {
    if (disabled) return
    onValueChange?.(!value)
    onPress?.(e)
  }

  // Pressable can work with regular children, but we need to ensure it's clickable
  const pressableContent = (
    <>
      <View style={$inputWrapperStyles}>
        {labelPosition === "left" && <FieldLabel {...props} labelPosition={labelPosition} />}

        <ToggleInput
          on={!!value}
          disabled={!!disabled}
          status={status}
          outerStyle={props.inputOuterStyle ?? {}}
          innerStyle={props.inputInnerStyle ?? {}}
          detailStyle={props.inputDetailStyle ?? {}}
          switchAccessibilityMode={switchAccessibilityMode}
          checkboxIcon={checkboxIcon}
          testID={testID}
        />

        {labelPosition === "right" && <FieldLabel {...props} labelPosition={labelPosition} />}
      </View>

      {!!(helper || helperTx) && (
        <Text
          preset="formHelper"
          text={helper}
          tx={helperTx}
          txOptions={helperTxOptions}
          {...HelperTextProps}
          style={$helperStyles}
        />
      )}
    </>
  )

  // For React Native Web, we need to ensure aria-checked is set explicitly
  // Pressable might not always set it from accessibilityState
  const webProps = Platform.OS === 'web' ? {
    'aria-checked': value,
    'aria-disabled': disabled,
  } : {}
  
  return (
    <Wrapper
      accessibilityRole={variant}
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel || testID}
      onPress={handlePress}
      style={$containerStyles}
      testID={testID}
      {...webProps}
      {...WrapperProps}
    >
      {disabled ? pressableContent : pressableContent}
    </Wrapper>
  )
}

const ToggleInputs: Record<Variants, FC<ToggleInputProps>> = {
  checkbox: Checkbox,
  switch: Switch,
  radio: Radio,
}

/**
 * @param {ToggleInputProps} props - The props for the `Checkbox` component.
 * @returns {JSX.Element} The rendered `Checkbox` component.
 */
function Checkbox(props: ToggleInputProps & { testID?: string }) {
  const {
    on,
    status,
    disabled,
    checkboxIcon,
    outerStyle: $outerStyleOverride,
    innerStyle: $innerStyleOverride,
    detailStyle: $detailStyleOverride,
    testID,
  } = props

  const offBackgroundColor = [
    disabled && colors.palette.neutral400,
    status === "error" && colors.errorBackground,
    colors.palette.neutral200,
  ].filter(Boolean)[0]

  const outerBorderColor = [
    disabled && colors.palette.neutral400,
    status === "error" && colors.error,
    !on && colors.palette.neutral800,
    colors.palette.secondary500,
  ].filter(Boolean)[0]

  const onBackgroundColor = [
    disabled && colors.transparent,
    status === "error" && colors.errorBackground,
    colors.palette.secondary500,
  ].filter(Boolean)[0]

  const iconTintColor = [
    disabled && colors.palette.neutral600,
    status === "error" && colors.error,
    colors.palette.accent100,
  ].filter(Boolean)[0]

  return (
    <View
      style={[
        $inputOuterVariants.checkbox,
        { backgroundColor: offBackgroundColor, borderColor: outerBorderColor },
        $outerStyleOverride,
      ]}
      testID={testID}
    >
      <Animated.View
        style={[
          $checkboxInner,
          { backgroundColor: onBackgroundColor },
          $innerStyleOverride,
          useAnimatedStyle(() => ({ opacity: withTiming(on ? 1 : 0) }), [on]),
        ]}
      >
        <Image
          source={checkboxIcon ? iconRegistry[checkboxIcon] : iconRegistry.check}
          style={[$checkboxDetail, $detailStyleOverride]}
          tintColor={iconTintColor}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  )
}

/**
 * @param {ToggleInputProps} props - The props for the `Radio` component.
 * @returns {JSX.Element} The rendered `Radio` component.
 */
function Radio(props: ToggleInputProps & { testID?: string }) {
  const {
    on,
    status,
    disabled,
    outerStyle: $outerStyleOverride,
    innerStyle: $innerStyleOverride,
    detailStyle: $detailStyleOverride,
    testID,
  } = props

  const offBackgroundColor = [
    disabled && colors.palette.neutral400,
    status === "error" && colors.errorBackground,
    colors.palette.neutral200,
  ].filter(Boolean)[0]

  const outerBorderColor = [
    disabled && colors.palette.neutral400,
    status === "error" && colors.error,
    !on && colors.palette.neutral800,
    colors.palette.secondary500,
  ].filter(Boolean)[0]

  const onBackgroundColor = [
    disabled && colors.transparent,
    status === "error" && colors.errorBackground,
    colors.palette.neutral100,
  ].filter(Boolean)[0]

  const dotBackgroundColor = [
    disabled && colors.palette.neutral600,
    status === "error" && colors.error,
    colors.palette.secondary500,
  ].filter(Boolean)[0]

  return (
    <View
      style={[
        $inputOuterVariants.radio,
        { backgroundColor: offBackgroundColor, borderColor: outerBorderColor },
        $outerStyleOverride,
      ]}
      testID={testID}
    >
      <Animated.View
        style={[
          $radioInner,
          { backgroundColor: onBackgroundColor },
          $innerStyleOverride,
          useAnimatedStyle(() => ({ opacity: withTiming(on ? 1 : 0) }), [on]),
        ]}
      >
        <View
          style={[$radioDetail, { backgroundColor: dotBackgroundColor }, $detailStyleOverride]}
        />
      </Animated.View>
    </View>
  )
}

/**
 * @param {ToggleInputProps} props - The props for the `Switch` component.
 * @returns {JSX.Element} The rendered `Switch` component.
 */
function Switch(props: ToggleInputProps & { testID?: string }) {
  const {
    on,
    status,
    disabled,
    outerStyle: $outerStyleOverride,
    innerStyle: $innerStyleOverride,
    detailStyle: $detailStyleOverride,
    testID,
  } = props

  // Use theme-aware colors for better dark mode visibility
  const { colors: themeColors, currentTheme } = useTheme()
  const isDarkMode = currentTheme === "dark"

  const knobSizeFallback = 2

  const knobWidth = [$detailStyleOverride?.width, $switchDetail?.width, knobSizeFallback].find(
    (v) => typeof v === "number",
  )

  const knobHeight = [$detailStyleOverride?.height, $switchDetail?.height, knobSizeFallback].find(
    (v) => typeof v === "number",
  )

  // Use theme-aware colors with better contrast for dark mode
  // Use same background color for both on and off states (no color change)
  const offBackgroundColor = [
    disabled && themeColors.palette.neutral400,
    status === "error" && themeColors.errorBackground,
    isDarkMode ? themeColors.palette.neutral500 : colors.palette.neutral300,
  ].filter(Boolean)[0]

  const onBackgroundColor = [
    disabled && themeColors.transparent,
    status === "error" && themeColors.errorBackground,
    isDarkMode ? themeColors.palette.neutral500 : colors.palette.neutral300, // Same as off state
  ].filter(Boolean)[0]

  // Keep knob color constant to avoid re-renders that break animation
  const knobBackgroundColor = [
    $detailStyleOverride?.backgroundColor,
    status === "error" && themeColors.error,
    disabled && themeColors.palette.neutral600,
    themeColors.palette.neutral100, // Always use same color regardless of on/off state
  ].filter(Boolean)[0]

  const $animatedSwitchKnob = useAnimatedStyle(() => {
    const offsetLeft = ($innerStyleOverride?.paddingStart ||
      $innerStyleOverride?.paddingLeft ||
      $switchInner?.paddingStart ||
      $switchInner?.paddingLeft ||
      0) as number

    const offsetRight = ($innerStyleOverride?.paddingEnd ||
      $innerStyleOverride?.paddingRight ||
      $switchInner?.paddingEnd ||
      $switchInner?.paddingRight ||
      0) as number

    const switchWidth = 56 // From $inputOuterVariants.switch width
    const knobW = knobWidth || 24
    const maxTranslate = switchWidth - knobW - offsetLeft - offsetRight
    
    const translateX = withTiming(on ? maxTranslate : 0, {
      duration: 200,
    })

    return { 
      transform: [{ translateX }],
    }
  }, [on, knobWidth])

  return (
    <View
      style={[
        $inputOuterVariants.switch,
        { backgroundColor: offBackgroundColor },
        $outerStyleOverride,
      ]}
      testID={testID}
    >
      <Animated.View
        style={[
          $switchInner,
          { backgroundColor: onBackgroundColor },
          $innerStyleOverride,
          useAnimatedStyle(() => ({ opacity: withTiming(on ? 1 : 0) }), [on]),
        ]}
      />

      <SwitchAccessibilityLabel {...props} role="on" />
      <SwitchAccessibilityLabel {...props} role="off" />

      <Animated.View
        style={[
          $switchDetail,
          $detailStyleOverride,
          { 
            width: knobWidth, 
            height: knobHeight,
            backgroundColor: knobBackgroundColor,
            left: ($innerStyleOverride?.paddingStart ||
              $innerStyleOverride?.paddingLeft ||
              $switchInner?.paddingStart ||
              $switchInner?.paddingLeft ||
              0) as number,
          },
          $animatedSwitchKnob,
        ]}
      />
    </View>
  )
}

/**
 * @param {ToggleInputProps & { role: "on" | "off" }} props - The props for the `SwitchAccessibilityLabel` component.
 * @returns {JSX.Element} The rendered `SwitchAccessibilityLabel` component.
 */
function SwitchAccessibilityLabel(props: ToggleInputProps & { role: "on" | "off" }) {
  const { on, disabled, status, switchAccessibilityMode, role, innerStyle, detailStyle } = props

  if (!switchAccessibilityMode) return null

  const shouldLabelBeVisible = (on && role === "on") || (!on && role === "off")

  const $switchAccessibilityStyle: StyleProp<ViewStyle> = [
    $switchAccessibility,
    role === "off" && { end: "5%" },
    role === "on" && { left: "5%" },
  ]

  const color = (function () {
    if (disabled) return colors.palette.neutral600
    if (status === "error") return colors.error
    if (!on) return innerStyle?.backgroundColor || colors.palette.secondary500
    return detailStyle?.backgroundColor || colors.palette.neutral100
  })()

  return (
    <View style={$switchAccessibilityStyle}>
      {switchAccessibilityMode === "text" && shouldLabelBeVisible && (
        <View
          style={[
            role === "on" && $switchAccessibilityLine,
            role === "on" && { backgroundColor: color },
            role === "off" && $switchAccessibilityCircle,
            role === "off" && { borderColor: color },
          ]}
        />
      )}

      {switchAccessibilityMode === "icon" && shouldLabelBeVisible && (
        <Image
          style={$switchAccessibilityIcon}
          tintColor={color}
          resizeMode="contain"
          source={role === "off" ? iconRegistry.hidden : iconRegistry.view}
        />
      )}
    </View>
  )
}

/**
 * @param {BaseToggleProps} props - The props for the `FieldLabel` component.
 * @returns {JSX.Element} The rendered `FieldLabel` component.
 */
function FieldLabel(props: BaseToggleProps) {
  const {
    status,
    label,
    labelTx,
    labelTxOptions,
    LabelTextProps,
    labelPosition,
    labelStyle: $labelStyleOverride,
  } = props

  if (!label && !labelTx && !LabelTextProps?.children) return null

  const $labelStyle = [
    $label,
    status === "error" && { color: colors.error },
    labelPosition === "right" && $labelRight,
    labelPosition === "left" && $labelLeft,
    $labelStyleOverride,
    LabelTextProps?.style,
  ]

  return (
    <Text
      preset="formLabel"
      text={label}
      tx={labelTx}
      txOptions={labelTxOptions}
      {...LabelTextProps}
      style={$labelStyle}
    />
  )
}

const $inputWrapper: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
}

const $inputOuterBase: ViewStyle = {
  height: 24,
  width: 24,
  borderWidth: 2,
  alignItems: "center",
  overflow: "hidden",
  flexGrow: 0,
  flexShrink: 0,
  justifyContent: "space-between",
  flexDirection: "row",
}

const $inputOuterVariants: Record<Variants, StyleProp<ViewStyle>> = {
  checkbox: [$inputOuterBase, { borderRadius: 4 }],
  radio: [$inputOuterBase, { borderRadius: 12 }],
  switch: [$inputOuterBase, { height: 32, width: 56, borderRadius: 16, borderWidth: 0 }],
}

const $checkboxInner: ViewStyle = {
  width: "100%",
  height: "100%",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
}

const $checkboxDetail: ImageStyle = {
  width: 20,
  height: 20,
  // resizeMode moved to Image prop
}

const $radioInner: ViewStyle = {
  width: "100%",
  height: "100%",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
}

const $radioDetail: ViewStyle = {
  width: 12,
  height: 12,
  borderRadius: 6,
}

const $switchInner: ViewStyle = {
  width: "100%",
  height: "100%",
  alignItems: "center",
  borderColor: colors.transparent,
  overflow: "hidden",
  position: "absolute",
  paddingStart: 4,
  paddingEnd: 4,
}

const $switchDetail: SwitchToggleProps["inputDetailStyle"] = {
  borderRadius: 12,
  position: "absolute",
  width: 24,
  height: 24,
}

const $helper: TextStyle = {
  marginTop: spacing.xs,
}

const $label: TextStyle = {
  flex: 1,
}

const $labelRight: TextStyle = {
  marginStart: spacing.md,
}

const $labelLeft: TextStyle = {
  marginEnd: spacing.md,
}

const $switchAccessibility: TextStyle = {
  width: "40%",
  justifyContent: "center",
  alignItems: "center",
}

const $switchAccessibilityIcon: ImageStyle = {
  width: 14,
  height: 14,
  // resizeMode moved to Image prop
}

const $switchAccessibilityLine: ViewStyle = {
  width: 2,
  height: 12,
}

const $switchAccessibilityCircle: ViewStyle = {
  borderWidth: 2,
  width: 12,
  height: 12,
  borderRadius: 6,
}
