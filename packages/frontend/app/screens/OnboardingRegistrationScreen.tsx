import React, { useState, useEffect } from "react"
import { View, StyleSheet, Pressable } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { Button, Text, Screen, TextField, PhoneInputWeb, CountryPicker } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { useSelector } from "react-redux"
import { getCurrentUser } from "app/store/authSlice"
import { useCompleteOnboardingMutation } from "app/services/api/authApi"
import { useUpdateCaregiverMutation } from "app/services/api/caregiverApi"
import type { OnboardingPersona } from "app/services/api/api.types"
import { OnboardingStackParamList } from "app/navigators/navigationTypes"
import { Ionicons } from "@expo/vector-icons"

export type OnboardingRegistrationScreenProps = StackScreenProps<
  OnboardingStackParamList,
  "OnboardingRegistration"
>

export function OnboardingRegistrationScreen({ route, navigation }: OnboardingRegistrationScreenProps) {
  const { persona } = route.params
  const currentUser = useSelector(getCurrentUser)
  const { colors, isLoading: themeLoading } = useTheme()
  const [completeOnboarding, { isLoading: isCompleting }] = useCompleteOnboardingMutation()
  const [updateCaregiver] = useUpdateCaregiverMutation()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [country, setCountry] = useState("CA")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [singleConsentState, setSingleConsentState] = useState(true)
  const [showWhyImportant, setShowWhyImportant] = useState(false)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

  const showConsent = persona === "organization" || persona === "caregiver"

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || "")
      setEmail(currentUser.email || "")
      setPhone(currentUser.phone || "")
    }
  }, [currentUser])

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
  const canSubmit = acceptTerms && name.trim() && email.trim()
  const nameInvalid = attemptedSubmit && !name.trim()
  const emailInvalid = attemptedSubmit && !email.trim()
  const termsInvalid = attemptedSubmit && !acceptTerms

  const handleSave = async () => {
    if (!currentUser?.id) return
    if (!canSubmit) {
      setAttemptedSubmit(true)
      return
    }
    try {
      const updates: { name?: string; phone?: string } = {}
      if (name.trim() !== (currentUser.name || "")) updates.name = name.trim()
      if (phone.trim() !== (currentUser.phone || "")) updates.phone = phone.trim() || undefined
      if (Object.keys(updates).length > 0) {
        await updateCaregiver({ id: currentUser.id, caregiver: updates }).unwrap()
      }
      await completeOnboarding({
        persona,
        acceptTerms: true,
        ...(showConsent && { singleConsentState }),
      }).unwrap()
    } catch {
      // Error handled by RTK
    }
  }

  const openTerms = () => navigation.navigate("Terms")
  const openPrivacy = () => navigation.navigate("Privacy")

  return (
    <Screen
      testID="onboarding-registration-screen"
      style={[styles.screen, { backgroundColor: colors.palette?.biancaBackground }]}
      preset="scroll"
    >
      <View style={[styles.container, styles.centeredContent]}>
        <View style={styles.contentBlock}>
          <Text style={stylesWithColors.title} tx="onboarding.registration.title" />
          <Text style={stylesWithColors.subtitle} tx="onboarding.registration.subtitle" />

          <View style={styles.field}>
            <TextField
              value={name}
              onChangeText={(t) => { setName(t); if (nameInvalid) setAttemptedSubmit(false) }}
              labelTx="registerScreen.nameFieldLabel"
              placeholderTx="registerScreen.nameFieldPlaceholder"
              status={nameInvalid ? "error" : undefined}
              helper={nameInvalid ? translate("onboarding.registration.nameRequired") : undefined}
              testID="onboarding-reg-name"
            />
          </View>
          <View style={styles.field}>
            <TextField
              value={email}
              onChangeText={(t) => { setEmail(t); if (emailInvalid) setAttemptedSubmit(false) }}
              labelTx="registerScreen.emailFieldLabel"
              placeholderTx="registerScreen.emailFieldPlaceholder"
              keyboardType="email-address"
              autoCapitalize="none"
              status={emailInvalid ? "error" : undefined}
              helper={emailInvalid ? translate("onboarding.registration.emailRequired") : undefined}
              testID="onboarding-reg-email"
            />
          </View>
          <View style={styles.field}>
            <PhoneInputWeb
              value={phone}
              onChangeText={setPhone}
              labelTx="registerScreen.phoneFieldLabel"
              placeholderTx="registerScreen.phoneFieldPlaceholder"
              testID="onboarding-reg-phone"
            />
          </View>
          <View style={styles.field}>
            <CountryPicker
              value={country}
              onValueChange={setCountry}
              labelTx="registerScreen.countryFieldLabel"
              containerStyle={styles.pickerContainer}
            />
          </View>

          {/* Terms */}
          <View style={[styles.termsSection, termsInvalid && stylesWithColors.termsSectionError]}>
            {termsInvalid && (
              <Text style={stylesWithColors.fieldErrorText}>{translate("onboarding.registration.termsRequired")}</Text>
            )}
            <Pressable
              style={styles.termsRow}
              onPress={() => { setAcceptTerms((v) => !v); if (termsInvalid) setAttemptedSubmit(false) }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptTerms }}
            >
              <View style={[stylesWithColors.checkbox, acceptTerms && stylesWithColors.checkboxChecked]}>
                {acceptTerms && <Ionicons name="checkmark" size={18} color="#fff" />}
              </View>
              <Text style={stylesWithColors.termsText}>
                {translate("onboarding.termsAndConsent.acceptTerms")}{" "}
                <Text style={stylesWithColors.link} onPress={openTerms}>{translate("onboarding.termsAndConsent.termsLink")}</Text>{" "}
                {translate("onboarding.termsAndConsent.and")}{" "}
                <Text style={stylesWithColors.link} onPress={openPrivacy}>{translate("onboarding.termsAndConsent.privacyLink")}</Text>
              </Text>
            </Pressable>
          </View>

          {/* Single-consent (org/caregiver only) */}
          {showConsent && (
            <View style={styles.consentSection}>
              <Text style={stylesWithColors.consentLabel} tx="onboarding.termsAndConsent.singleConsentQuestion" />
              <Pressable style={styles.whyButton} onPress={() => setShowWhyImportant((v) => !v)}>
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
                >
                  <Text style={[stylesWithColors.consentOptionText, singleConsentState && stylesWithColors.consentOptionTextSelected]}>
                    {translate("onboarding.termsAndConsent.yes")}
                  </Text>
                </Pressable>
                <Pressable
                  style={[stylesWithColors.consentOption, !singleConsentState && stylesWithColors.consentOptionSelected]}
                  onPress={() => setSingleConsentState(false)}
                >
                  <Text style={[stylesWithColors.consentOptionText, !singleConsentState && stylesWithColors.consentOptionTextSelected]}>
                    {translate("onboarding.termsAndConsent.no")}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <Button
              testID="onboarding-registration-save"
              tx="onboarding.termsAndConsent.saveAndContinue"
              preset="primary"
              onPress={handleSave}
              disabled={!canSubmit}
              loading={isCompleting}
              style={stylesWithColors.primaryButton}
              disabledStyle={stylesWithColors.primaryButtonDisabled}
              disabledTextStyle={stylesWithColors.primaryButtonDisabledText}
            />
          </View>
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 24 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  centeredContent: { justifyContent: "center", minHeight: "100%" },
  contentBlock: { maxWidth: 440, width: "100%", alignSelf: "center", paddingTop: 24 },
  field: { marginBottom: 18 },
  pickerContainer: { marginBottom: 0 },
  termsSection: { marginTop: 8, marginBottom: 20 },
  termsRow: { flexDirection: "row", alignItems: "flex-start" },
  consentSection: { marginBottom: 20 },
  whyButton: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  consentRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  footer: { marginTop: 24, paddingBottom: 24 },
})

const createStyles = (colors: any) =>
  StyleSheet.create({
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.palette?.biancaHeader ?? colors.text,
      marginBottom: 10,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 18,
      color: colors.palette?.neutral600 ?? colors.text,
      marginBottom: 24,
      textAlign: "center",
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
    termsText: { flex: 1, fontSize: 16, lineHeight: 22, color: colors.palette?.neutral700 ?? colors.text },
    link: { color: colors.palette?.primary600 ?? "#4f46e5", textDecorationLine: "underline", fontWeight: "600" },
    consentLabel: { fontSize: 16, fontWeight: "600", color: colors.palette?.biancaHeader ?? colors.text, marginBottom: 4 },
    whyText: { fontSize: 14, color: colors.palette?.primary600 ?? "#4f46e5", fontWeight: "500" },
    whyBody: { fontSize: 14, lineHeight: 20, color: colors.palette?.neutral600 ?? colors.text, marginBottom: 12 },
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
    consentOptionText: { fontSize: 16, fontWeight: "600", color: colors.palette?.neutral700 ?? colors.text },
    consentOptionTextSelected: { color: colors.palette?.primary700 ?? "#4338ca" },
    primaryButton: {
      borderRadius: 20,
      paddingVertical: 14,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
      backgroundColor: (colors.palette as any)?.neutral400 ?? "#a3a3a3",
    },
    primaryButtonDisabledText: {
      color: (colors.palette as any)?.neutral600 ?? "#525252",
    },
    termsSectionError: {
      borderWidth: 1,
      borderColor: colors.palette?.error500 ?? "#dc2626",
      borderRadius: 8,
      padding: 12,
      backgroundColor: (colors.palette as any)?.error50 ?? "#fef2f2",
    },
    fieldErrorText: {
      fontSize: 14,
      color: colors.palette?.error600 ?? "#b91c1c",
      marginBottom: 6,
    },
  })
