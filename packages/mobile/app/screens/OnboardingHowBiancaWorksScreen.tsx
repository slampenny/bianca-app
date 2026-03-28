import React, { useEffect, useRef } from "react"
import { View, StyleSheet, Animated, Platform } from "react-native"
import { StackScreenProps } from "@react-navigation/stack"
import { useSelector } from "react-redux"
import { Button, Text, Screen } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { isAuthenticated } from "app/store/authSlice"
import type { OnboardingPersona } from "app/services/api/api.types"
import { OnboardingStackParamList } from "app/navigators/navigationTypes"

export type OnboardingHowBiancaWorksScreenProps = StackScreenProps<
  OnboardingStackParamList,
  "OnboardingHowBiancaWorks"
>

const PERSONA_COPY_KEYS: Record<OnboardingPersona, string> = {
  organization: "onboarding.howItWorks.organization",
  caregiver: "onboarding.howItWorks.caregiver",
  agingInPlace: "onboarding.howItWorks.agingInPlace",
}

const FADE_DURATION = 520
const STAGGER_DELAY = 120

export function OnboardingHowBiancaWorksScreen({
  navigation,
  route,
}: OnboardingHowBiancaWorksScreenProps) {
  const { persona } = route.params
  const isLoggedIn = useSelector(isAuthenticated)
  const { colors, isLoading: themeLoading } = useTheme()
  const titleOpacity = useRef(new Animated.Value(0)).current
  const bodyOpacity = useRef(new Animated.Value(0)).current
  const buttonOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const fadeIn = (anim: Animated.Value, delay: number) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: FADE_DURATION,
        delay,
        useNativeDriver: Platform.OS !== "web",
      })
    Animated.parallel([
      fadeIn(titleOpacity, 0),
      fadeIn(bodyOpacity, STAGGER_DELAY),
      fadeIn(buttonOpacity, STAGGER_DELAY * 2),
    ]).start()
  }, [titleOpacity, bodyOpacity, buttonOpacity])

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
  const copyKey = PERSONA_COPY_KEYS[persona]
  const isAgingInPlace = persona === "agingInPlace"
  const buttonLabel = isAgingInPlace ? translate("onboarding.howItWorks.getStarted") : translate("onboarding.howItWorks.next")

  const handleGetStarted = () => {
    if (persona === "organization") {
      navigation.replace("OnboardingOrgInfo", { persona })
    } else if (isLoggedIn) {
      navigation.replace("OnboardingRegistration", { persona })
    } else {
      // Pre-register flow (Login stack): go to Register with persona
      ;(navigation as any).replace("Register", { persona })
    }
  }

  return (
    <Screen
      testID="onboarding-how-it-works-screen"
      style={[styles.screen, { backgroundColor: colors.palette?.biancaBackground }]}
      preset="fixed"
      contentContainerStyle={styles.centeredContent}
    >
      <View style={[styles.container, styles.contentWrapper]}>
        <View style={styles.contentBlock}>
          <Animated.Text style={[stylesWithColors.title, { opacity: titleOpacity }]}>
            {translate("onboarding.howItWorks.title")}
          </Animated.Text>
          <Animated.Text style={[stylesWithColors.body, { opacity: bodyOpacity }]}>
            {translate(copyKey as import("../i18n").TxKeyPath)}
          </Animated.Text>
          <Animated.View style={[styles.footer, { opacity: buttonOpacity }]}>
            <Button
              testID="onboarding-how-it-works-next"
              text={buttonLabel}
              preset="primary"
              onPress={handleGetStarted}
              style={stylesWithColors.primaryButton}
            />
          </Animated.View>
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
  footer: { marginTop: 36, paddingBottom: 24 },
})

const createStyles = (colors: any) =>
  StyleSheet.create({
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.palette?.biancaHeader ?? colors.text,
      marginBottom: 18,
      textAlign: "center",
    },
    body: {
      fontSize: 18,
      lineHeight: 26,
      color: colors.palette?.neutral700 ?? colors.text,
      textAlign: "center",
    },
    primaryButton: {
      borderRadius: 20,
      paddingVertical: 14,
    },
  })
