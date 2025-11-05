import React from "react"
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native"
import { colors } from "app/theme/colors"
import { translate } from "app/i18n"

interface LoadingButtonProps {
  onPress: () => void | Promise<void>
  title?: string
  tx?: string
  txOptions?: any
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
  loadingText?: string
  loadingTx?: string
  testID?: string
  spinnerTestID?: string
  accessibilityLabel?: string
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  onPress,
  title,
  tx,
  txOptions,
  loading = false,
  disabled = false,
  style,
  textStyle,
  loadingText,
  loadingTx,
  testID,
  spinnerTestID,
  accessibilityLabel,
}) => {
  const isDisabled = disabled || loading

  const handlePress = async () => {
    console.log('LoadingButton pressed', { title, tx, loading, disabled, isDisabled, testID })
    if (!isDisabled && onPress) {
      try {
        await onPress()
      } catch (error) {
        console.error('LoadingButton onPress error:', error)
      }
    }
  }

  // Get the display text based on props
  const getDisplayText = () => {
    if (tx) {
      return translate(tx, txOptions)
    }
    return title || ""
  }

  const getLoadingText = () => {
    if (loadingTx) {
      return translate(loadingTx, txOptions)
    }
    if (loadingText) {
      return loadingText
    }
    return getDisplayText()
  }

  return (
    <Pressable
      style={[
        styles.button,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
      testID={testID}
      accessibilityLabel={accessibilityLabel || testID}
    >
      {loading ? (
        <>
          <ActivityIndicator size="small" color={colors.palette.neutral100} style={styles.spinner} testID={spinnerTestID} />
          <Text style={[styles.buttonText, textStyle]}>
            {getLoadingText()}
          </Text>
        </>
      ) : (
        <Text style={[styles.buttonText, textStyle]}>
          {getDisplayText()}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.palette.biancaButtonSelected,
    borderRadius: 5,
    paddingVertical: 15,
    flexDirection: "row",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.palette.neutral100,
    fontSize: 18,
    fontWeight: "600",
  },
  spinner: {
    marginRight: 8,
  },
}) 