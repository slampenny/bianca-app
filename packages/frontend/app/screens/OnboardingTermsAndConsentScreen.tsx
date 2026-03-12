import React, { useState } from "react"
import { View, StyleSheet, Pressable } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { Button, Text, Screen } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { useCompleteOnboardingMutation } from "app/services/api/authApi"
import type { OnboardingPersona } from "app/services/api/api.types"
import { OnboardingStackParamList } from "app/navigators/navigationTypes"
import { Ionicons } from "@expo/vector-icons"

export type OnboardingTermsAndConsentScreenProps = StackScreenProps<
  OnboardingStackParamList,
  "OnboardingTermsAndConsent"
>

export function OnboardingTermsAndConsentScreen({
  route,
  navigation,
}: OnboardingTermsAndConsentScreenProps) {
  const { persona } = (route.params || {}) as { persona?: import("app/services/api/api.types").OnboardingPersona }
  const { colors, isLoading: themeLoading } = useTheme()
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [singleConsentState, setSingleConsentState] = useState(false)
  const [showWhyImportant, setShowWhyImportant] = useState(false)
  const [completeOnboarding, { isLoading }] = useCompleteOnboardingMutation()

  if (themeLoading) {
    return (
      <Screen style={[styles.screen, { backgroundColor: colors.palette?.biancaBackground }]}>
        <View style={styles.centered}>
          <Text>{translate("common.loading")}</Text>
        </View>
      </Screen>
    )
  }

  const stylesWithColors = createStyles(colors)
  const canSubmit = acceptTerms

  const handleSave = async () => {
    if (!canSubmit) return
    try {
      await completeOnboarding({
        persona,
        acceptTerms: true,
        singleConsentState,
      }).unwrap()
    } catch {
      // Error handled by RTK
    }
  }

  const openTerms = () => navigation.navigate("Terms")
  const openPrivacy = () => navigation.navigate("Privacy")

  return (
    <Screen
      testID="onboarding-terms-and-consent-screen"
      style={[styles.screen, { backgroundColor: colors.palette?.biancaBackground }]}
      preset="scroll"
    >
      <View style={styles.container}>
        <Text style={stylesWithColors.title} tx="onboarding.termsAndConsent.title" />

        {/* Terms acceptance */}
        <Pressable
          style={styles.termsRow}
          onPress={() => setAcceptTerms((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptTerms }}
          accessibilityLabel={translate("onboarding.termsAndConsent.acceptTermsLabel")}
        >
          <View style={[stylesWithColors.checkbox, acceptTerms && stylesWithColors.checkboxChecked]}>
            {acceptTerms && <Ionicons name="checkmark" size={18} color="#fff" />}
          </View>
          <Text style={stylesWithColors.termsText}>
            {translate("onboarding.termsAndConsent.acceptTerms")}{" "}
            <Text style={stylesWithColors.link} onPress={openTerms}>
              {translate("onboarding.termsAndConsent.termsLink")}
            </Text>{" "}
            {translate("onboarding.termsAndConsent.and")}{" "}
            <Text style={stylesWithColors.link} onPress={openPrivacy}>
              {translate("onboarding.termsAndConsent.privacyLink")}
            </Text>
          </Text>
        </Pressable>

        {/* Single-consent question */}
        <View style={styles.consentSection}>
          <Text style={stylesWithColors.label} tx="onboarding.termsAndConsent.singleConsentQuestion" />
          <Pressable
            style={styles.whyButton}
            onPress={() => setShowWhyImportant((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={translate("onboarding.termsAndConsent.whyImportant")}
          >
            <Ionicons name="help-circle-outline" size={20} color={colors.palette?.primary500 ?? "#6366f1"} />
            <Text style={stylesWithColors.whyText}>{translate("onboarding.termsAndConsent.whyImportant")}</Text>
          </Pressable>
          {showWhyImportant && (
            <Text style={stylesWithColors.whyBody} tx="onboarding.termsAndConsent.whyImportantBody" />
          )}
          <View style={styles.consentRow}>
            <Pressable
              style={[stylesWithColors.consentOption, singleConsentState && stylesWithColors.consentOptionSelected]}
              onPress={() => setSingleConsentState(true)}
              accessibilityRole="radio"
              accessibilityState={{ selected: singleConsentState }}
              accessibilityLabel={translate("onboarding.termsAndConsent.yes")}
            >
              <Text style={[stylesWithColors.consentOptionText, singleConsentState && stylesWithColors.consentOptionTextSelected]}>
                {translate("onboarding.termsAndConsent.yes")}
              </Text>
            </Pressable>
            <Pressable
              style={[stylesWithColors.consentOption, !singleConsentState && stylesWithColors.consentOptionSelected]}
              onPress={() => setSingleConsentState(false)}
              accessibilityRole="radio"
              accessibilityState={{ selected: !singleConsentState }}
              accessibilityLabel={translate("onboarding.termsAndConsent.no")}
            >
              <Text style={[stylesWithColors.consentOptionText, !singleConsentState && stylesWithColors.consentOptionTextSelected]}>
                {translate("onboarding.termsAndConsent.no")}
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            testID="onboarding-terms-save"
            tx="onboarding.termsAndConsent.saveAndContinue"
            preset="primary"
            onPress={handleSave}
            disabled={!canSubmit}
            loading={isLoading}
          />
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  termsRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 24 },
  consentSection: { marginBottom: 24 },
  whyButton: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  consentRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  footer: { marginTop: 16, paddingBottom: 24 },
})

const createStyles = (colors: any) =>
  StyleSheet.create({
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.palette?.biancaHeader ?? colors.text,
      marginBottom: 20,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.palette?.neutral400 ?? "#a3a3a3",
      marginRight: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      backgroundColor: colors.palette?.primary500 ?? "#6366f1",
      borderColor: colors.palette?.primary500 ?? "#6366f1",
    },
    termsText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
      color: colors.palette?.neutral700 ?? colors.text,
    },
    link: {
      color: colors.palette?.primary600 ?? "#4f46e5",
      textDecorationLine: "underline",
      fontWeight: "600",
    },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.palette?.biancaHeader ?? colors.text,
      marginBottom: 4,
    },
    whyText: {
      fontSize: 14,
      color: colors.palette?.primary600 ?? "#4f46e5",
      fontWeight: "500",
    },
    whyBody: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.palette?.neutral600 ?? colors.text,
      marginBottom: 12,
    },
    consentOption: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.palette?.neutral300 ?? "#e5e5e5",
      alignItems: "center",
    },
    consentOptionSelected: {
      borderColor: colors.palette?.primary500 ?? "#6366f1",
      backgroundColor: (colors.palette as any)?.primary50 ?? "#eef2ff",
    },
    consentOptionText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.palette?.neutral700 ?? colors.text,
    },
    consentOptionTextSelected: {
      color: colors.palette?.primary700 ?? "#4338ca",
    },
  })
