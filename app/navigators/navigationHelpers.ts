import { translate } from '../i18n'
import { ThemeColors } from '../types'

/**
 * Create theme-aware header options for navigation screens
 * Reduces duplication in AppNavigators.tsx
 */
export const createThemeAwareHeaderOptions = (
  titleKey: string,
  colors: ThemeColors
) => () => ({
  headerShown: true,
  headerBackTitleVisible: false,
  headerTintColor: colors.palette.biancaHeader || colors.text,
  headerStyle: {
    backgroundColor: colors.palette.biancaBackground,
  },
  headerTitleStyle: {
    color: colors.palette.biancaHeader || colors.text,
  },
  title: translate(titleKey),
})

