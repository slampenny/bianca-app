import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import { colors } from 'app/theme';

// Define custom navigation themes using detailed color palette
export const navigationThemes = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.tint, // Main tinting color
      background: colors.background, // Default screen background color
      card: colors.palette.neutral100, // Background for card-like elements
      text: colors.text, // Default text color
      border: colors.border // Default border color
    }
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.palette.primary600, // Darker primary color for better contrast in dark mode
      background: colors.palette.neutral800, // Dark background for dark theme
      card: colors.palette.neutral900, // Dark card background
      text: colors.palette.neutral100, // Light text color for readability in dark mode
      border: colors.palette.neutral600 // Slightly lighter border for contrast
    }
  }
};

export const screenOptions = {
  headerShown: false
};
