import React, { useEffect } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { Text } from 'app/components'
import { colors, spacing } from 'app/theme'

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
  const opacity = React.useRef(new Animated.Value(0)).current

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

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.lg,
    right: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    zIndex: 1000,
  },
  message: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
})

export default Toast
