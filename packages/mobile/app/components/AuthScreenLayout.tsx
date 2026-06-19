import React, { ReactNode } from "react"
import { Platform, StyleSheet, View, ViewStyle, StyleProp } from "react-native"
import { Screen } from "./Screen"
import { Card } from "./Card"
import { useTheme } from "app/theme/ThemeContext"
import { platformShadow } from "../utils/styles"

export interface AuthScreenLayoutProps {
  children: ReactNode
  testID?: string
  accessibilityLabel?: string
  /** When true, children fill the card without extra inner padding (e.g. LoginForm). */
  compactCard?: boolean
  contentContainerStyle?: StyleProp<ViewStyle>
}

/**
 * Centered auth/onboarding shell — slate background, white card (matches web va-login).
 */
export function AuthScreenLayout({
  children,
  testID,
  accessibilityLabel,
  compactCard = false,
  contentContainerStyle,
}: AuthScreenLayoutProps) {
  const { colors } = useTheme()

  const cardShadow = platformShadow({
    color: colors.palette.neutral900,
    offset: { width: 0, height: 8 },
    opacity: 0.08,
    radius: 24,
  })

  const styles = StyleSheet.create({
    card: {
      alignSelf: "center",
      backgroundColor: colors.palette.neutral100,
      borderColor: colors.palette.neutral300,
      borderRadius: 16,
      borderWidth: 1,
      maxWidth: 440,
      paddingHorizontal: compactCard ? 0 : 24,
      paddingVertical: compactCard ? 0 : 28,
      width: "100%",
      ...cardShadow,
    },
    cardInner: {
      paddingHorizontal: compactCard ? 24 : 0,
      paddingVertical: compactCard ? 28 : 0,
    },
    screen: {
      backgroundColor: colors.palette.neutral200,
      flex: 1,
      ...(Platform.OS === "web"
        ? ({
            backgroundImage: "linear-gradient(160deg, #f1f5f9 0%, #f8fafc 50%, #e0f2f1 100%)",
          } as object)
        : {}),
    },
  })

  return (
    <Screen
      preset="scroll"
      style={styles.screen}
      contentContainerStyle={[{ flexGrow: 1, justifyContent: "center", padding: 24 }, contentContainerStyle]}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      <Card
        style={[styles.card, { flexDirection: "column", alignItems: "stretch" }]}
        ContentComponent={<View style={styles.cardInner}>{children}</View>}
      />
    </Screen>
  )
}
