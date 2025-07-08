import React from "react"
import { View, Text, StyleSheet, Pressable, Linking } from "react-native"
import { colors } from "app/theme/colors"

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
  const openPrivacyPolicy = () => {
    Linking.openURL("https://app.myphonefriend.com/privacy")
  }

  const openTermsOfService = () => {
    Linking.openURL("https://app.myphonefriend.com/terms")
  }

  return (
    <View style={[styles.container, style]}>
      {showPrivacyPolicy && (
        <Pressable onPress={openPrivacyPolicy} style={styles.linkContainer}>
          <Text style={styles.linkText}>Privacy Policy</Text>
        </Pressable>
      )}
      {showTermsOfService && (
        <Pressable onPress={openTermsOfService} style={styles.linkContainer}>
          <Text style={styles.linkText}>Terms of Service</Text>
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
    color: colors.primary,
    fontSize: 14,
    textDecorationLine: "underline",
  },
}) 