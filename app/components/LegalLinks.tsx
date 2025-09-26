import React from "react"
import { View, Text, StyleSheet, Pressable } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { colors } from "app/theme/colors"
import { translate } from "../i18n"

interface LegalLinksProps {
  showPrivacyPolicy?: boolean
  showTermsOfService?: boolean
  style?: any
}

export const LegalLinks: React.FC<LegalLinksProps> = ({
  showPrivacyPolicy = true,
  showTermsOfService = true,
  style
}) => {
  const navigation = useNavigation()

  const openPrivacyPolicy = () => {
    navigation.navigate("Privacy" as never)
  }

  const openTermsOfService = () => {
    navigation.navigate("Terms" as never)
  }

  return (
    <View style={[styles.container, style]}>
      {showPrivacyPolicy && (
        <Pressable onPress={openPrivacyPolicy} style={styles.linkContainer}>
          <Text style={styles.linkText}>{translate("legalLinks.privacyPolicy")}</Text>
        </Pressable>
      )}
      {showTermsOfService && (
        <Pressable onPress={openTermsOfService} style={styles.linkContainer}>
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
  },
  linkContainer: {
    marginHorizontal: 10,
  },
  linkText: {
    color: colors.palette.primary500,
    fontSize: 14,
    textDecorationLine: "underline",
  },
}) 