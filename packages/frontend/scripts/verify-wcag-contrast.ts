/**
 * WCAG Contrast Ratio Verification Script
 * 
 * This script verifies that all text/background color combinations
 * in all themes meet WCAG 2.1 AA (4.5:1) or AAA (7:1) standards.
 */

// Convert hex to RGB
function hexToRgb(hex: string): [number, number, number] | null {
  // Remove # if present
  hex = hex.replace('#', '')
  
  // Handle rgba strings
  if (hex.startsWith('rgba')) {
    const match = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (match) {
      return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
    }
    return null
  }
  
  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('')
  }
  
  if (hex.length !== 6) return null
  
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  
  return [r, g, b]
}

// Calculate relative luminance
function getLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map(val => {
    val = val / 255
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Calculate contrast ratio
function getContrastRatio(color1: string, color2: string): number | null {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)
  
  if (!rgb1 || !rgb2) return null
  
  const lum1 = getLuminance(rgb1)
  const lum2 = getLuminance(rgb2)
  
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  
  return (lighter + 0.05) / (darker + 0.05)
}

// Check if contrast meets WCAG standards
function meetsWCAG(ratio: number, level: 'AA' | 'AAA', size: 'normal' | 'large' = 'normal'): boolean {
  if (level === 'AAA') {
    return size === 'large' ? ratio >= 4.5 : ratio >= 7.0
  } else {
    return size === 'large' ? ratio >= 3.0 : ratio >= 4.5
  }
}

// Common text/background combinations to check
const combinations = [
  // Primary text combinations
  { text: 'text', bg: 'background', name: 'Primary text on background' },
  { text: 'text', bg: 'biancaBackground', name: 'Primary text on Bianca background' },
  { text: 'textDim', bg: 'background', name: 'Dim text on background' },
  { text: 'biancaHeader', bg: 'biancaBackground', name: 'Bianca header on background' },
  { text: 'biancaExplanation', bg: 'biancaBackground', name: 'Bianca explanation on background' },
  
  // Button combinations
  { text: 'textInverse', bg: 'primary500', name: 'Inverse text on primary button' },
  { text: 'textInverse', bg: 'success500', name: 'Inverse text on success button' },
  { text: 'textInverse', bg: 'error500', name: 'Inverse text on error button' },
  { text: 'textInverse', bg: 'warning500', name: 'Inverse text on warning button' },
  { text: 'textInverse', bg: 'medical500', name: 'Inverse text on medical button' },
  { text: 'text', bg: 'biancaButtonUnselected', name: 'Text on unselected button' },
  
  // Error/Success states
  { text: 'error', bg: 'errorBackground', name: 'Error text on error background' },
  { text: 'success', bg: 'successBackground', name: 'Success text on success background' },
  { text: 'biancaError', bg: 'biancaErrorBackground', name: 'Bianca error on error background' },
  { text: 'biancaSuccess', bg: 'biancaSuccessBackground', name: 'Bianca success on success background' },
]

interface ContrastIssue {
  theme: string
  combination: string
  textColor: string
  bgColor: string
  ratio: number
  meetsAA: boolean
  meetsAAA: boolean
  level: 'AA' | 'AAA' | 'FAIL'
}

function verifyTheme(themeName: string, colors: any): ContrastIssue[] {
  const issues: ContrastIssue[] = []
  
  for (const combo of combinations) {
    const textColor = colors[combo.text] || colors.palette?.[combo.text]
    const bgColor = colors[combo.bg] || colors.palette?.[combo.bg]
    
    if (!textColor || !bgColor) {
      // Skip if color not found (some themes may not have all colors)
      continue
    }
    
    const ratio = getContrastRatio(textColor, bgColor)
    
    if (!ratio) {
      console.warn(`Could not calculate contrast for ${themeName}: ${combo.name}`)
      continue
    }
    
    const meetsAA = meetsWCAG(ratio, 'AA')
    const meetsAAA = meetsWCAG(ratio, 'AAA')
    
    if (!meetsAA) {
      issues.push({
        theme: themeName,
        combination: combo.name,
        textColor,
        bgColor,
        ratio: Math.round(ratio * 100) / 100,
        meetsAA: false,
        meetsAAA: false,
        level: 'FAIL'
      })
    } else if (!meetsAAA) {
      issues.push({
        theme: themeName,
        combination: combo.name,
        textColor,
        bgColor,
        ratio: Math.round(ratio * 100) / 100,
        meetsAA: true,
        meetsAAA: false,
        level: 'AA'
      })
    }
  }
  
  return issues
}

// Import all theme colors
import { colors as healthcareColors } from '../app/theme/colors'
import { colors as colorblindColors } from '../app/theme/colors.colorblind'
import { colors as darkColors } from '../app/theme/colors.dark'
import { colors as highContrastColors } from '../app/theme/colors.highcontrast'

// Run verification
console.log('🔍 Verifying WCAG Contrast Ratios...\n')

const themes = [
  { name: 'Healthcare', colors: healthcareColors },
  { name: 'Colorblind', colors: colorblindColors },
  { name: 'Dark', colors: darkColors },
  { name: 'High Contrast', colors: highContrastColors },
]

const allIssues: ContrastIssue[] = []

for (const theme of themes) {
  const issues = verifyTheme(theme.name, theme.colors)
  allIssues.push(...issues)
  
  if (issues.length === 0) {
    console.log(`✅ ${theme.name}: All combinations meet WCAG AAA (7:1)`)
  } else {
    const fails = issues.filter(i => i.level === 'FAIL')
    const aaOnly = issues.filter(i => i.level === 'AA')
    
    if (fails.length > 0) {
      console.log(`❌ ${theme.name}: ${fails.length} combinations FAIL WCAG AA (need 4.5:1)`)
    }
    if (aaOnly.length > 0) {
      console.log(`⚠️  ${theme.name}: ${aaOnly.length} combinations meet AA but not AAA (need 7:1)`)
    }
  }
}

console.log('\n📊 Detailed Results:\n')

if (allIssues.length === 0) {
  console.log('✅ All themes meet WCAG AAA standards!')
} else {
  // Group by theme
  const byTheme = allIssues.reduce((acc, issue) => {
    if (!acc[issue.theme]) acc[issue.theme] = []
    acc[issue.theme].push(issue)
    return acc
  }, {} as Record<string, ContrastIssue[]>)
  
  for (const [theme, issues] of Object.entries(byTheme)) {
    console.log(`\n${theme} Theme:`)
    for (const issue of issues) {
      const status = issue.level === 'FAIL' ? '❌' : '⚠️'
      console.log(`  ${status} ${issue.combination}`)
      console.log(`     Text: ${issue.textColor} on ${issue.bgColor}`)
      console.log(`     Ratio: ${issue.ratio}:1 (${issue.meetsAA ? 'AA ✓' : 'AA ✗'}, ${issue.meetsAAA ? 'AAA ✓' : 'AAA ✗'})`)
    }
  }
}

// Export for use in other scripts
export { getContrastRatio, meetsWCAG, verifyTheme }

