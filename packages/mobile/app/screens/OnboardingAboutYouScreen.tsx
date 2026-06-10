import React, { useState, useEffect } from "react"
import { View, StyleSheet, Pressable, Animated, Platform } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { Button, Text, AuthScreenLayout } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import type { OnboardingPersona } from "app/services/api/api.types"
import { OnboardingStackParamList } from "app/navigators/navigationTypes"

export type OnboardingAboutYouScreenProps = StackScreenProps<
  OnboardingStackParamList,
  "OnboardingAboutYou"
>

export function OnboardingAboutYouScreen({ navigation }: OnboardingAboutYouScreenProps) {
  const { colors, isLoading: themeLoading } = useTheme()
  const [persona, setPersona] = useState<OnboardingPersona | null>(null)
  const fadeAnim = React.useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: Platform.OS !== "web",
    }).start()
  }, [fadeAnim])

  if (themeLoading) {
    return (
      <AuthScreenLayout testID="onboarding-about-you-screen">
        <Text>{translate("common.loading")}</Text>
      </AuthScreenLayout>
    )
  }

  const stylesWithColors = createStyles(colors)

  const handleContinue = () => {
    if (!persona) return
    navigation.replace("OnboardingHowBiancaWorks", { persona })
  }

  const options: { value: OnboardingPersona; labelKey: string; testID: string }[] = [
    { value: "caregiver", labelKey: "onboarding.aboutYou.caregiver", testID: "onboarding-persona-caregiver" },
    { value: "agingInPlace", labelKey: "onboarding.aboutYou.agingInPlace", testID: "onboarding-persona-agingInPlace" },
  ]

  return (
    <AuthScreenLayout testID="onboarding-about-you-screen" accessibilityLabel="onboarding-about-you-screen">
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <Text style={stylesWithColors.title} tx="onboarding.aboutYou.title" />
        <Text style={stylesWithColors.subtitle} tx="onboarding.aboutYou.subtitle" />

        <View style={styles.options}>
          {options.map((opt) => (
            <Pressable
              key={opt.value}
              testID={opt.testID}
              style={[
                stylesWithColors.option,
                persona === opt.value && stylesWithColors.optionSelected,
              ]}
              onPress={() => setPersona(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: persona === opt.value }}
              accessibilityLabel={translate(opt.labelKey as import("../i18n").TxKeyPath)}
            >
              <Text
                style={[
                  stylesWithColors.optionText,
                  persona === opt.value && stylesWithColors.optionTextSelected,
                ]}
              >
                {translate(opt.labelKey as import("../i18n").TxKeyPath)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Button
          testID="onboarding-about-you-continue"
          tx="common.continue"
          preset="primary"
          onPress={handleContinue}
          disabled={!persona}
          style={stylesWithColors.primaryButton}
        />
      </Animated.View>
    </AuthScreenLayout>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  screenContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { width: "100%", maxWidth: 440, paddingHorizontal: 24 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  contentBlock: { width: "100%" },
  options: { gap: 14, marginTop: 28 },
  footer: { marginTop: 36, paddingBottom: 24 },
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
      opacity: 0.9,
      textAlign: "center",
    },
    option: {
      paddingVertical: 18,
      paddingHorizontal: 22,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.palette.neutral300,
      backgroundColor: colors.palette.neutral100,
    },
    optionSelected: {
      borderColor: colors.palette?.primary500 ?? "#0f766e",
      backgroundColor: colors.palette?.primary100 ?? "#f0fdfa",
    },
    optionText: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.palette?.neutral800 ?? colors.text,
    },
    optionTextSelected: {
      color: colors.palette?.primary700 ?? "#0f766e",
    },
    primaryButton: {
      marginTop: 28,
    },
  })
