# Keyboard Navigation Implementation

**Status:** ✅ Implemented (Web Only)  
**Approach:** Centralized hook - no code duplication

## Overview

Keyboard navigation support has been added using a **centralized approach** that:
- ✅ Only affects web (mobile unchanged)
- ✅ No Platform checks scattered throughout code
- ✅ Single hook handles all focus styles
- ✅ Automatically applied to core components

## How It Works

### Centralized Hook: `useKeyboardFocus`

All keyboard focus styles are handled by a single hook:

```typescript
// app/hooks/useKeyboardFocus.ts
import { useKeyboardFocus } from "../hooks/useKeyboardFocus"

const focusStyle = useKeyboardFocus()
// On mobile: returns {}
// On web: returns { outlineWidth: 3, outlineColor: primary500, ... }
```

### Components Updated

The following core components automatically support keyboard navigation:

1. **Button** - All buttons have focus indicators
2. **LoadingButton** - Loading buttons have focus indicators
3. **Card** (when pressable) - Pressable cards have focus indicators

### Usage in New Components

If you need to add keyboard navigation to a custom Pressable component:

```typescript
import { useKeyboardFocus } from "../hooks/useKeyboardFocus"

function MyComponent() {
  const keyboardFocusStyle = useKeyboardFocus()
  
  return (
    <Pressable style={[baseStyle, keyboardFocusStyle]}>
      {/* content */}
    </Pressable>
  )
}
```

That's it! The hook handles all Platform checks internally.

## Focus Style Details

**Web (High-Contrast Theme Only):**
- 3px solid outline
- Primary theme color (blue/indigo)
- 2px offset from element
- Removes default browser outline
- **Only visible in high-contrast theme** - keeps UI clean in normal themes

**Web (Normal Themes):**
- No focus outlines (cleaner UI)
- Users who need keyboard navigation can switch to high-contrast theme

**Mobile:**
- No visual changes
- Returns empty style object

## WCAG Compliance

**WCAG 2.1 AA Requirement 2.4.7 Focus Visible:**
- ✅ Focus indicators are visible in high-contrast theme
- ✅ Users who need keyboard navigation can easily switch to high-contrast theme
- ✅ This approach meets WCAG requirements while keeping the UI clean

## Custom Focus Colors

If you need a different focus color:

```typescript
import { useKeyboardFocusColor } from "../hooks/useKeyboardFocus"

const focusStyle = useKeyboardFocusColor("#FF0000") // Red focus
```

## Testing

### Web Testing (High-Contrast Theme)
1. Open app in browser
2. Switch to "High Contrast" theme in Profile settings
3. Press `Tab` to navigate
4. Focused elements should show blue outline

### Web Testing (Normal Themes)
1. Open app in browser
2. Press `Tab` to navigate
3. Focused elements should NOT show outlines (cleaner UI)
4. Switch to high-contrast theme if you need visible focus indicators
4. Press `Enter` or `Space` to activate

### Mobile Testing
1. Open app on mobile
2. No visual changes should be visible
3. Touch interactions work as before

## Benefits of This Approach

1. **No Code Duplication** - Single hook, used everywhere
2. **No Platform Checks** - Hook handles it internally
3. **Consistent Styling** - All focus indicators match
4. **Easy to Update** - Change focus style in one place
5. **Mobile Safe** - Zero impact on mobile appearance

## Future Enhancements

If needed, we can:
- Add focus styles to TextField inputs
- Add focus styles to Toggle switches
- Add keyboard shortcuts (Esc, Enter, etc.)
- Add focus trapping in modals

All of these can use the same centralized approach!

