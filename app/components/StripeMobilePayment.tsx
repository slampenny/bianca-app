import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { Text, Button, Card, ListItem } from 'app/components'
import { colors, spacing } from 'app/theme'
import { useGetPaymentMethodsQuery, useSetDefaultPaymentMethodMutation, useDetachPaymentMethodMutation, useCreateSetupIntentMutation } from 'app/services/api/paymentMethodApi'
import { translate } from 'app/i18n'

interface PaymentMethod {
  id: string
  type: string
  brand?: string
  last4?: string
  expMonth?: number
  expYear?: number
  isDefault: boolean
  billingDetails?: {
    name?: string
    email?: string
    phone?: string
  }
}

interface StripeMobilePaymentProps {
  orgId: string
  onPaymentMethodAdded?: () => void
  onError?: (error: string) => void
}

const StripeMobilePayment: React.FC<StripeMobilePaymentProps> = ({
  orgId,
  onPaymentMethodAdded,
  onError,
}) => {
  const [stripeHook, setStripeHook] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [stripeLoading, setStripeLoading] = useState(true)

  // Dynamically load the Stripe hook
  useEffect(() => {
    const loadStripe = async () => {
      try {
        const stripeModule = await import('@stripe/stripe-react-native')
        setStripeHook(stripeModule.useStripe())
        setStripeLoading(false)
      } catch (error) {
        console.error('Failed to load Stripe hook:', error)
        setStripeLoading(false)
        onError?.('Failed to load payment system')
      }
    }
    loadStripe()
  }, [onError])

  const { initPaymentSheet, presentPaymentSheet } = stripeHook || {}
  const [message, setMessage] = useState('')
  const [isPaymentSheetReady, setIsPaymentSheetReady] = useState(false)

  const { data: paymentMethods = [], refetch } = useGetPaymentMethodsQuery(orgId)
  const [setDefaultPaymentMethod] = useSetDefaultPaymentMethodMutation()
  const [detachPaymentMethod] = useDetachPaymentMethodMutation()
  const [createSetupIntent] = useCreateSetupIntentMutation()

  // Show loading while Stripe is loading
  if (stripeLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading payment system...</Text>
      </View>
    )
  }

  // Show error if Stripe failed to load
  if (!stripeHook) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load payment system</Text>
      </View>
    )
  }

  // Initialize payment sheet
  useEffect(() => {
    initializePaymentSheet()
  }, [])

  const initializePaymentSheet = async () => {
    try {
      if (!Config.stripe.publishableKey) {
        throw new Error('Stripe configuration error')
      }

      const { error } = await initPaymentSheet({
        merchantDisplayName: 'MyPhoneFriend',
        paymentIntentClientSecret: '', // We'll create this when needed
        allowsDelayedPaymentMethods: true,
      })

      if (error) {
        console.error('Error initializing payment sheet:', error)
        setMessage('Failed to initialize payment system')
        onError?.('Failed to initialize payment system')
      } else {
        setIsPaymentSheetReady(true)
      }
    } catch (err: any) {
      console.error('Error initializing payment sheet:', err)
      setMessage('Failed to initialize payment system')
      onError?.('Failed to initialize payment system')
    }
  }

  const handleAddPaymentMethod = async () => {
    if (!isPaymentSheetReady) {
      Alert.alert('Error', 'Payment system not ready. Please try again.')
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      // Create SetupIntent using RTK Query
      const { clientSecret } = await createSetupIntent({ orgId }).unwrap()

      // Initialize payment sheet with SetupIntent
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'MyPhoneFriend',
        paymentIntentClientSecret: clientSecret,
        allowsDelayedPaymentMethods: true,
      })

      if (initError) {
        throw new Error(initError.message)
      }

      // Present payment sheet
      const { error: presentError } = await presentPaymentSheet()

      if (presentError) {
        if (presentError.code === 'Canceled') {
          // User canceled, not an error
          setMessage('')
        } else {
          throw new Error(presentError.message)
        }
      } else {
        // Payment method added successfully
        setMessage('Payment method added successfully!')
        onPaymentMethodAdded?.()
        refetch() // Refresh payment methods list
      }
    } catch (err: any) {
      const errorMessage = err.message || 'An error occurred'
      setMessage(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      await setDefaultPaymentMethod({ orgId, paymentMethodId }).unwrap()
      setMessage('Default payment method updated!')
      refetch() // Refresh payment methods list
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to set default payment method'
      setMessage(errorMessage)
      onError?.(errorMessage)
    }
  }

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    Alert.alert(
      'Delete Payment Method',
      'Are you sure you want to delete this payment method?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await detachPaymentMethod({ orgId, paymentMethodId }).unwrap()
              setMessage('Payment method deleted!')
              refetch() // Refresh payment methods list
            } catch (err: any) {
              const errorMessage = err.message || 'Failed to delete payment method'
              setMessage(errorMessage)
              onError?.(errorMessage)
            }
          },
        },
      ]
    )
  }


  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Methods</Text>
      
      {paymentMethods.length > 0 && (
        <View style={styles.existingMethods}>
          <Text style={styles.sectionTitle}>Existing Payment Methods</Text>
          {paymentMethods.map((method: PaymentMethod) => (
            <Card key={method.id} style={styles.paymentMethodCard}>
              <ListItem
                text={`${method.brand?.toUpperCase() || method.type} •••• ${method.last4}`}
                subText={method.isDefault ? 'Default' : ''}
                rightIcon={method.isDefault ? 'check' : undefined}
                style={styles.paymentMethodItem}
                onPress={() => {
                  if (!method.isDefault) {
                    handleSetDefault(method.id)
                  }
                }}
              />
              {!method.isDefault && (
                <Button
                  text="Delete"
                  onPress={() => handleDeletePaymentMethod(method.id)}
                  style={styles.deleteButton}
                  preset="default"
                />
              )}
            </Card>
          ))}
        </View>
      )}

      <View style={styles.formContainer}>
        <Button
          text="Add Payment Method"
          onPress={handleAddPaymentMethod}
          disabled={!isPaymentSheetReady || isLoading}
          style={styles.addButton}
        />
        
        {message && (
          <Text style={[styles.message, message.includes('success') ? styles.successMessage : styles.errorMessage]}>
            {message}
          </Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: spacing.lg,
    color: colors.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.md,
    color: colors.text,
  },
  existingMethods: {
    marginBottom: spacing.xl,
  },
  paymentMethodCard: {
    marginBottom: spacing.sm,
  },
  paymentMethodItem: {
    padding: spacing.sm,
  },
  formContainer: {
    backgroundColor: colors.palette.neutral100,
    padding: spacing.lg,
    borderRadius: 8,
  },
  addButton: {
    marginBottom: spacing.md,
  },
  deleteButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.palette.angry500,
  },
  message: {
    marginTop: spacing.md,
    textAlign: 'center',
    fontSize: 14,
  },
  successMessage: {
    color: colors.palette.accent500,
  },
  errorMessage: {
    color: colors.palette.angry500,
  },
})

export default StripeMobilePayment
