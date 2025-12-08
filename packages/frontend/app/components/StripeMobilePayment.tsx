import React, { useState, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'
import ConfirmationModal from './ConfirmationModal'
import { Text, Button, Card, ListItem } from 'app/components'
import { colors, spacing } from 'app/theme'
import { useGetPaymentMethodsQuery, useSetDefaultPaymentMethodMutation, useDetachPaymentMethodMutation, useCreateSetupIntentMutation } from 'app/services/api/paymentMethodApi'
import { translate } from 'app/i18n'
import { logger } from '../utils/logger'

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
  const { toast, showError, showSuccess, hideToast } = useToast()
  const [stripeHook, setStripeHook] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [stripeLoading, setStripeLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState<string | null>(null)

  // Dynamically load the Stripe hook
  useEffect(() => {
    const loadStripe = async () => {
      try {
        const stripeModule = await import('@stripe/stripe-react-native')
        setStripeHook(stripeModule.useStripe())
        setStripeLoading(false)
      } catch (error) {
        logger.error('Failed to load Stripe hook:', error)
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
        logger.error('Error initializing payment sheet:', error)
        setMessage('Failed to initialize payment system')
        onError?.('Failed to initialize payment system')
      } else {
        setIsPaymentSheetReady(true)
      }
    } catch (err: any) {
      logger.error('Error initializing payment sheet:', err)
      setMessage('Failed to initialize payment system')
      onError?.('Failed to initialize payment system')
    }
  }

  const handleAddPaymentMethod = async () => {
    if (!isPaymentSheetReady) {
      showError('Payment system not ready. Please try again.')
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
    setPaymentMethodToDelete(paymentMethodId)
    setShowDeleteConfirm(true)
  }

  const confirmDeletePaymentMethod = async () => {
    if (!paymentMethodToDelete) return
    try {
      await detachPaymentMethod({ orgId, paymentMethodId: paymentMethodToDelete }).unwrap()
      setMessage('Payment method deleted!')
      showSuccess('Payment method deleted!')
      setPaymentMethodToDelete(null)
      setShowDeleteConfirm(false)
      refetch() // Refresh payment methods list
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete payment method'
      setMessage(errorMessage)
      showError(errorMessage)
      onError?.(errorMessage)
      setShowDeleteConfirm(false)
    }
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
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
        testID="stripe-mobile-toast"
      />
      <ConfirmationModal
        visible={showDeleteConfirm}
        title="Delete Payment Method"
        message="Are you sure you want to delete this payment method?"
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeletePaymentMethod}
        onCancel={() => {
          setShowDeleteConfirm(false)
          setPaymentMethodToDelete(null)
        }}
        testID="stripe-delete-confirm"
      />
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
