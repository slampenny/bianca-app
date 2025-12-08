import React, { useLayoutEffect } from "react"
import { StyleSheet, View, ScrollView, Platform, useWindowDimensions } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { spacing, typography } from "app/theme"
import { Text } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import type { ThemeColors } from "../types"
import { useLanguage } from "app/hooks/useLanguage"
import Markdown from 'react-native-markdown-display'

export const PrivacyPracticesScreen = () => {
  const navigation = useNavigation()
  const { colors, isLoading: themeLoading } = useTheme()
  const { height: windowHeight } = useWindowDimensions()
  
  // Use language hook to trigger re-renders on language change
  useLanguage()

  // Update header options when theme changes
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTintColor: colors.palette.biancaHeader || colors.text,
      headerStyle: {
        backgroundColor: colors.palette.biancaBackground,
      },
      headerTitleStyle: {
        color: colors.palette.biancaHeader || colors.text,
      },
    })
  }, [navigation, colors])

  if (themeLoading) {
    return null
  }

  const styles = createStyles(colors, windowHeight)
  const markdownStyles = createMarkdownStyles(colors)
  
  // Get localized markdown content
  const PRIVACY_PRACTICES_MD = translate("privacyPracticesScreen.content")

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={true}
        bounces={false}
        alwaysBounceVertical={false}
      >
        <View style={styles.contentCard}>
          <Markdown style={markdownStyles}>{PRIVACY_PRACTICES_MD}</Markdown>
        </View>
      </ScrollView>
    </View>
  )
}

const createStyles = (colors: any, windowHeight?: number) => StyleSheet.create({
  container: {
    backgroundColor: colors.palette.biancaBackground,
    flex: 1,
    height: '100%',
    width: '100%',
    ...(Platform.OS === 'web' && {
      display: 'flex',
      flexDirection: 'column',
    } as any),
  },
  scrollView: {
    flex: 1,
    height: '100%',
    width: '100%',
    ...(Platform.OS === 'web' && {
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      height: windowHeight ? `calc(${windowHeight}px - 60px)` : 'calc(100vh - 60px)', // Account for header height
      maxHeight: windowHeight ? `calc(${windowHeight}px - 60px)` : 'calc(100vh - 60px)',
      display: 'block',
      position: 'relative',
    } as any),
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    ...(Platform.OS === 'web' && {
      flexGrow: 1,
    } as any),
  },
  contentCard: {
    backgroundColor: colors.palette.neutral100 || colors.background,
    borderRadius: spacing.sm,
    borderWidth: 1,
    borderColor: colors.palette.biancaBorder || colors.border,
    shadowColor: colors.palette.neutral800 || colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    padding: spacing.lg,
    ...(Platform.OS === 'web' && {
      width: '100%',
      flexShrink: 0,
    } as any),
  },
})

const createMarkdownStyles = (colors: ThemeColors) => ({
  body: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: typography.primary.normal,
  },
  heading1: {
    color: colors.palette.biancaHeader || colors.text,
    fontSize: 24,
    fontWeight: "bold",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    fontFamily: typography.primary.bold,
  },
  heading2: {
    color: colors.palette.biancaHeader || colors.text,
    fontSize: 22,
    fontWeight: "bold",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    fontFamily: typography.primary.bold,
  },
  heading3: {
    color: colors.palette.biancaHeader || colors.text,
    fontSize: 18,
    fontWeight: "600",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontFamily: typography.primary.medium,
  },
  paragraph: {
    marginBottom: spacing.md,
    color: colors.text,
  },
  list_item: {
    marginBottom: spacing.sm,
    color: colors.text,
  },
  strong: {
    color: colors.palette.biancaHeader || colors.text,
    fontWeight: "bold",
  },
  bullet_list: {
    marginBottom: spacing.md,
  },
  text: {
    color: colors.text,
  },
})












