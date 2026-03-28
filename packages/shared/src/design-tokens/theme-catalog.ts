import { colors as healthcareColors } from "./colors"
import { colors as colorblindColors } from "./colors.colorblind"
import { colors as darkColors } from "./colors.dark"
import { colors as highContrastColors } from "./colors.highcontrast"
import type { Theme, ThemeType } from "./theme-types"

export const defaultThemeType: ThemeType = "healthcare"

export const themes: Record<ThemeType, Theme> = {
  healthcare: {
    name: "Healthcare",
    description: "Professional medical theme with blue and green colors",
    colors: healthcareColors as Theme["colors"],
    accessibility: {
      wcagLevel: "AA",
      colorblindFriendly: false,
      highContrast: false,
      darkMode: false,
      description: "Standard healthcare theme with medical blue and green colors",
    },
  },
  colorblind: {
    name: "Color-Blind Friendly",
    description: "High contrast theme optimized for color vision deficiency",
    colors: colorblindColors as Theme["colors"],
    accessibility: {
      wcagLevel: "AAA",
      colorblindFriendly: true,
      highContrast: true,
      darkMode: false,
      description:
        "High contrast theme with distinct colors and patterns for users with color vision deficiency",
    },
  },
  dark: {
    name: "Dark Mode",
    description: "Dark theme optimized for low-light environments",
    colors: darkColors as Theme["colors"],
    accessibility: {
      wcagLevel: "AA",
      colorblindFriendly: false,
      highContrast: true,
      darkMode: true,
      description: "Dark theme with bright colors for comfortable viewing in low-light conditions",
    },
  },
  highcontrast: {
    name: "High Contrast",
    description: "Maximum contrast theme for vision impairment (WCAG AAA)",
    colors: highContrastColors as Theme["colors"],
    accessibility: {
      wcagLevel: "AAA",
      colorblindFriendly: true,
      highContrast: true,
      darkMode: false,
      description: "Maximum contrast (7:1+) with pure black and white for users with vision impairment",
    },
  },
}
