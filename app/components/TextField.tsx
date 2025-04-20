import React, { ComponentType, forwardRef, Ref, useImperativeHandle, useRef } from "react"
import {
  StyleProp,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
  Platform,
} from "react-native"
import { isRTL, translate } from "../i18n"
import { colors, spacing, typography } from "../theme"
import { Text, TextProps } from "./Text"

export interface TextFieldAccessoryProps {
  style: StyleProp<any>
  status: TextFieldProps["status"]
  multiline: boolean
  editable: boolean
}

export interface TextFieldProps extends Omit<TextInputProps, "ref"> {
  status?: "error" | "disabled"
  label?: TextProps["text"]
  labelTx?: TextProps["tx"]
  labelTxOptions?: TextProps["txOptions"]
  LabelTextProps?: TextProps
  helper?: TextProps["text"]
  helperTx?: TextProps["tx"]
  helperTxOptions?: TextProps["txOptions"]
  HelperTextProps?: TextProps
  placeholder?: TextProps["text"]
  placeholderTx?: TextProps["tx"]
  placeholderTxOptions?: TextProps["txOptions"]
  style?: StyleProp<TextStyle>
  containerStyle?: StyleProp<ViewStyle>
  inputWrapperStyle?: StyleProp<ViewStyle>
  RightAccessory?: ComponentType<TextFieldAccessoryProps>
  LeftAccessory?: ComponentType<TextFieldAccessoryProps>
  testID?: string
}

export const TextField = forwardRef(function TextField(props: TextFieldProps, ref: Ref<TextInput>) {
  const {
    labelTx,
    label,
    labelTxOptions,
    placeholderTx,
    placeholder,
    placeholderTxOptions,
    helper,
    helperTx,
    helperTxOptions,
    status,
    RightAccessory,
    LeftAccessory,
    HelperTextProps,
    LabelTextProps,
    style: $inputStyleOverride,
    containerStyle: $containerStyleOverride,
    inputWrapperStyle: $inputWrapperStyleOverride,
    testID,
    ...TextInputProps
  } = props

  const input = useRef<TextInput>(null)
  const disabled = TextInputProps.editable === false || status === "disabled"
  const placeholderContent = placeholderTx
    ? translate(placeholderTx, placeholderTxOptions)
    : placeholder

  const $containerStyles: StyleProp<ViewStyle> = [
    $containerStyleOverride,
    Platform.OS === "web" && {
      outlineStyle: "none",
      outlineWidth: 0,
      outlineColor: "transparent",
      boxShadow: "none",
    },
  ]

  const $labelStyles = [$labelStyle, LabelTextProps?.style]

  const $inputWrapperStyles = [
    $inputWrapperStyle,
    status === "error" && { borderColor: colors.error },
    TextInputProps.multiline && { minHeight: 112 },
    LeftAccessory && { paddingStart: 0 },
    RightAccessory && { paddingEnd: 0 },
    $inputWrapperStyleOverride,
  ]

  const $inputStyles: StyleProp<TextStyle> = [
    $inputStyle,
    disabled && { color: colors.textDim },
    isRTL && { textAlign: "right" as TextStyle["textAlign"] },
    TextInputProps.multiline && { height: "auto" },
    $inputStyleOverride,
    Platform.OS === "web" && {
      outlineStyle: "none",
      outlineWidth: 0,
      outlineColor: "transparent",
      boxShadow: "none",
    },
  ]

  const $helperStyles = [
    $helperStyle,
    status === "error" && { color: colors.error },
    HelperTextProps?.style,
  ]

  useImperativeHandle(ref, () => input.current as TextInput)

  return (
    <View style={$containerStyles}>
      {!!(label || labelTx) && (
        <Text
          preset="formLabel"
          text={label}
          tx={labelTx}
          txOptions={labelTxOptions}
          {...LabelTextProps}
          style={$labelStyles}
        />
      )}

      <View style={$inputWrapperStyles}>
        {!!LeftAccessory && (
          <LeftAccessory
            style={$leftAccessoryStyle}
            status={status}
            editable={!disabled}
            multiline={TextInputProps.multiline ?? false}
          />
        )}
        <TextInput
          ref={input}
          underlineColorAndroid={colors.transparent}
          textAlignVertical="top"
          placeholder={placeholderContent}
          placeholderTextColor={colors.textDim}
          {...TextInputProps}
          editable={!disabled}
          style={$inputStyles}
          testID={testID}
        />

        {!!RightAccessory && (
          <RightAccessory
            style={$rightAccessoryStyle}
            status={status}
            editable={!disabled}
            multiline={TextInputProps.multiline ?? false}
          />
        )}
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
    </View>
  )
})

const $labelStyle: TextStyle = {
  marginBottom: spacing.xs,
  fontSize: 16,
  fontWeight: "500",
  color: "#2c3e50",
}

const $inputWrapperStyle: ViewStyle = {
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
}

const $inputStyle: TextStyle = {
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
}

const $helperStyle: TextStyle = {
  marginTop: spacing.xs,
  fontSize: 14,
  color: "#7f8c8d",
}

const $rightAccessoryStyle: ViewStyle = {
  marginEnd: spacing.xs,
  height: 40,
  justifyContent: "center",
  alignItems: "center",
}

const $leftAccessoryStyle: ViewStyle = {
  marginStart: spacing.xs,
  height: 40,
  justifyContent: "center",
  alignItems: "center",
}
