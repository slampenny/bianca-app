/**
 * Test utility to verify dynamic Stripe mobile imports work correctly
 * This can be used for debugging or testing purposes
 */

import { Platform } from 'react-native'

export const testStripeMobileImport = async () => {
  console.log('Testing Stripe mobile import...')
  console.log('Platform:', Platform.OS)
  
  if (Platform.OS === 'web') {
    console.log('Web platform detected - skipping mobile Stripe import')
    return { success: true, platform: 'web' }
  }

  try {
    console.log('Attempting to import @stripe/stripe-react-native...')
    const stripeReactNative = await import('@stripe/stripe-react-native')
    console.log('✅ Stripe React Native imported successfully')
    console.log('Available exports:', Object.keys(stripeReactNative))
    
    console.log('Attempting to import StripeMobilePayment component...')
    const mobilePaymentModule = await import('../components/StripeMobilePayment')
    console.log('✅ StripeMobilePayment component imported successfully')
    
    return { 
      success: true, 
      platform: Platform.OS,
      stripeProvider: !!stripeReactNative.StripeProvider,
      mobilePayment: !!mobilePaymentModule.default
    }
  } catch (error) {
    console.error('❌ Failed to import mobile Stripe components:', error)
    return { 
      success: false, 
      platform: Platform.OS,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
