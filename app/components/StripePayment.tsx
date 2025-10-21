import React from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { Text } from 'app/components'
import { colors, spacing } from 'app/theme'
import PlatformUtils from 'app/utils/platform'
import { useGetStripeConfigQuery } from 'app/services/api/stripeApi'
import StripeWebPayment from './StripeWebPayment'

interface StripePaymentProps {
  orgId: string
  onPaymentMethodAdded?: () => void
  onError?: (error: string) => void
}

// Mobile-specific component that will only be loaded on mobile
const StripeMobileWrapper: React.FC<StripePaymentProps & { publishableKey: string }> = ({
  orgId,
  publishableKey,
  onPaymentMethodAdded,
  onError,
}) => {
  const [mobileComponents, setMobileComponents] = React.useState({
    StripeProvider: null,
    StripeMobilePayment: null,
    isLoaded: false,
    error: null,
  })

  React.useEffect(() => {
    const loadMobileComponents = async () => {
      try {
        // Dynamic import of Stripe React Native
        const stripeReactNative = await import('@stripe/stripe-react-native')
        
        // Dynamic import of our mobile payment component
        const mobilePaymentModule = await import('./StripeMobilePayment')
        
        setMobileComponents({
          StripeProvider: stripeReactNative.StripeProvider,
          StripeMobilePayment: mobilePaymentModule.default,
          isLoaded: true,
          error: null,
        })
      } catch (error) {
        console.error('Failed to load mobile Stripe components:', error)
        setMobileComponents(prev => ({
          ...prev,
          isLoaded: true,
          error: error instanceof Error ? error.message : 'Unknown error',
        }))
      }
    }

    loadMobileComponents()
  }, [])

  const { StripeProvider, StripeMobilePayment, isLoaded, error } = mobileComponents

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.palette.accent500} />
        <Text style={styles.loadingText}>Loading mobile payment system...</Text>
      </View>
    )
  }

  if (error || !StripeProvider || !StripeMobilePayment) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorMessage}>
          Mobile payment system unavailable. Please use the web version.
          {error && `\nError: ${error}`}
        </Text>
      </View>
    )
  }

  return (
    <StripeProvider publishableKey={publishableKey}>
      <StripeMobilePayment
        orgId={orgId}
        onPaymentMethodAdded={onPaymentMethodAdded}
        onError={onError}
      />
    </StripeProvider>
  )
}

const StripePayment: React.FC<StripePaymentProps> = ({
  orgId,
  onPaymentMethodAdded,
  onError,
}) => {
  const { data: stripeConfig, isLoading, error } = useGetStripeConfigQuery()


  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.palette.accent500} />
        <Text style={styles.loadingText}>Loading payment system...</Text>
      </View>
    )
  }

  // Show error state
  if (error || !stripeConfig?.publishableKey) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorMessage}>
          Stripe configuration error. Please contact support.
        </Text>
      </View>
    )
  }

  // Render web version for web platform
  if (PlatformUtils.isWeb()) {
    return (
      <StripeWebPayment
        orgId={orgId}
        publishableKey={stripeConfig.publishableKey}
        onPaymentMethodAdded={onPaymentMethodAdded}
        onError={onError}
      />
    )
  }

  // Render mobile version for mobile platforms (iOS/Android)
  if (PlatformUtils.isMobile()) {
    return (
      <StripeMobileWrapper
        orgId={orgId}
        publishableKey={stripeConfig.publishableKey}
        onPaymentMethodAdded={onPaymentMethodAdded}
        onError={onError}
      />
    )
  }

  // Fallback for unknown platforms
  return (
    <View style={styles.container}>
      <Text style={styles.errorMessage}>
        Unsupported platform. Please use a web browser or mobile app.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text,
    textAlign: 'center',
  },
  errorMessage: {
    color: colors.palette.angry500,
    textAlign: 'center',
    fontSize: 16,
  },
})

export default StripePayment
