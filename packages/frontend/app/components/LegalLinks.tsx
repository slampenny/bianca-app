import React from "react"
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { colors } from "app/theme/colors"
import { translate } from "../i18n"

interface LegalLinksProps {
  showPrivacyPolicy?: boolean
  showTermsOfService?: boolean
  showPrivacyPractices?: boolean
  style?: any
}

export const LegalLinks: React.FC<LegalLinksProps> = ({
  showPrivacyPolicy = true,
  showTermsOfService = true,
  showPrivacyPractices = true,
  style
}) => {
  const navigation = useNavigation()
  const { width } = useWindowDimensions()
  const isSmallScreen = width < 400

  const openPrivacyPolicy = () => {
    navigation.navigate("Privacy" as never)
  }

  const openTermsOfService = () => {
    navigation.navigate("Terms" as never)
  }

  const openPrivacyPractices = () => {
    navigation.navigate("PrivacyPractices" as never)
  }

  return (
    <View style={[styles.container, isSmallScreen && styles.containerSmall, style]}>
      {showPrivacyPolicy && (
        <Pressable onPress={openPrivacyPolicy} style={[styles.linkContainer, isSmallScreen && styles.linkContainerSmall]}>
          <Text style={styles.linkText}>{translate("legalLinks.privacyPolicy")}</Text>
        </Pressable>
      )}
      {showPrivacyPractices && (
        <Pressable onPress={openPrivacyPractices} style={[styles.linkContainer, isSmallScreen && styles.linkContainerSmall]}>
          <Text style={styles.linkText}>{translate("legalLinks.privacyPractices")}</Text>
        </Pressable>
      )}
      {showTermsOfService && (
        <Pressable onPress={openTermsOfService} style={[styles.linkContainer, isSmallScreen && styles.linkContainerSmall]}>
          <Text style={styles.linkText}>{translate("legalLinks.termsOfService")}</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    flexWrap: "wrap",
  },
  containerSmall: {
    flexDirection: "column",
  },
  linkContainer: {
    marginHorizontal: 10,
  },
  linkContainerSmall: {
    marginHorizontal: 0,
    marginBottom: 8,
  },
  linkText: {
    color: colors.palette.primary500,
    fontSize: 14,
    textDecorationLine: "underline",
  },
}) 