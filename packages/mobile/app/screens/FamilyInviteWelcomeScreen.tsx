import React from "react"
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import Config from "app/config"
import { Button, Screen, Text } from "app/components"
import { LoginStackParamList } from "app/navigators/navigationTypes"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { logger } from "app/utils/logger"

type Props = StackScreenProps<LoginStackParamList, "FamilyInviteWelcome">

export function FamilyInviteWelcomeScreen({ navigation }: Props) {
  const { colors } = useTheme()
  const iosUrl = (Config as { iosAppStoreUrl?: string }).iosAppStoreUrl?.trim() || ""
  const androidUrl = (Config as { androidAppStoreUrl?: string }).androidAppStoreUrl?.trim() || ""

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url)
    } catch (error) {
      logger.warn("[FamilyInviteWelcome] Failed to open URL:", error)
    }
  }

  return (
    <Screen style={styles.screen} preset="scroll" testID="family-invite-welcome-screen">
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.palette.biancaHeader }]} tx="familyInviteWelcome.title" />
        <Text style={[styles.body, { color: colors.textDim }]} tx="familyInviteWelcome.body" />

        {iosUrl ? (
          <Button
            text={translate("familyInviteWelcome.appStore")}
            preset="default"
            style={styles.button}
            testID="family-invite-app-store"
            onPress={() => void openUrl(iosUrl)}
          />
        ) : null}

        {androidUrl ? (
          <Button
            text={translate("familyInviteWelcome.googlePlay")}
            preset="default"
            style={styles.button}
            testID="family-invite-google-play"
            onPress={() => void openUrl(androidUrl)}
          />
        ) : null}

        {Platform.OS === "web" ? (
          <Button
            text={translate("familyInviteWelcome.continueInBrowser")}
            preset="primary"
            style={styles.primaryButton}
            testID="family-invite-continue-browser"
            onPress={() => (navigation as any).navigate("MainTabs")}
          />
        ) : (
          <Button
            text={translate("familyInviteWelcome.continueInApp")}
            preset="primary"
            style={styles.primaryButton}
            testID="family-invite-continue-app"
            onPress={() => (navigation as any).navigate("MainTabs")}
          />
        )}

        <Pressable onPress={() => (navigation as any).navigate("MainTabs")}>
          <Text style={[styles.skip, { color: colors.palette.secondary500 }]} tx="familyInviteWelcome.skipForNow" />
        </Pressable>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 28,
    textAlign: "center",
  },
  button: {
    marginBottom: 12,
  },
  primaryButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  skip: {
    fontSize: 15,
    textAlign: "center",
    textDecorationLine: "underline",
  },
})
