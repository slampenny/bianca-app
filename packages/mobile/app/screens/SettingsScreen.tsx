import React from "react"
import { View, StyleSheet, Pressable, ScrollView } from "react-native"
import { useNavigation, NavigationProp } from "@react-navigation/native"
import { Ionicons } from "@expo/vector-icons"
import { Text, Card } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import type { SettingsStackParamList } from "app/navigators/navigationTypes"
import { useSelector } from "react-redux"
import { getCurrentUser } from "app/store/authSlice"

type SettingsRow = {
  key: string
  labelKey: import("../i18n").TxKeyPath
  icon: keyof typeof Ionicons.glyphMap
  route: keyof SettingsStackParamList
  testID: string
}

const ROWS: SettingsRow[] = [
  { key: "profile", labelKey: "settingsScreen.account", icon: "person-outline", route: "Profile", testID: "settings-account" },
  { key: "privacy", labelKey: "legalLinks.privacyPolicy", icon: "shield-outline", route: "Privacy", testID: "settings-privacy" },
  { key: "terms", labelKey: "legalLinks.termsOfService", icon: "document-text-outline", route: "Terms", testID: "settings-terms" },
  { key: "privacyRequest", labelKey: "headers.privacyRequest", icon: "download-outline", route: "PrivacyRequest", testID: "settings-privacy-request" },
  { key: "logout", labelKey: "headers.logout", icon: "log-out-outline", route: "Logout", testID: "settings-logout" },
]

export function SettingsScreen() {
  const navigation = useNavigation<NavigationProp<SettingsStackParamList>>()
  const { colors } = useTheme()
  const currentUser = useSelector(getCurrentUser)
  const styles = createStyles(colors)

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} testID="settings-screen">
      <View style={styles.headerBlock}>
        <Text style={styles.greeting}>
          {translate("settingsScreen.greeting", { name: currentUser?.name?.split(" ")[0] || "" })}
        </Text>
        <Text style={styles.subtitle} tx="settingsScreen.subtitle" />
      </View>

      {ROWS.map((row) => (
        <Card
          key={row.key}
          testID={row.testID}
          onPress={() => navigation.navigate(row.route)}
          style={styles.rowCard}
          ContentComponent={
            <Pressable style={styles.rowInner} accessibilityRole="button">
              <View style={[styles.iconCircle, { backgroundColor: `${colors.palette.primary500}18` }]}>
                <Ionicons name={row.icon} size={22} color={colors.palette.primary500} />
              </View>
              <Text style={styles.rowLabel} tx={row.labelKey} />
              <Ionicons name="chevron-forward" size={20} color={colors.palette.neutral400} />
            </Pressable>
          }
        />
      ))}
    </ScrollView>
  )
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.palette.neutral200,
    },
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 10,
    },
    headerBlock: {
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    greeting: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.palette.biancaHeader ?? colors.text,
    },
    subtitle: {
      fontSize: 15,
      color: colors.palette.neutral600,
      marginTop: 4,
      lineHeight: 22,
    },
    rowCard: {
      paddingVertical: 0,
      paddingHorizontal: 0,
    },
    rowInner: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 14,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    rowLabel: {
      flex: 1,
      fontSize: 16,
      fontWeight: "600",
      color: colors.palette.neutral800 ?? colors.text,
    },
  })
