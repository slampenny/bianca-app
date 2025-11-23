import React, { ErrorInfo } from "react"
import { ScrollView, TextStyle, View, ViewStyle, Platform } from "react-native"
import { Button, Icon, Screen, Text } from "../../components"
import { colors, spacing } from "../../theme"

export interface ErrorDetailsProps {
  error: Error
  errorInfo: ErrorInfo | null
  onReset(): void
}

/**
 * Renders the error details screen.
 * @param {ErrorDetailsProps} props - The props for the `ErrorDetails` component.
 * @returns {JSX.Element} The rendered `ErrorDetails` component.
 */
export function ErrorDetails(props: ErrorDetailsProps) {
  return (
    <Screen
      preset="fixed"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={$contentContainer}
    >
      <View style={$topSection}>
        <Icon icon="x" size={64} color={colors.error} />
        <Text style={$heading} preset="subheading" tx="errorScreen.title" />
        <Text tx="errorScreen.friendlySubtitle" />
      </View>

      <ScrollView style={$errorSection} contentContainerStyle={$errorSectionContentContainer}>
        <Text style={$errorContent} weight="bold" text={`${props.error}`.trim()} />
        <Text
          selectable
          style={$errorBacktrace}
          text={`${props.errorInfo?.componentStack ?? ""}`.trim()}
        />
      </ScrollView>

      <Button
        preset="reversed"
        style={$resetButton}
        onPress={props.onReset}
        tx="errorScreen.reset"
      />
    </Screen>
  )
}

const $contentContainer: ViewStyle = {
  alignItems: "center",
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.xl,
  flex: 1,
}

const $topSection: ViewStyle = {
  flex: 1,
  alignItems: "center",
}

const $heading: TextStyle = {
  color: colors.error,
  marginBottom: spacing.md,
}

const $errorSection: ViewStyle = {
  flex: 2,
  backgroundColor: colors.separator,
  marginVertical: spacing.md,
  borderRadius: 6,
  width: '100%',
  maxWidth: '100%',
}

const $errorSectionContentContainer: ViewStyle = {
  padding: spacing.md,
  width: '100%',
  maxWidth: '100%',
}

const $errorContent: TextStyle = {
  color: colors.error,
  wordBreak: 'break-word' as any,
  overflowWrap: 'break-word' as any,
}

const $errorBacktrace: TextStyle = {
  marginTop: spacing.md,
  color: colors.textDim,
  wordBreak: 'break-word' as any,
  overflowWrap: 'break-word' as any,
  fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  fontSize: Platform.OS === 'web' ? 12 : undefined,
}

const $resetButton: ViewStyle = {
  backgroundColor: colors.error,
  paddingHorizontal: spacing.xxl,
}
