import React from "react"
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from "react-native"
import { colors } from "app/theme/colors"

interface LoadingButtonProps {
  onPress: () => void
  title: string
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
  loadingText?: string
  testID?: string
  spinnerTestID?: string
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  onPress,
  title,
  loading = false,
  disabled = false,
  style,
  textStyle,
  loadingText,
  testID,
  spinnerTestID,
}) => {
  const isDisabled = disabled || loading

  const handlePress = () => {
    console.log('LoadingButton pressed', { title, loading, disabled, isDisabled, testID })
    if (!isDisabled && onPress) {
      onPress()
    }
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
    >
      {loading ? (
        <>
          <ActivityIndicator size="small" color={colors.palette.neutral100} style={styles.spinner} testID={spinnerTestID} />
          <Text style={[styles.buttonText, textStyle]}>
            {loadingText || title}
          </Text>
        </>
      ) : (
        <Text style={[styles.buttonText, textStyle]}>
          {title}
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