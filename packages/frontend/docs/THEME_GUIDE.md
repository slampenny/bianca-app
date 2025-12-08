# MyPhoneFriend Theme Guide

## Overview

MyPhoneFriend uses a healthcare-focused design system built on top of Ignite CLI's theme architecture. The theme is designed specifically for medical professionals, caregivers, and healthcare environments, emphasizing clarity, accessibility, and professional aesthetics.

## Theme Structure

The theme system is organized into four main categories:

- **Colors** - Healthcare-focused color palette
- **Typography** - Professional fonts optimized for readability
- **Spacing** - Consistent spacing system
- **Timing** - Animation and transition timing

## Color Palette

### Primary Colors (Medical Blue)
The primary color scheme uses medical blue tones that convey trust, professionalism, and healthcare expertise:

- `primary100` - `#E0F2FE` - Very light blue for backgrounds
- `primary200` - `#BAE6FD` - Light blue for hover states
- `primary300` - `#7DD3FC` - Medium light blue
- `primary400` - `#38BDF8` - Medium blue
- `primary500` - `#0EA5E9` - **Primary blue (main brand color)**
- `primary600` - `#0284C7` - Darker blue for pressed states
- `primary700` - `#0369A1` - Dark blue for emphasis
- `primary800` - `#075985` - Very dark blue
- `primary900` - `#0C4A6E` - Darkest blue

### Secondary Colors (Healthcare Green)
Green tones represent health, success, and positive medical outcomes:

- `secondary100` - `#DCFCE7` - Very light green for success backgrounds
- `secondary200` - `#BBF7D0` - Light green
- `secondary300` - `#86EFAC` - Medium light green
- `secondary400` - `#4ADE80` - Medium green
- `secondary500` - `#22C55E` - **Primary green (success, healthy states)**
- `secondary600` - `#16A34A` - Darker green
- `secondary700` - `#15803D` - Dark green
- `secondary800` - `#166534` - Very dark green
- `secondary900` - `#14532D` - Darkest green

### Status Colors
Comprehensive status color system for medical applications:

#### Success Colors
- `success100` - `#D1FAE5` - Success backgrounds
- `success500` - `#10B981` - **Primary success color**

#### Warning Colors
- `warning100` - `#FEF3C7` - Warning backgrounds
- `warning500` - `#F59E0B` - **Primary warning color**

#### Error Colors
- `error100` - `#FEE2E2` - Error backgrounds
- `error500` - `#EF4444` - **Primary error color**

#### Info Colors
- `info100` - `#DBEAFE` - Info backgrounds
- `info500` - `#3B82F6` - **Primary info color**

### Medical-Specific Colors
Specialized colors for healthcare-specific elements:

- `medical100` - `#F0F9FF` - Medical backgrounds
- `medical500` - `#38BDF8` - **Primary medical color**

### Neutral Colors
Professional grays for text, borders, and backgrounds:

- `neutral100` - `#FFFFFF` - Pure white
- `neutral200` - `#F8FAFC` - Very light gray (default background)
- `neutral300` - `#E2E8F0` - Light gray (borders, separators)
- `neutral400` - `#94A3B8` - Medium gray (secondary text)
- `neutral500` - `#64748B` - Darker gray (muted text)
- `neutral600` - `#475569` - Dark gray (body text)
- `neutral700` - `#334155` - Very dark gray (headings)
- `neutral800` - `#1E293B` - Almost black (primary text)
- `neutral900` - `#0F172A` - Pure black (high contrast)

## Semantic Color Usage

### Text Colors
- `colors.text` - Primary text color (`neutral800`)
- `colors.textDim` - Secondary text color (`neutral500`)

### Background Colors
- `colors.background` - Default screen background (`neutral200`)
- `colors.errorBackground` - Error state backgrounds (`error100`)
- `colors.successBackground` - Success state backgrounds (`success100`)
- `colors.warningBackground` - Warning state backgrounds (`warning100`)
- `colors.infoBackground` - Info state backgrounds (`info100`)
- `colors.medicalBackground` - Medical-specific backgrounds (`medical100`)

### Interactive Colors
- `colors.tint` - Main brand color (`primary500`)
- `colors.border` - Default border color (`neutral300`)
- `colors.separator` - Line and separator color (`neutral300`)

## Button Presets

The Button component includes healthcare-specific presets:

- `default` - Standard button with border
- `filled` - Filled neutral button
- `reversed` - Dark button with light text
- `primary` - Primary medical blue button
- `success` - Success green button
- `danger` - Error red button
- `warning` - Warning orange button
- `medical` - Medical-specific blue button

## Typography

The app uses Space Grotesk as the primary font family, providing excellent readability for medical professionals:

- `typography.primary.light` - Light weight
- `typography.primary.normal` - Regular weight
- `typography.primary.medium` - Medium weight
- `typography.primary.semiBold` - Semi-bold weight
- `typography.primary.bold` - Bold weight

### Text Presets
- `default` - Standard body text
- `bold` - Bold text
- `heading` - Large heading text
- `subheading` - Medium heading text
- `formLabel` - Form field labels
- `formHelper` - Form helper text

## Spacing System

Consistent spacing scale for margins, padding, and layout:

- `spacing.xxxs` - 2px
- `spacing.xxs` - 4px
- `spacing.xs` - 8px
- `spacing.sm` - 12px
- `spacing.md` - 16px
- `spacing.lg` - 24px
- `spacing.xl` - 32px
- `spacing.xxl` - 48px
- `spacing.xxxl` - 64px

## Usage Guidelines

### Do's
- ✅ Use semantic color names (`colors.text`, `colors.background`) instead of palette colors
- ✅ Use the spacing system for consistent layouts
- ✅ Use button presets for consistent interactive elements
- ✅ Use text presets for consistent typography
- ✅ Use medical-specific colors for healthcare features

### Don'ts
- ❌ Don't use hardcoded hex colors
- ❌ Don't use arbitrary spacing values
- ❌ Don't mix different color systems
- ❌ Don't use colors that don't meet accessibility standards

## Accessibility

All colors in the theme meet WCAG AA accessibility standards:

- Text contrast ratios are at least 4.5:1
- Interactive elements have sufficient contrast
- Color is not the only way to convey information
- Status colors are supplemented with icons and text

## Healthcare-Specific Considerations

### Medical Context
- Blue tones convey trust and professionalism
- Green indicates health and positive outcomes
- Red is reserved for critical alerts and errors
- Orange/yellow is used for warnings and calls

### Professional Environment
- Clean, minimal design reduces cognitive load
- High contrast improves readability in clinical settings
- Consistent spacing creates visual hierarchy
- Professional typography enhances credibility

## Migration from Legacy Colors

The theme maintains backward compatibility with legacy Bianca colors:

- `biancaBackground` → `neutral200`
- `biancaHeader` → `neutral800`
- `biancaButtonSelected` → `primary500`
- `biancaButtonUnselected` → `neutral300`
- `biancaError` → `error500`
- `biancaSuccess` → `success500`

## Examples

### Using Semantic Colors
```typescript
import { colors } from "app/theme"

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderColor: colors.border,
  },
  text: {
    color: colors.text,
  },
  errorText: {
    color: colors.error,
    backgroundColor: colors.errorBackground,
  },
})
```

### Using Button Presets
```typescript
import { Button } from "app/components"

<Button preset="primary" text="Save Patient" />
<Button preset="success" text="Mark Complete" />
<Button preset="danger" text="Delete Record" />
<Button preset="medical" text="Schedule Call" />
```

### Using Spacing
```typescript
import { spacing } from "app/theme"

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
})
```

## Future Enhancements

- Dark mode support
- High contrast mode for accessibility
- Customizable color schemes for different healthcare organizations
- Additional medical-specific color variants
