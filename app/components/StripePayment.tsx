import React from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { Text } from 'app/components'
import { colors, spacing } from 'app/theme'
import PlatformUtils from 'app/utils/platform'
import { useGetStripeConfigQuery } from 'app/services/api/stripeApi'
import { useStripeMobile } from 'app/hooks/useStripeMobile'
import StripeWebPayment from './StripeWebPayment'

interface StripePaymentProps {
  orgId: string
  onPaymentMethodAdded?: () => void
  onError?: (error: string) => void
}

const StripePayment: React.FC<StripePaymentProps> = ({
  orgId,
  onPaymentMethodAdded,
  onError,
}) => {
  const { data: stripeConfig, isLoading, error } = useGetStripeConfigQuery()
  const { StripeProvider, StripeMobilePayment, isLoaded: mobileLoaded, error: mobileError } = useStripeMobile()


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
    // Show loading while mobile components are loading
    if (!mobileLoaded) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color={colors.palette.accent500} />
          <Text style={styles.loadingText}>Loading mobile payment system...</Text>
        </View>
      )
    }

    // Show error if mobile components failed to load
    if (mobileError || !StripeProvider || !StripeMobilePayment) {
      return (
        <View style={styles.container}>
          <Text style={styles.errorMessage}>
            Mobile payment system unavailable. Please use the web version.
            {mobileError && `\nError: ${mobileError}`}
          </Text>
        </View>
      )
    }

    // Render mobile Stripe components
    return (
      <StripeProvider publishableKey={stripeConfig.publishableKey}>
        <StripeMobilePayment
          orgId={orgId}
          onPaymentMethodAdded={onPaymentMethodAdded}
          onError={onError}
        />
      </StripeProvider>
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
