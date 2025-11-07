import React from "react"
import { StyleSheet, View, ScrollView } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { spacing, typography } from "app/theme"
import { Text } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import { useLanguage } from "app/hooks/useLanguage"
import Markdown from 'react-native-markdown-display'

export const PrivacyPracticesScreen = () => {
  const navigation = useNavigation()
  const { colors, isLoading: themeLoading } = useTheme()
  
  // Use language hook to trigger re-renders on language change
  useLanguage()

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors)
  const markdownStyles = createMarkdownStyles(colors)
  
  // Get localized markdown content
  const PRIVACY_PRACTICES_MD = translate("privacyPracticesScreen.content")

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={styles.contentCard}>
          <Markdown style={markdownStyles}>{PRIVACY_PRACTICES_MD}</Markdown>
        </View>
      </ScrollView>
    </View>
  )
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
    height: '100%',
    width: '100%',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  contentCard: {
    backgroundColor: colors.palette.neutral100,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.palette.biancaBorder,
    shadowColor: colors.palette.neutral800,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    padding: spacing.lg,
  },
})

const createMarkdownStyles = (colors: any) => ({
  body: {
    color: colors.palette.neutral800,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: typography.primary.normal,
  },
  heading1: {
    color: colors.palette.biancaHeader,
    fontSize: 24,
    fontWeight: "bold",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    fontFamily: typography.primary.bold,
  },
  heading2: {
    color: colors.palette.biancaHeader,
    fontSize: 22,
    fontWeight: "bold",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    fontFamily: typography.primary.bold,
  },
  heading3: {
    color: colors.palette.biancaHeader,
    fontSize: 18,
    fontWeight: "600",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontFamily: typography.primary.medium,
  },
  paragraph: {
    marginBottom: spacing.md,
    color: colors.palette.neutral700,
  },
  list_item: {
    marginBottom: spacing.sm,
    color: colors.palette.neutral700,
  },
  strong: {
    color: colors.palette.biancaHeader,
    fontWeight: "bold",
  },
  bullet_list: {
    marginBottom: spacing.md,
  },
})












