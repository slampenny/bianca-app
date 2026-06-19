import React from "react"
import { Pressable, StyleSheet, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "../i18n"
import { Text } from "./Text"

export interface StatusBannerProps {
  unreadAlertCount: number
  onPressAlerts?: () => void
}

export function StatusBanner({ unreadAlertCount, onPressAlerts }: StatusBannerProps) {
  const { colors } = useTheme()
  const hasAlerts = unreadAlertCount > 0
  const styles = createStyles(colors, hasAlerts)

  const title = hasAlerts
    ? translate("homeScreen.statusAlertsTitle", { count: unreadAlertCount })
    : translate("homeScreen.statusAllOk")
  const subtitle = hasAlerts
    ? translate("homeScreen.statusAlertsSubtitle")
    : translate("homeScreen.statusAllOkSubtitle")

  const content = (
    <>
      <View style={styles.iconWrap}>
        <Ionicons
          name={hasAlerts ? "alert-circle" : "checkmark-circle"}
          size={22}
          color={hasAlerts ? colors.palette.error600 : colors.palette.medical500}
        />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title} text={title} />
        <Text style={styles.subtitle} text={subtitle} />
      </View>
    </>
  )

  if (hasAlerts && onPressAlerts) {
  return (
    <Pressable
      style={styles.banner}
      onPress={onPressAlerts}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={translate("homeScreen.statusAlertsActionHint")}
      testID="home-status-banner"
    >
        {content}
      </Pressable>
    )
  }

  return <View style={styles.banner} testID="home-status-banner">{content}</View>
}

const createStyles = (colors: any, hasAlerts: boolean) =>
  StyleSheet.create({
    banner: {
      alignItems: "center",
      backgroundColor: hasAlerts ? colors.palette.error100 : "rgba(20, 184, 166, 0.12)",
      borderColor: hasAlerts ? colors.palette.error200 : "rgba(20, 184, 166, 0.35)",
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    iconWrap: {
      alignItems: "center",
      backgroundColor: hasAlerts ? colors.palette.error200 : "rgba(20, 184, 166, 0.25)",
      borderRadius: 12,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    subtitle: {
      color: hasAlerts ? colors.palette.error600 : colors.palette.primary600,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 2,
    },
    textWrap: {
      flex: 1,
    },
    title: {
      color: colors.palette.biancaHeader,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 20,
    },
  })
