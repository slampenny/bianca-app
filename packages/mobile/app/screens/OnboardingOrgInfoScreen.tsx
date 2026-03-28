import React, { useState, useEffect } from "react"
import { View, StyleSheet } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { Button, Text, Screen, TextField, CountryPicker } from "app/components"
import { Picker } from "@react-native-picker/picker"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { useDispatch, useSelector } from "react-redux"
import { getOrg, setOrg } from "app/store/orgSlice"
import { getCurrentUser } from "app/store/authSlice"
import { useUpdateOrgMutation, orgApi } from "app/services/api/orgApi"
import type { OnboardingPersona } from "app/services/api/api.types"
import { OnboardingStackParamList } from "app/navigators/navigationTypes"

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (US & Canada)" },
  { value: "America/Chicago", label: "Central Time (US & Canada)" },
  { value: "America/Denver", label: "Mountain Time (US & Canada)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
  { value: "America/Vancouver", label: "Vancouver" },
  { value: "America/Toronto", label: "Toronto" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Australia/Sydney", label: "Sydney" },
]

export type OnboardingOrgInfoScreenProps = StackScreenProps<
  OnboardingStackParamList,
  "OnboardingOrgInfo"
>

export function OnboardingOrgInfoScreen({ route, navigation }: OnboardingOrgInfoScreenProps) {
  const { persona } = route.params
  const dispatch = useDispatch()
  const currentUser = useSelector(getCurrentUser)
  const currentOrg = useSelector(getOrg)
  const { colors, isLoading: themeLoading } = useTheme()
  const [updateOrg, { isLoading }] = useUpdateOrgMutation()
  const [orgName, setOrgName] = useState("")
  const [country, setCountry] = useState("US")
  const [timezone, setTimezone] = useState("America/New_York")

  const isPreRegisterFlow = !currentUser

  // If user has org but it's not in Redux, fetch it (only when logged in)
  useEffect(() => {
    if (isPreRegisterFlow) return
    if (currentOrg) {
      setOrgName(currentOrg.name || "")
      setCountry(currentOrg.country || "US")
      setTimezone(currentOrg.timezone || "America/New_York")
      return
    }
    if (currentUser?.org) {
      const getOrgPromise = (dispatch as (arg: unknown) => PromiseLike<{ data?: import("app/services/api/api.types").Org }>)(orgApi.endpoints.getOrg.initiate({ orgId: currentUser.org }))
        void Promise.resolve(getOrgPromise).then((res) => {
          if (res?.data) dispatch(setOrg(res.data))
        }).catch(() => {})
    }
  }, [currentOrg, currentUser?.org, dispatch, isPreRegisterFlow])

  const orgLoading = !isPreRegisterFlow && currentUser?.org && !currentOrg

  if (themeLoading || orgLoading) {
    return (
      <Screen style={[styles.screen, { backgroundColor: colors.palette?.biancaBackground }]}>
        <View style={styles.centered}>
          <Text>{translate("common.loading")}</Text>
        </View>
      </Screen>
    )
  }

  const stylesWithColors = createStyles(colors)
  const canSubmit = isPreRegisterFlow
    ? orgName.trim().length > 0
    : !!currentOrg?.id && orgName.trim().length > 0

  const handleContinue = async () => {
    if (isPreRegisterFlow) {
      ;(navigation as any).replace("Register", {
        persona,
        orgName: orgName.trim(),
        orgCountry: country,
        orgTimezone: timezone,
      })
      return
    }
    if (!canSubmit || !currentOrg?.id) return
    try {
      await updateOrg({
        orgId: currentOrg.id,
        org: { name: orgName.trim(), country, timezone },
      }).unwrap()
      navigation.replace("OnboardingRegistration", { persona })
    } catch {
      // Error handled by RTK
    }
  }

  return (
    <Screen
      testID="onboarding-org-info-screen"
      style={[styles.screen, { backgroundColor: colors.palette?.biancaBackground }]}
      preset="fixed"
      contentContainerStyle={styles.centeredContent}
    >
      <View style={[styles.container, styles.contentWrapper]}>
        <View style={styles.contentBlock}>
          <Text style={stylesWithColors.title} tx="onboarding.orgInfo.title" />
          <Text style={stylesWithColors.subtitle} tx="onboarding.orgInfo.subtitle" />

          <View style={styles.field}>
            <TextField
              value={orgName}
              onChangeText={setOrgName}
              labelTx="onboarding.orgInfo.orgNameLabel"
              placeholderTx="onboarding.orgInfo.orgNamePlaceholder"
              testID="onboarding-org-name"
            />
          </View>
          <View style={styles.field}>
            <CountryPicker
              value={country}
              onValueChange={setCountry}
              labelTx="onboarding.orgInfo.countryLabel"
              containerStyle={styles.pickerContainer}
            />
          </View>
          <View style={styles.field}>
            <Text style={stylesWithColors.label} tx="onboarding.orgInfo.timezoneLabel" />
            <View style={stylesWithColors.pickerWrapper}>
              <Picker
                selectedValue={timezone}
                onValueChange={setTimezone}
                style={stylesWithColors.picker}
                itemStyle={stylesWithColors.pickerItem}
                dropdownIconColor={colors.palette?.neutral700}
              >
                {TIMEZONES.map((tz) => (
                  <Picker.Item key={tz.value} label={tz.label} value={tz.value} color={colors.palette?.neutral800} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.footer}>
            <Button
              testID="onboarding-org-info-continue"
              tx="common.continue"
              preset="primary"
              onPress={handleContinue}
              disabled={!canSubmit}
              loading={isLoading}
              style={stylesWithColors.primaryButton}
            />
          </View>
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centeredContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { width: "100%", maxWidth: 440, paddingHorizontal: 24 },
  contentWrapper: { width: "100%" },
  contentBlock: { width: "100%" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  field: { marginBottom: 20 },
  pickerContainer: { marginBottom: 0 },
  footer: { marginTop: 32, paddingBottom: 24 },
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
      marginBottom: 28,
      textAlign: "center",
    },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.palette?.neutral800 ?? colors.text,
      marginBottom: 8,
    },
    pickerWrapper: {
      borderWidth: 1,
      borderColor: colors.palette?.neutral300 ?? "#e5e5e5",
      borderRadius: 8,
      backgroundColor: colors.palette?.neutral100 ?? "#fafafa",
    },
    picker: { color: colors.palette?.neutral800 ?? colors.text },
    pickerItem: { fontSize: 16 },
    primaryButton: {
      borderRadius: 20,
      paddingVertical: 14,
    },
  })
