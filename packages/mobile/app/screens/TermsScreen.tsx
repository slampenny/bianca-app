import React, { useLayoutEffect } from "react"
import { StyleSheet, View, ScrollView, TouchableWithoutFeedback, Platform } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { spacing, typography } from "app/theme"
import { Text } from "app/components"
import { useTheme } from "app/theme/ThemeContext"
import { translate } from "app/i18n"
import type { ThemeColors } from "../types"
import Markdown from 'react-native-markdown-display'
import { TERMS } from '@bianca/legal'


export const TermsScreen = () => {
  const navigation = useNavigation()
  const { colors, isLoading: themeLoading } = useTheme()

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

  const styles = createStyles(colors)
  const markdownStyles = createMarkdownStyles(colors)

  return (
    <View style={styles.container}>
      <ScrollView 
        style={Platform.OS === 'web' ? [styles.scrollView, { 
          height: '100vh',
          maxHeight: '100vh',
        }] : styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={true}
        bounces={false}
        alwaysBounceVertical={false}
      >
        <View style={styles.contentCard}>
          <Markdown style={markdownStyles as React.ComponentProps<typeof Markdown>["style"]}>{TERMS}</Markdown>
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
    ...(Platform.OS === 'web' && {
      height: '100vh',
      maxHeight: '100vh',
      position: 'relative',
    } as any),
  },
  scrollView: {
    flex: 1,
    height: '100%',
    width: '100%',
    ...(Platform.OS === 'web' && {
      height: '100%',
      maxHeight: '100%',
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      position: 'relative',
    } as any),
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.palette.biancaHeader,
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