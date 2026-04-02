/**
 * Web typography aligned with mobile’s Space Grotesk primary stack (see app/theme/typography.ts).
 * Load "Space Grotesk" via @fontsource or a link tag in index.html.
 */
export const fontFamily = {
  primary:
    '"Space Grotesk", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
} as const

/** Rem-based scale for desktop layouts (independent of RN font registration). */
export const fontSize = {
  xs: "0.75rem",
  sm: "0.875rem",
  md: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  xxl: "1.5rem",
  xxxl: "2rem",
} as const

export const fontWeight = {
  light: 300,
  normal: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
} as const

export const lineHeight = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.625,
} as const
