import { useState, useEffect } from 'react'
import { Platform } from 'react-native'

interface StripeMobileComponents {
  StripeProvider: any
  StripeMobilePayment: any
  isLoaded: boolean
  error: string | null
}

/**
 * Hook to dynamically load Stripe mobile components only on mobile platforms
 * This prevents web bundling issues with @stripe/stripe-react-native
 */
export const useStripeMobile = (): StripeMobileComponents => {
  const [components, setComponents] = useState<StripeMobileComponents>({
    StripeProvider: null,
    StripeMobilePayment: null,
    isLoaded: false,
    error: null,
  })

  useEffect(() => {
    // Only load on mobile platforms
    if (Platform.OS === 'web') {
      setComponents(prev => ({ ...prev, isLoaded: true }))
      return
    }

    const loadMobileStripe = async () => {
      try {
        // Dynamic import of Stripe React Native
        const stripeReactNative = await import('@stripe/stripe-react-native')
        
        // Dynamic import of our mobile payment component
        const mobilePaymentModule = await import('../components/StripeMobilePayment')
        
        setComponents({
          StripeProvider: stripeReactNative.StripeProvider,
          StripeMobilePayment: mobilePaymentModule.default,
          isLoaded: true,
          error: null,
        })
      } catch (error) {
        console.error('Failed to load mobile Stripe components:', error)
        setComponents(prev => ({
          ...prev,
          isLoaded: true,
          error: error instanceof Error ? error.message : 'Unknown error',
        }))
      }
    }

    loadMobileStripe()
  }, [])

  return components
}







