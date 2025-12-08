import React, { useEffect } from 'react'
import { View, StyleSheet, Animated, Platform } from 'react-native'
import { Text } from 'app/components/Text'
import { useTheme } from 'app/theme/ThemeContext'
import { spacing } from 'app/theme'

interface ToastProps {
  visible: boolean
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
  onHide: () => void
  testID?: string
}

const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onHide,
  testID = 'toast',
}) => {
  const { colors } = useTheme()
  const opacity = React.useRef(new Animated.Value(0)).current
  
  const createStyles = (colors: any) => StyleSheet.create({
    container: {
      position: 'absolute',
      top: 60,
      left: spacing.lg,
      right: spacing.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 8,
      zIndex: 99999, // Very high z-index to ensure it appears above all UI elements
      elevation: 9999, // Android elevation
      // Ensure it's above all other elements
      ...(Platform.OS === 'web' && {
        position: 'fixed' as any, // Use fixed positioning on web for better layering
      }),
    },
    message: {
      color: colors.palette.neutral100,
      fontSize: 14,
      fontWeight: '500',
      textAlign: 'center',
    },
  })
  
  const styles = createStyles(colors)

  useEffect(() => {
    if (visible) {
      // Show toast
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start()

      // Hide toast after duration
      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onHide()
        })
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [visible, duration, opacity, onHide])

  if (!visible) return null

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return colors.palette.success500
      case 'error':
        return colors.palette.angry500
      case 'info':
      default:
        return colors.palette.neutral600
    }
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor(), opacity },
      ]}
      testID={testID}
    >
      <Text style={styles.message} testID={`${testID}-message`}>
        {message}
      </Text>
    </Animated.View>
  )
}

export default Toast







