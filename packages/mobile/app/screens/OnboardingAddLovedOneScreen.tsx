import React, { useState } from "react"
import { View, StyleSheet } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { Button, Text, TextField, PhoneInputWeb, AuthScreenLayout } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { OnboardingStackParamList } from "app/navigators/navigationTypes"
import { useCreateClientMutation } from "app/services/api/clientApi"
import { useSelector } from "react-redux"
import { getCurrentUser } from "app/store/authSlice"
import { setClient } from "app/store/clientSlice"
import { useDispatch } from "react-redux"
import { setLovedOneSetupComplete } from "app/store/authSlice"

export type OnboardingAddLovedOneScreenProps = StackScreenProps<
  OnboardingStackParamList,
  "OnboardingAddLovedOne"
>

export function OnboardingAddLovedOneScreen({ navigation }: OnboardingAddLovedOneScreenProps) {
  const { colors, isLoading: themeLoading } = useTheme()
  const currentUser = useSelector(getCurrentUser)
  const dispatch = useDispatch()
  const [createClient, { isLoading }] = useCreateClientMutation()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [relationship, setRelationship] = useState("")
  const [error, setError] = useState("")

  const styles = createStyles(colors)

  const handleContinue = async () => {
    if (!name.trim() || !phone.trim()) {
      setError(translate("onboarding.addLovedOne.requiredFields"))
      return
    }
    if (!currentUser?.org) {
      setError(translate("common.anErrorOccurred"))
      return
    }
    setError("")
    try {
      const notes = relationship.trim()
        ? translate("onboarding.addLovedOne.relationshipNote", { relationship: relationship.trim() })
        : undefined
      const created = await createClient({
        client: {
          name: name.trim(),
          email: `loved-one-${Date.now()}@family.local`,
          phone: phone.trim(),
          notes,
          preferredLanguage: "en",
        },
      }).unwrap()
      dispatch(setClient(created))
      navigation.replace("OnboardingSchedule", { clientId: created.id })
    } catch {
      setError(translate("onboarding.addLovedOne.createFailed"))
    }
  }

  const handleSkip = () => {
    dispatch(setLovedOneSetupComplete())
  }

  if (themeLoading) {
    return (
      <AuthScreenLayout testID="onboarding-add-loved-one">
        <Text>{translate("common.loading")}</Text>
      </AuthScreenLayout>
    )
  }

  return (
    <AuthScreenLayout testID="onboarding-add-loved-one">
      <Text style={styles.title} tx="onboarding.addLovedOne.title" />
      <Text style={styles.subtitle} tx="onboarding.addLovedOne.subtitle" />

      <TextField
        labelTx="onboarding.addLovedOne.nameLabel"
        placeholderTx="onboarding.addLovedOne.namePlaceholder"
        value={name}
        onChangeText={setName}
        testID="loved-one-name"
        containerStyle={styles.field}
      />
      <TextField
        labelTx="onboarding.addLovedOne.relationshipLabel"
        placeholderTx="onboarding.addLovedOne.relationshipPlaceholder"
        value={relationship}
        onChangeText={setRelationship}
        testID="loved-one-relationship"
        containerStyle={styles.field}
      />
      <PhoneInputWeb
        labelTx="onboarding.addLovedOne.phoneLabel"
        placeholderTx="onboarding.addLovedOne.phonePlaceholder"
        value={phone}
        onChangeText={setPhone}
        testID="loved-one-phone"
        containerStyle={styles.field}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        tx="common.continue"
        preset="primary"
        onPress={handleContinue}
        loading={isLoading}
        testID="loved-one-continue"
        style={styles.primaryButton}
      />
      <Button
        tx="onboarding.addLovedOne.skipForNow"
        preset="default"
        onPress={handleSkip}
        testID="loved-one-skip"
        style={styles.skipButton}
      />
    </AuthScreenLayout>
  )
}

const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.palette.biancaHeader ?? colors.text,
      textAlign: "center",
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.palette.neutral600,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 22,
    },
    field: { marginBottom: 16, width: "100%" },
    error: {
      color: colors.palette.error500 ?? "#dc2626",
      textAlign: "center",
      marginBottom: 12,
    },
    primaryButton: { marginTop: 8, width: "100%" },
    skipButton: { marginTop: 12, width: "100%" },
  })
